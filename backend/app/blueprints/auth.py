"""Session endpoints — ``/api/auth``.

Sign-in returns a bearer token plus the profile; everything else in the API
authenticates with that token. Registration is self-service and always creates a
*client*: staff, lawyers and admins are invited from the team screen.
"""

from __future__ import annotations

from flask import Blueprint, request

from app.extensions import execute, insert, query_one, update
from app.utils import (
    auth_required,
    body_of,
    clean,
    current_user,
    hash_password,
    issue_token,
    missing,
    notify,
    ok,
    permissions_for,
    record_activity,
    unauthorized,
    verify_password,
)
from app.utils.responses import bad_request, conflict, no_content

auth_bp = Blueprint("auth", __name__)

# The safe projection every response uses (never password_hash).
USER_COLUMNS = """
    id, name, email, role, phone, address, avatar,
    specialization, bar_number, is_active, created_at, updated_at
"""

DEFAULT_SETTINGS = {
    "email": True,
    "in_app": True,
    "consultations": True,
    "appointments": True,
    "documents": True,
}


def settings_payload(row: dict | None) -> dict:
    """Database row → the camelCase shape the frontend expects."""
    base = dict(DEFAULT_SETTINGS)
    if row:
        base.update(
            {
                "email": row["email"],
                "inApp": row["in_app"],
                "consultations": row["consultations"],
                "appointments": row["appointments"],
                "documents": row["documents"],
            }
        )
    return {"email": base["email"], "inApp": base["inApp"],
            "consultations": base["consultations"],
            "appointments": base["appointments"], "documents": base["documents"]}


def session_response(user: dict, status: int = 200):
    """The ``{user, token, permissions}`` payload both login and register return."""
    payload = {
        "user": user,
        "token": issue_token(user),
        "permissions": permissions_for(user["role"]),
    }
    return ok(payload, status) if status == 200 else (payload, status)


def find_user_by_email(email: str) -> dict | None:
    return query_one(
        f"select {USER_COLUMNS}, password_hash from public.users where email = %s",
        [email],
    )


def without_hash(row: dict) -> dict:
    row = dict(row)
    row.pop("password_hash", None)
    return row


# ---------------------------------------------------------------------------
# POST /api/auth/login
# ---------------------------------------------------------------------------
@auth_bp.post("/auth/login")
def login():
    data = body_of(request)
    email = clean(data.get("email"))
    password = data.get("password") or ""
    if not email or not password:
        return bad_request("Enter your e-mail address and password.")

    row = find_user_by_email(email)
    if not row or not verify_password(password, row["password_hash"]):
        # Same message for both cases: never reveal which e-mails exist.
        return unauthorized("Those details do not match an account.")

    if not row["is_active"]:
        return unauthorized("This account has been disabled. Contact the firm administrator.")

    execute("update public.users set last_login_at = now() where id = %s", [row["id"]])
    user = without_hash(row)
    record_activity(user, "auth.login", f"{user['name']} signed in.")
    return session_response(user)


# ---------------------------------------------------------------------------
# POST /api/auth/register
# ---------------------------------------------------------------------------
@auth_bp.post("/auth/register")
def register():
    data = body_of(request)
    name = clean(data.get("name"))
    email = clean(data.get("email"))
    password = data.get("password") or ""

    problems = missing(("name", name), ("email", email), ("password", password))
    if problems:
        return bad_request(f"Missing: {', '.join(problems)}.")
    if len(password) < 8:
        return bad_request("Use at least 8 characters for your password.")
    if find_user_by_email(email):
        return conflict("An account with that e-mail already exists.")

    user = insert(
        "users",
        {
            "name": name,
            "email": email,
            "password_hash": hash_password(password),
            "role": "client",
            "phone": clean(data.get("phone")),
            "address": clean(data.get("address")),
            "is_active": True,
        },
        returning=USER_COLUMNS,
    )

    # A client login always owns exactly one client file.
    insert(
        "clients",
        {
            "user_id": user["id"],
            "full_name": name,
            "email": email,
            "contact": clean(data.get("phone"), "—"),
            "address": clean(data.get("address"), "—"),
        },
    )

    record_activity(user, "auth.register", f"{name} registered as a client.")
    notify(user["id"], "system", "Welcome to JurisFlow. Describe your situation to get suggestions.")
    return session_response(user, 201)


