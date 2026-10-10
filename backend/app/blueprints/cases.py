"""Case management — ``/api/cases``.

Visibility rules (mirrored by the row level security policies):

* admin / staff — every matter
* lawyer        — only the matters they lead
* client        — only their own matters

This is the same scoping the frontend's ``scope`` prop implements for display;
here it is enforced, because the API is the authority.
"""

from __future__ import annotations

from flask import Blueprint, g, request

from app.extensions import execute, insert, query_all, query_one, update
from app.utils import (
    auth_required,
    body_of,
    clean,
    current_user,
    missing,
    ok,
    permission_required,
    record_activity,
    role_has_permission,
    scoped_client_id,
)
from app.utils.responses import bad_request, forbidden, no_content, not_found

cases_bp = Blueprint("cases", __name__)

CASE_COLUMNS = """
    c.id, c.client_id, cl.full_name as client_name, c.case_number, c.title, c.type,
    c.status, c.priority, c.assigned_lawyer_id, l.name as assigned_lawyer_name,
    c.description, c.opened_at, c.created_at, c.updated_at
"""

STATUSES = ("open", "pending", "active", "discovery", "closed", "archived")
PRIORITIES = ("high", "medium", "low")

# SQL fragment: restricts rows to what the caller may see.
VISIBILITY = """
  (
    %(role)s in ('admin', 'staff')
    or (%(role)s = 'lawyer' and c.assigned_lawyer_id = %(user_id)s)
    or (%(role)s = 'client' and c.client_id = %(client_id)s)
  )
"""


def _load(case_id: int) -> dict | None:
    return query_one(
        f"""
        select {CASE_COLUMNS}
          from public.cases c
          left join public.clients cl on cl.id = c.client_id
          left join public.users l on l.id = c.assigned_lawyer_id
         where c.id = %s
        """,
        [case_id],
    )


def _can_read(user: dict, row: dict) -> bool:
    if user["role"] in ("admin", "staff"):
        return True
    if user["role"] == "lawyer":
        return row["assigned_lawyer_id"] == user["id"]
    return row["client_id"] == scoped_client_id(user)


# ---------------------------------------------------------------------------
# GET /api/cases
# ---------------------------------------------------------------------------
@cases_bp.get("/cases")
@permission_required("cases.read")
def list_cases():
    user = current_user()
    term = clean(request.args.get("q"))
    status = clean(request.args.get("status"))
    priority = clean(request.args.get("priority"))
    lawyer_filter = request.args.get("lawyerId")
    client_filter = request.args.get("clientId")

    params = {
        "role": user["role"],
        "user_id": user["id"],
        "client_id": scoped_client_id(user),
        "term": term,
        "status": status,
        "priority": priority,
        "lawyer": int(lawyer_filter) if lawyer_filter else None,
        "client": int(client_filter) if client_filter else None,
    }

    rows = query_all(
        f"""
        select {CASE_COLUMNS}
          from public.cases c
          left join public.clients cl on cl.id = c.client_id
          left join public.users l on l.id = c.assigned_lawyer_id
         where {VISIBILITY}
           and (%(status)s is null or c.status = %(status)s)
           and (%(priority)s is null or c.priority = %(priority)s)
           and (%(lawyer)s is null or c.assigned_lawyer_id = %(lawyer)s)
           and (%(client)s is null or c.client_id = %(client)s)
           and (
                 %(term)s is null
                 or c.title ilike '%%' || %(term)s || '%%'
                 or c.case_number ilike '%%' || %(term)s || '%%'
                 or cl.full_name ilike '%%' || %(term)s || '%%'
               )
         order by c.updated_at desc
        """,
        params,
    )
    return ok(rows)


# ---------------------------------------------------------------------------
# GET /api/cases/<id>
# ---------------------------------------------------------------------------
@cases_bp.get("/cases/<int:case_id>")
@permission_required("cases.read")
def get_case(case_id: int):
    user = current_user()
    row = _load(case_id)
    if not row:
        return not_found(f"Case #{case_id}")
    if not _can_read(user, row):
        return forbidden("This case is not assigned to you.")
    return ok(row)


# ---------------------------------------------------------------------------
# POST /api/cases
# ---------------------------------------------------------------------------
@cases_bp.post("/cases")
@permission_required("cases.write")
def create_case():
    actor = current_user()
    data = body_of(request)

    # A client who opens their own matter is not a use case we support: intake
    # goes through /consultations. Everyone else names the client.
    client_id = int(data["clientId"]) if data.get("clientId") else scoped_client_id(actor)
    title = clean(data.get("title"))

    problems = missing(("clientId", client_id), ("title", title))
    if problems:
        return bad_request(f"Missing: {', '.join(problems)}.")

    client = query_one("select id, user_id, full_name from public.clients where id = %s", [client_id])
    if not client:
        return not_found(f"Client #{client_id}")

    lawyer_id = int(data["assignedLawyerId"]) if data.get("assignedLawyerId") else None
    if actor["role"] == "lawyer" and not lawyer_id:
        lawyer_id = actor["id"]
    if lawyer_id:
        lawyer = query_one("select id, role from public.users where id = %s", [lawyer_id])
        if not lawyer or lawyer["role"] != "lawyer":
            return bad_request("The lead attorney must be an active lawyer.")

    status = clean(data.get("status"), "open")
    priority = clean(data.get("priority"), "medium")
    if status not in STATUSES:
        return bad_request(f"Status must be one of: {', '.join(STATUSES)}.")
    if priority not in PRIORITIES:
        return bad_request(f"Priority must be one of: {', '.join(PRIORITIES)}.")

    number = query_one("select public.next_case_number() as number")["number"]

    row = insert(
        "cases",
        {
            "client_id": client_id,
            "case_number": number,
            "title": title,
            "type": clean(data.get("type"), "General"),
            "status": status,
            "priority": priority,
            "assigned_lawyer_id": lawyer_id,
            "description": clean(data.get("description")),
            "created_by": actor["id"],
        },
    )

    record_activity(actor, "case.create", f"Opened {number} for {client['full_name']}.")
    if client["user_id"]:
        from app.utils import notify

        notify(
            client["user_id"],
            "case",
            f"A new matter ({number}) was opened for you.",
            "/client/cases",
        )
    return ok(row, 201)


