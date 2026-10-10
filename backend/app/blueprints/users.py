"""Team management — ``/api/users``.

Admins invite lawyers and assistants, edit their details, disable an account
instead of deleting it, and read the audit trail of a member. ``/users/directory``
is the lightweight list every picker uses (assign a lawyer, book an appointment).
"""

from __future__ import annotations

from flask import Blueprint, request

from app.extensions import execute, insert, query_all, query_one, update
from app.utils import (
    as_bool,
    as_int,
    auth_required,
    body_of,
    clean,
    current_user,
    hash_password,
    missing,
    notify,
    ok,
    permission_required,
    record_activity,
    role_required,
)
from app.utils.responses import bad_request, conflict, created, no_content, not_found

users_bp = Blueprint("users", __name__)

USER_COLUMNS = """
    id, name, email, role, phone, address, avatar,
    specialization, bar_number, is_active, created_at, updated_at
"""

ROLE_VALUES = ("admin", "lawyer", "staff", "client")


def _existing_email(email: str, exclude_id: int | None = None) -> dict | None:
    row = query_one("select id from public.users where email = %s", [email])
    if row and row["id"] != exclude_id:
        return row
    return None


# ---------------------------------------------------------------------------
# GET /api/users/directory — pickers only (declared before /users/<id>)
# ---------------------------------------------------------------------------
@users_bp.get("/users/directory")
@auth_required
def directory():
    role = clean(request.args.get("role"))
    rows = query_all(
        f"""
        select {USER_COLUMNS}
          from public.users
         where is_active
           and (%s is null or role = %s)
         order by name
        """,
        [role, role],
    )
    return ok(rows)


# ---------------------------------------------------------------------------
# GET /api/users
# ---------------------------------------------------------------------------
@users_bp.get("/users")
@permission_required("users.read")
def list_users():
    role = clean(request.args.get("role"))
    term = clean(request.args.get("q"))
    active = request.args.get("isActive")
    is_active = None if active in (None, "") else as_bool(active)

    rows = query_all(
        f"""
        select {USER_COLUMNS}
          from public.users
         where (%s is null or role = %s)
           and (%s is null or is_active = %s)
           and (
             %s is null
             or name ilike '%%' || %s || '%%'
             or email ilike '%%' || %s || '%%'
           )
         order by role, name
        """,
        [role, role, is_active, is_active, term, term, term],
    )
    return ok(rows)


# ---------------------------------------------------------------------------
# GET /api/users/<id>/activity
# ---------------------------------------------------------------------------
@users_bp.get("/users/<int:user_id>/activity")
@permission_required("users.read")
def user_activity(user_id: int):
    limit = as_int(request.args.get("limit")) or 20
    rows = query_all(
        """
        select a.id, a.user_id, u.name as user_name, a.action, a.details, a.created_at
          from public.activity_logs a
          left join public.users u on u.id = a.user_id
         where a.user_id = %s
         order by a.created_at desc
         limit %s
        """,
        [user_id, limit],
    )
    return ok(rows)


# ---------------------------------------------------------------------------
# GET /api/users/<id>
# ---------------------------------------------------------------------------
@users_bp.get("/users/<int:user_id>")
@permission_required("users.read")
def get_user(user_id: int):
    row = query_one(f"select {USER_COLUMNS} from public.users where id = %s", [user_id])
    if not row:
        return not_found(f"User #{user_id}")
    return ok(row)


# ---------------------------------------------------------------------------
# POST /api/users — invite a lawyer, assistant or client login
# ---------------------------------------------------------------------------
@users_bp.post("/users")
@permission_required("users.write")
def create_user():
    actor = current_user()
    data = body_of(request)

    name = clean(data.get("name"))
    email = clean(data.get("email"))
    role = clean(data.get("role"))
    password = data.get("password") or ""

    problems = missing(("name", name), ("email", email), ("role", role))
    if problems:
        return bad_request(f"Missing: {', '.join(problems)}.")
    if role not in ROLE_VALUES:
        return bad_request(f"Role must be one of: {', '.join(ROLE_VALUES)}.")
    if role in ("admin", "lawyer") and actor["role"] != "admin":
        return bad_request("Only the firm administrator may invite admins or lawyers.")
    if _existing_email(email):
        return conflict("That e-mail address is already registered.")
    if password and len(password) < 8:
        return bad_request("Use at least 8 characters for the password.")

    # Without an explicit password the account is created disabled, so an admin
    # can prepare the profile and hand over credentials later.
    row = insert(
        "users",
        {
            "name": name,
            "email": email,
            "password_hash": hash_password(password or f"change-me-{role}-{email}"),
            "role": role,
            "phone": clean(data.get("phone")),
            "address": clean(data.get("address")),
            "specialization": clean(data.get("specialization")),
            "bar_number": clean(data.get("barNumber")),
            "is_active": bool(data.get("isActive", True)),
        },
        returning=USER_COLUMNS,
    )

    record_activity(actor, "user.create", f"Invited {name} as {role}.")
    notify(row["id"], "system", "Your JurisFlow account was created by the firm.")
    return created(row)