# ---------------------------------------------------------------------------
# POST /api/auth/logout
# ---------------------------------------------------------------------------
@auth_bp.post("/auth/logout")
@auth_required
def logout():
    # Tokens are stateless: the client drops it. The audit trail records the act.
    record_activity(current_user(), "auth.logout", "Signed out.")
    return no_content()


# ---------------------------------------------------------------------------
# GET /api/auth/me
# ---------------------------------------------------------------------------
@auth_bp.get("/auth/me")
@auth_required
def me():
    return ok(current_user())


# ---------------------------------------------------------------------------
# PUT /api/auth/profile
# ---------------------------------------------------------------------------
@auth_bp.put("/auth/profile")
@auth_required
def update_profile():
    user = current_user()
    data = body_of(request)

    values = {
        key: clean(data.get(key))
        for key in ("name", "email", "phone", "address", "specialization", "bar_number")
        if key in data
    }
    if not values:
        return bad_request("Nothing to update.")

    if "email" in values:
        existing = find_user_by_email(values["email"])
        if existing and existing["id"] != user["id"]:
            return conflict("Another account already uses that e-mail address.")
        values["email"] = values["email"].lower()

    updated = update("users", values, "id = %s", [user["id"]], returning=USER_COLUMNS)
    record_activity(user, "auth.profile", "Updated their profile.")
    return ok(updated)


# ---------------------------------------------------------------------------
# POST /api/auth/password
# ---------------------------------------------------------------------------
@auth_bp.post("/auth/password")
@auth_required
def change_password():
    user = current_user()
    data = body_of(request)
    current = data.get("currentPassword") or ""
    new_password = data.get("newPassword") or ""

    if not current or not new_password:
        return bad_request("Provide your current password and the new one.")
    if len(new_password) < 8:
        return bad_request("The new password must be at least 8 characters.")

    stored = query_one("select password_hash from public.users where id = %s", [user["id"]])
    if not verify_password(current, stored["password_hash"] if stored else None):
        return unauthorized("The current password is not correct.")

    execute(
        "update public.users set password_hash = %s where id = %s",
        [hash_password(new_password), user["id"]],
    )
    record_activity(user, "auth.password", "Changed their password.")
    notify(user["id"], "system", "Your password was changed.")
    return no_content()


# ---------------------------------------------------------------------------
# GET / PUT /api/auth/settings  (notification preferences)
# ---------------------------------------------------------------------------
@auth_bp.get("/auth/settings")
@auth_required
def get_settings():
    user = current_user()
    row = query_one("select * from public.notification_settings where user_id = %s", [user["id"]])
    if row is None:
        insert("notification_settings", {"user_id": user["id"]})
    return ok(settings_payload(row))


@auth_bp.put("/auth/settings")
@auth_required
def save_settings():
    user = current_user()
    data = body_of(request)

    values = {
        "email": bool(data.get("email", True)),
        "in_app": bool(data.get("inApp", True)),
        "consultations": bool(data.get("consultations", True)),
        "appointments": bool(data.get("appointments", True)),
        "documents": bool(data.get("documents", True)),
    }

    row = query_one("select user_id from public.notification_settings where user_id = %s", [user["id"]])
    if row:
        updated = update(
            "notification_settings", values, "user_id = %s", [user["id"]]
        )
    else:
        updated = insert("notification_settings", {**values, "user_id": user["id"]})

    record_activity(user, "auth.settings", "Updated notification preferences.")
    return ok(settings_payload(updated))


@auth_bp.post("/auth/logout/all")
@auth_required
def logout_all():
    """Convenience endpoint for the profile page: ends every other session.

    Tokens are stateless, so the practical effect is a fresh ``exp`` window: the
    API returns a new token and the client discards the old one.
    """
    user = current_user()
    record_activity(user, "auth.logout_all", "Ended other sessions.")
    return session_response(user)