# ---------------------------------------------------------------------------
# PUT /api/cases/<id>
# ---------------------------------------------------------------------------
@cases_bp.put("/cases/<int:case_id>")
@permission_required("cases.write")
def update_case(case_id: int):
    actor = current_user()
    target = _load(case_id)
    if not target:
        return not_found(f"Case #{case_id}")
    if actor["role"] == "lawyer" and target["assigned_lawyer_id"] != actor["id"]:
        return forbidden("Only the lead attorney may edit this case.")

    data = body_of(request)
    values: dict = {}

    for key in ("title", "type", "description"):
        if key in data:
            values[key] = clean(data.get(key))

    if "status" in data:
        status = clean(data.get("status"))
        if status not in STATUSES:
            return bad_request(f"Status must be one of: {', '.join(STATUSES)}.")
        values["status"] = status

    if "priority" in data:
        priority = clean(data.get("priority"))
        if priority not in PRIORITIES:
            return bad_request(f"Priority must be one of: {', '.join(PRIORITIES)}.")
        values["priority"] = priority

    if "assignedLawyerId" in data:
        lawyer_id = data.get("assignedLawyerId")
        values["assigned_lawyer_id"] = int(lawyer_id) if lawyer_id else None

    if not values:
        return bad_request("Nothing to update.")

    update("cases", values, "id = %s", [case_id])

    # `closed_at` is stamped with an SQL expression, so it is applied separately.
    if "status" in data:
        expression = "now()" if values.get("status") in ("closed", "archived") else "null"
        execute(f"update public.cases set closed_at = {expression} where id = %s", [case_id])

    record_activity(actor, "case.update", f"Updated {target['case_number']}.")
    return ok(_load(case_id))


# ---------------------------------------------------------------------------
# PATCH /api/cases/<id>/status
# ---------------------------------------------------------------------------
@cases_bp.patch("/cases/<int:case_id>/status")
@permission_required("cases.write")
def set_status(case_id: int):
    actor = current_user()
    target = _load(case_id)
    if not target:
        return not_found(f"Case #{case_id}")

    status = clean(body_of(request).get("status"))
    if status not in STATUSES:
        return bad_request(f"Status must be one of: {', '.join(STATUSES)}.")

    values = {"status": status}
    update("cases", values, "id = %s", [case_id])
    expression = "now()" if status in ("closed", "archived") else "null"
    execute(f"update public.cases set closed_at = {expression} where id = %s", [case_id])

    record_activity(actor, "case.status", f"{target['case_number']} → {status}.")
    return ok(_load(case_id))


# ---------------------------------------------------------------------------
# PATCH /api/cases/<id>/assign
# ---------------------------------------------------------------------------
@cases_bp.patch("/cases/<int:case_id>/assign")
@permission_required("cases.write")
def assign_case(case_id: int):
    actor = current_user()
    target = _load(case_id)
    if not target:
        return not_found(f"Case #{case_id}")

    lawyer_id = body_of(request).get("assignedLawyerId")
    if lawyer_id is not None:
        lawyer = query_one("select id, role, name from public.users where id = %s", [int(lawyer_id)])
        if not lawyer or lawyer["role"] != "lawyer":
            return bad_request("The lead attorney must be an active lawyer.")
        message = f"Assigned {target['case_number']} to {lawyer['name']}."
    else:
        message = f"Removed the lead attorney from {target['case_number']}."

    update(
        "cases",
        {"assigned_lawyer_id": int(lawyer_id) if lawyer_id else None},
        "id = %s",
        [case_id],
    )

    record_activity(actor, "case.assign", message)
    return ok(_load(case_id))


# ---------------------------------------------------------------------------
# DELETE /api/cases/<id>
# ---------------------------------------------------------------------------
@cases_bp.delete("/cases/<int:case_id>")
@permission_required("cases.write")
def delete_case(case_id: int):
    actor = current_user()
    target = _load(case_id)
    if not target:
        return not_found(f"Case #{case_id}")

    documents = query_one(
        "select count(*) as total from public.documents where case_id = %s", [case_id]
    )
    if documents and documents["total"]:
        return bad_request(
            f"{target['case_number']} still holds {documents['total']} document(s). "
            "Move or delete them first, or archive the case instead."
        )

    execute("delete from public.cases where id = %s", [case_id])
    record_activity(actor, "case.delete", f"Deleted {target['case_number']}.")
    return no_content()
