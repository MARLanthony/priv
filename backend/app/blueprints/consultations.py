"""Intake pipeline — ``/api/consultations``.

The flow the whole product is built around:

    client submits a concern  →  staff triages  →  lawyer reviews
    (approved)                →  staff books an appointment

Only ``consultations.review`` holders (admin, lawyer) may move a row out of
``pending``; staff can read the queue and book, but not decide.
"""

from __future__ import annotations

from flask import Blueprint, request

from app.extensions import execute, insert, query_all, query_one, update
from app.utils import (
    auth_required,
    body_of,
    clean,
    current_user,
    missing,
    notify,
    ok,
    permission_required,
    record_activity,
    role_has_permission,
    scoped_client_id,
)
from app.utils.responses import bad_request, forbidden, no_content, not_found

consultations_bp = Blueprint("consultations", __name__)

STATUSES = ("pending", "approved", "declined", "completed")

CONSULTATION_COLUMNS = """
    c.id, c.client_id, cl.full_name as client_name, c.service_id,
    s.name as service_name, c.concern, c.status, c.review_note,
    c.reviewed_by, r.name as reviewed_by_name, c.reviewed_at,
    c.created_at, c.updated_at
"""

FROM_CLAUSE = """
    from public.consultations c
    left join public.clients cl on cl.id = c.client_id
    left join public.legal_services s on s.id = c.service_id
    left join public.users r on r.id = c.reviewed_by
"""


def _load(consultation_id: int) -> dict | None:
    return query_one(
        f"select {CONSULTATION_COLUMNS} {FROM_CLAUSE} where c.id = %s", [consultation_id]
    )


# ---------------------------------------------------------------------------
# GET /api/consultations?status=&clientId=&q=
# ---------------------------------------------------------------------------
@consultations_bp.get("/consultations")
@permission_required("consultations.read")
def list_consultations():
    user = current_user()
    status = clean(request.args.get("status"))
    term = clean(request.args.get("q"))
    requested_client = request.args.get("clientId")

    # A client is locked to their own rows, whatever they put in the query string.
    client_id = scoped_client_id(user)
    if user["role"] != "client" and requested_client:
        client_id = int(requested_client)

    rows = query_all(
        f"""
        select {CONSULTATION_COLUMNS} {FROM_CLAUSE}
         where (%s is null or c.client_id = %s)
           and (%s is null or c.status = %s)
           and (%s is null or c.concern ilike '%%' || %s || '%%' or cl.full_name ilike '%%' || %s || '%%')
         order by
           case c.status when 'pending' then 0 when 'approved' then 1 else 2 end,
           c.created_at desc
        """,
        [client_id, client_id, status, status, term, term, term],
    )
    return ok(rows)


# ---------------------------------------------------------------------------
# GET /api/consultations/<id>
# ---------------------------------------------------------------------------
@consultations_bp.get("/consultations/<int:consultation_id>")
@permission_required("consultations.read")
def get_consultation(consultation_id: int):
    user = current_user()
    row = _load(consultation_id)
    if not row:
        return not_found(f"Consultation #{consultation_id}")

    if user["role"] == "client" and row["client_id"] != scoped_client_id(user):
        return forbidden("This request is not yours.")
    return ok(row)


# ---------------------------------------------------------------------------
# POST /api/consultations — a client raises a concern
# ---------------------------------------------------------------------------
@consultations_bp.post("/consultations")
@permission_required("consultations.read")
def create_consultation():
    actor = current_user()
    data = body_of(request)
    concern = clean(data.get("concern"))

    if not concern or len(concern) < 20:
        return bad_request("Describe the situation in at least 20 characters.")

    # A client always files against their own record; staff may file on behalf.
    client_id = scoped_client_id(actor) or (
        int(data["clientId"]) if data.get("clientId") else None
    )
    if not client_id:
        return bad_request("Choose the client this concern belongs to.")

    client = query_one("select id, user_id, full_name from public.clients where id = %s", [client_id])
    if not client:
        return not_found(f"Client #{client_id}")

    service_id = int(data["serviceId"]) if data.get("serviceId") else None
    if service_id and not query_one("select id from public.legal_services where id = %s", [service_id]):
        return not_found(f"Service #{service_id}")

    row = insert(
        "consultations",
        {"client_id": client_id, "service_id": service_id, "concern": concern, "status": "pending"},
    )

    record_activity(actor, "consultation.create", f"Submitted a concern for {client['full_name']}.")

    # Tell the front desk and the lawyers so the queue is picked up.
    for staffer in query_all("select id from public.users where role in ('admin', 'staff') and is_active"):
        notify(
            staffer["id"],
            "consultation",
            f"New intake request from {client['full_name']}.",
            "/staff/consultations",
        )
    return ok(_load(row["id"]), 201)