# ---------------------------------------------------------------------------
# PUT /api/users/<id>
# ---------------------------------------------------------------------------
@users_bp.put("/users/<int:user_id>")
@permission_required("users.write")
def update_user(user_id: int):
    actor = current_user()
    target = query_one("select * from public.users where id = %s", [user_id])
    if not target:
        return not_found(f"User #{user_id}")

    data = body_of(request)
    values: dict = {}

    for key in ("name", "phone", "address", "specialization", "bar_number"):
        if key in data:
            values[key] = clean(data.get(key))

    if "email" in data:
        email = clean(data.get("email"))
        if not email:
            return bad_request("An e-mail address is required.")
        if _existing_email(email, exclude_id=user_id):
            return conflict("That e-mail address is already registered.")
        values["email"] = email

    if "role" in data:
        role = clean(data.get("role"))
        if role not in ROLE_VALUES:
            return bad_request(f"Role must be one of: {', '.join(ROLE_VALUES)}.")
        if actor["role"] != "admin" and (role != "client" or target["role"] != "client"):
            return bad_request("Only the firm administrator may change staff roles.")
        values["role"] = role

    if "isActive" in data:
        values["is_active"] = bool(data.get("isActive"))

    if data.get("password"):
        if len(str(data["password"])) < 8:
            return bad_request("Use at least 8 characters for the password.")
        values["password_hash"] = hash_password(str(data["password"]))

    if not values:
        return bad_request("Nothing to update.")

    updated = update("users", values, "id = %s", [user_id], returning=USER_COLUMNS)
    record_activity(actor, "user.update", f"Updated {target['name']}.")
    return ok(updated)


# ---------------------------------------------------------------------------
# PATCH /api/users/<id>/status — enable / disable instead of deleting
# ---------------------------------------------------------------------------
@users_bp.patch("/users/<int:user_id>/status")
@permission_required("users.write")
def set_user_status(user_id: int):
    actor = current_user()
    target = query_one("select id, name, role from public.users where id = %s", [user_id])
    if not target:
        return not_found(f"User #{user_id}")
    if target["id"] == actor["id"]:
        return bad_request("You cannot disable your own account.")

    is_active = as_bool(body_of(request).get("isActive"), default=True)
    updated = update(
        "users", {"is_active": is_active}, "id = %s", [user_id], returning=USER_COLUMNS
    )
    record_activity(
        actor, "user.status", f"{'Enabled' if is_active else 'Disabled'} {target['name']}."
    )
    if not is_active:
        notify(target["id"], "system", "Your JurisFlow account was disabled by an administrator.")
    return ok(updated)


# ---------------------------------------------------------------------------
# DELETE /api/users/<id> — admin only, and never yourself
# ---------------------------------------------------------------------------
@users_bp.delete("/users/<int:user_id>")
@role_required("admin")
def delete_user(user_id: int):
    actor = current_user()
    target = query_one("select id, name from public.users where id = %s", [user_id])
    if not target:
        return not_found(f"User #{user_id}")
    if target["id"] == actor["id"]:
        return bad_request("You cannot delete your own account.")

    assigned = query_one(
        "select count(*) as total from public.cases where assigned_lawyer_id = %s", [user_id]
    )
    if assigned and assigned["total"]:
        return bad_request(
            f"{target['name']} still leads {assigned['total']} case(s). Reassign them first, "
            "or disable the account instead."
        )

    execute("delete from public.users where id = %s", [user_id])
    record_activity(actor, "user.delete", f"Deleted {target['name']}.")
    return no_content()
