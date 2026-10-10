"""Client book — ``/api/clients``.

Staff, lawyers and the admin maintain the client files; a client account only
ever sees its own row (the id comes from the token, never from the URL).
"""

from __future__ import annotations

from flask import Blueprint, request

from app.extensions import execute, insert, query_all, query_one, update
from app.utils import (
    auth_required,
    body_of,
    clean,
    client_record,
    current_user,
    missing,
    ok,
    permission_required,
    record_activity,
    role_has_permission,
)
from app.utils.responses import bad_request, forbidden, not_found, no_content

clients_bp = Blueprint("clients", __name__)


def _load(client_id: int) -> dict | None:
    return query_one("select * from public.clients where id = %s", [client_id])


# ---------------------------------------------------------------------------
# GET /api/clients/me — the signed-in client's own file
# ---------------------------------------------------------------------------
@clients_bp.get("/clients/me")
@auth_required
def my_profile():
    user = current_user()
    if user["role"] != "client":
        return bad_request("Only a client account has a client profile.")

    row = client_record(user)
    if not row:
        return not_found("Your client profile")
    return ok(row)


# ---------------------------------------------------------------------------
# GET /api/clients?q=
# ---------------------------------------------------------------------------
@clients_bp.get("/clients")
@auth_required
def list_clients():
    user = current_user()
    term = clean(request.args.get("q"))

    # A client only ever sees themselves.
    if user["role"] == "client":
        row = client_record(user)
        return ok([row] if row else [])

    if not role_has_permission(user["role"], "clients.read"):
        return forbidden("Missing permission: clients.read.")

    rows = query_all(
        """
        select c.*,
               (select count(*) from public.cases cs where cs.client_id = c.id) as cases_count
          from public.clients c
         where (
                 %s is null
                 or c.full_name ilike '%%' || %s || '%%'
                 or c.email ilike '%%' || %s || '%%'
                 or c.contact ilike '%%' || %s || '%%'
               )
         order by c.full_name
        """,
        [term, term, term, term],
    )
    return ok(rows)


# ---------------------------------------------------------------------------
# GET /api/clients/<id>
# ---------------------------------------------------------------------------
@clients_bp.get("/clients/<int:client_id>")
@auth_required
def get_client(client_id: int):
    user = current_user()
    row = _load(client_id)
    if not row:
        return not_found(f"Client #{client_id}")

    if user["role"] == "client" and row["user_id"] != user["id"]:
        return forbidden("You may only open your own client record.")
    return ok(row)


# ---------------------------------------------------------------------------
# POST /api/clients — open a file (optionally with a portal login)
# ---------------------------------------------------------------------------
@clients_bp.post("/clients")
@permission_required("clients.write")
def create_client():
    actor = current_user()
    data = body_of(request)

    full_name = clean(data.get("fullName"))
    contact = clean(data.get("contact"))
    address = clean(data.get("address"))

    problems = missing(("fullName", full_name), ("contact", contact), ("address", address))
    if problems:
        return bad_request(f"Missing: {', '.join(problems)}.")

    email = clean(data.get("email"))
    user_id = None

    # Creating the login in the same call keeps the two rows consistent: a file
    # without a login is fine, a login without a file is not.
    if email and data.get("password"):
        if len(str(data["password"])) < 8:
            return bad_request("Use at least 8 characters for the password.")
        if query_one("select id from public.users where email = %s", [email]):
            return bad_request("That e-mail address already has an account.")

        from app.utils import hash_password

        account = insert(
            "users",
            {
                "name": full_name,
                "email": email,
                "password_hash": hash_password(str(data["password"])),
                "role": "client",
                "phone": contact,
                "address": address,
                "is_active": True,
            },
            returning="id",
        )
        user_id = account["id"]

    row = insert(
        "clients",
        {
            "user_id": user_id,
            "full_name": full_name,
            "email": email,
            "contact": contact,
            "address": address,
            "notes": clean(data.get("notes")),
            "created_by": actor["id"],
        },
    )

    record_activity(actor, "client.create", f"Opened a client file for {full_name}.")
    return ok(row, 201)


# ---------------------------------------------------------------------------
# PUT /api/clients/<id>
# ---------------------------------------------------------------------------
@clients_bp.put("/clients/<int:client_id>")
@permission_required("clients.write")
def update_client(client_id: int):
    actor = current_user()
    target = _load(client_id)
    if not target:
        return not_found(f"Client #{client_id}")

    data = body_of(request)
    mapping = {
        "fullName": "full_name",
        "email": "email",
        "contact": "contact",
        "address": "address",
        "notes": "notes",
    }
    values = {
        column: clean(data.get(key))
        for key, column in mapping.items()
        if key in data
    }
    if not values:
        return bad_request("Nothing to update.")

    updated = update("clients", values, "id = %s", [client_id])
    record_activity(actor, "client.update", f"Updated the file for {target['full_name']}.")
    return ok(updated)


# ---------------------------------------------------------------------------
# DELETE /api/clients/<id>
# ---------------------------------------------------------------------------
@clients_bp.delete("/clients/<int:client_id>")
@permission_required("clients.write")
def delete_client(client_id: int):
    actor = current_user()
    target = _load(client_id)
    if not target:
        return not_found(f"Client #{client_id}")

    # Deleting a file cascades to cases, consultations, appointments and
    # documents, so it is reserved for the owner and refused while work is open.
    if actor["role"] != "admin":
        return forbidden("Only the firm administrator may delete a client file.")

    open_cases = query_one(
        """
        select count(*) as total
          from public.cases
         where client_id = %s and status not in ('closed', 'archived')
        """,
        [client_id],
    )
    if open_cases and open_cases["total"]:
        return bad_request(
            f"{target['full_name']} still has {open_cases['total']} open case(s). "
            "Close or reassign them first."
        )

    execute("delete from public.clients where id = %s", [client_id])
    record_activity(actor, "client.delete", f"Deleted the file for {target['full_name']}.")
    return no_content()