# ---------------------------------------------------------------------------
# PUT /api/consultations/<id> — the client (or staff) edits the text
# ---------------------------------------------------------------------------
@consultations_bp.put("/consultations/<int:consultation_id>")
@permission_required("consultations.read")
def update_consultation(consultation_id: int):
    actor = current_user()
    target = _load(consultation_id)
    if not target:
        return not_found(f"Consultation #{consultation_id}")

    if actor["role"] == "client" and target["client_id"] != scoped_client_id(actor):
        return forbidden("This request is not yours.")
    if target["status"] != "pending":
        return bad_request("A reviewed request can no longer be edited.")

    data = body_of(request)
    values: dict = {}
    if "concern" in data:
        concern = clean(data.get("concern"))
        if not concern or len(concern) < 20:
            return bad_request("Describe the situation in at least 20 characters.")
        values["concern"] = concern
    if "serviceId" in data:
        values["service_id"] = int(data["serviceId"]) if data.get("serviceId") else None

    if not values:
        return bad_request("Nothing to update.")

    update("consultations", values, "id = %s", [consultation_id])
    record_activity(actor, "consultation.update", "Updated an intake request.")
    return ok(_load(consultation_id))


# ---------------------------------------------------------------------------
# PATCH /api/consultations/<id>/status — approve / decline / complete
# ---------------------------------------------------------------------------
@consultations_bp.patch("/consultations/<int:consultation_id>/status")
@auth_required
def review_consultation(consultation_id: int):
    actor = current_user()
    target = _load(consultation_id)
    if not target:
        return not_found(f"Consultation #{consultation_id}")

    status = clean(body_of(request).get("status"))
    if status not in STATUSES:
        return bad_request(f"Status must be one of: {', '.join(STATUSES)}.")

    # A client may only withdraw their own *pending* request.
    if actor["role"] == "client":
        if target["client_id"] != scoped_client_id(actor):
            return forbidden("This request is not yours.")
        if status != "declined":
            return forbidden("Only the firm can approve a request.")
    elif not role_has_permission(actor["role"], "consultations.review"):
        return forbidden("Missing permission: consultations.review.")

    update(
        "consultations",
        {
            "status": status,
            "review_note": clean(body_of(request).get("reviewNote")),
            "reviewed_by": actor["id"],
        },
        "id = %s",
        [consultation_id],
    )

    # reviewed_at is stamped by the trigger in migration 005.
    client = query_one("select user_id, full_name from public.clients where id = %s", [target["client_id"]])
    if client and client["user_id"]:
        verbs = {
            "approved": "was approved — you can now book a consultation",
            "declined": "was declined",
            "completed": "is complete",
            "pending": "was reopened",
        }
        notify(
            client["user_id"],
            "consultation",
            f"Your intake request {verbs.get(status, 'was updated')}.",
            "/client/appointments",
        )

    record_activity(
        actor, "consultation.review", f"{target['client_name']} → {status}."
    )
    return ok(_load(consultation_id))


# ---------------------------------------------------------------------------
# DELETE /api/consultations/<id>
# ---------------------------------------------------------------------------
@consultations_bp.delete("/consultations/<int:consultation_id>")
@auth_required
def delete_consultation(consultation_id: int):
    actor = current_user()
    target = _load(consultation_id)
    if not target:
        return not_found(f"Consultation #{consultation_id}")

    if actor["role"] == "client":
        if target["client_id"] != scoped_client_id(actor) or target["status"] != "pending":
            return forbidden("Only your own pending requests can be withdrawn.")
    elif not role_has_permission(actor["role"], "consultations.review"):
        return forbidden("Missing permission: consultations.review.")

    execute("delete from public.consultations where id = %s", [consultation_id])
    record_activity(actor, "consultation.delete", f"Removed an intake request from {target['client_name']}.")
    return no_content()
