"""Diary endpoints — ``/api/appointments`` and ``/api/availability``.

Booking rules enforced here (in addition to the database's overlap constraint):

* a lawyer may only be booked inside their published availability;
* two appointments may not overlap for the same lawyer;
* a client may only see and move their own bookings;
* every status change notifies the client.
"""

from __future__ import annotations

from datetime import date as date_type

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
from app.utils.responses import bad_request, conflict, forbidden, no_content, not_found

appointments_bp = Blueprint("appointments", __name__)

STATUSES = ("scheduled", "confirmed", "rescheduled", "completed", "cancelled")

DAY_NAMES = ("Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday")

APPOINTMENT_COLUMNS = """
    a.id, a.client_id, cl.full_name as client_name, a.consultation_id,
    a.lawyer_id, l.name as lawyer_name, a.date, a.start_time, a.end_time,
    a.status, a.notes, a.cancel_reason, a.created_at, a.updated_at
"""

FROM_CLAUSE = """
    from public.appointments a
    left join public.clients cl on cl.id = a.client_id
    left join public.users l on l.id = a.lawyer_id
"""


def _load(appointment_id: int) -> dict | None:
    return query_one(
        f"select {APPOINTMENT_COLUMNS} {FROM_CLAUSE} where a.id = %s", [appointment_id]
    )


def _may_touch(user: dict, row: dict) -> bool:
    """Clients own their bookings; lawyers own their diary; staff run the desk."""
    if user["role"] in ("admin", "staff"):
        return True
    if user["role"] == "lawyer":
        return row["lawyer_id"] == user["id"]
    return row["client_id"] == scoped_client_id(user)


def _weekday_name(day: str) -> str | None:
    """``2026-03-14`` → ``Saturday`` (``None`` when the date is malformed)."""
    try:
        return DAY_NAMES[date_type.fromisoformat(day).weekday()]
    except ValueError:
        return None


def _overlaps(lawyer_id: int, day, start, end, ignore_id: int | None = None) -> dict | None:
    return query_one(
        """
        select id from public.appointments
         where lawyer_id = %s
           and date = %s
           and status <> 'cancelled'
           and (%s is null or id <> %s)
           and start_time < %s::time
           and end_time > %s::time
         limit 1
        """,
        [lawyer_id, day, ignore_id, ignore_id, end, start],
    )


# ---------------------------------------------------------------------------
# GET /api/appointments?status=&clientId=&lawyerId=&from=&to=
# ---------------------------------------------------------------------------
@appointments_bp.get("/appointments")
@permission_required("appointments.read")
def list_appointments():
    user = current_user()
    status = clean(request.args.get("status"))
    client_filter = request.args.get("clientId")
    lawyer_filter = request.args.get("lawyerId")
    date_from = clean(request.args.get("from"))
    date_to = clean(request.args.get("to"))

    # Clients are locked to their own bookings; lawyers to their own diary.
    client_id = scoped_client_id(user) or (int(client_filter) if client_filter else None)
    lawyer_id = user["id"] if user["role"] == "lawyer" else (
        int(lawyer_filter) if lawyer_filter else None
    )

    rows = query_all(
        f"""
        select {APPOINTMENT_COLUMNS} {FROM_CLAUSE}
         where (%s is null or a.client_id = %s)
           and (%s is null or a.lawyer_id = %s)
           and (%s is null or a.status = %s)
           and (%s is null or a.date >= %s::date)
           and (%s is null or a.date <= %s::date)
         order by a.date, a.start_time
        """,
        [
            client_id, client_id,
            lawyer_id, lawyer_id,
            status, status,
            date_from, date_from,
            date_to, date_to,
        ],
    )
    return ok(rows)


# ---------------------------------------------------------------------------
# GET /api/appointments/slots?lawyerId=&date=
# ---------------------------------------------------------------------------
@appointments_bp.get("/appointments/slots")
@auth_required
def list_slots():
    lawyer_id = request.args.get("lawyerId")
    day = clean(request.args.get("date"))
    if not lawyer_id or not day:
        return bad_request("Provide lawyerId and date (YYYY-MM-DD).")

    rows = query_all(
        "select slot_time, is_available from public.free_slots(%s, %s::date)",
        [int(lawyer_id), day],
    )
    return ok(
        [
            {"date": day, "time": str(row["slot_time"])[:5], "available": row["is_available"]}
            for row in rows
        ]
    )


# ---------------------------------------------------------------------------
# GET /api/appointments/<id>
# ---------------------------------------------------------------------------
@appointments_bp.get("/appointments/<int:appointment_id>")
@permission_required("appointments.read")
def get_appointment(appointment_id: int):
    user = current_user()
    row = _load(appointment_id)
    if not row:
        return not_found(f"Appointment #{appointment_id}")
    if not _may_touch(user, row):
        return forbidden("This appointment is not yours.")
    return ok(row)


# ---------------------------------------------------------------------------
# POST /api/appointments
# ---------------------------------------------------------------------------
@appointments_bp.post("/appointments")
@permission_required("appointments.write")
def create_appointment():
    actor = current_user()
    data = body_of(request)

    client_id = scoped_client_id(actor) or (int(data["clientId"]) if data.get("clientId") else None)
    lawyer_id = int(data["lawyerId"]) if data.get("lawyerId") else (
        actor["id"] if actor["role"] == "lawyer" else None
    )
    day = clean(data.get("date"))
    start = clean(data.get("startTime"))
    end = clean(data.get("endTime"))

    problems = missing(
        ("clientId", client_id), ("lawyerId", lawyer_id),
        ("date", day), ("startTime", start), ("endTime", end),
    )
    if problems:
        return bad_request(f"Missing: {', '.join(problems)}.")
    if start >= end:
        return bad_request("The end time must be after the start time.")

    client = query_one("select id, user_id, full_name from public.clients where id = %s", [client_id])
    if not client:
        return not_found(f"Client #{client_id}")

    lawyer = query_one("select id, name, role, is_active from public.users where id = %s", [lawyer_id])
    if not lawyer or lawyer["role"] != "lawyer" or not lawyer["is_active"]:
        return bad_request("Choose an active lawyer for this appointment.")

    # Inside the published grid?
    weekday = _weekday_name(day)
    if not weekday:
        return bad_request("Send the date as YYYY-MM-DD.")

    inside = query_one(
        """
        select 1 from public.availability
         where lawyer_id = %s and is_available and day_of_week = %s
           and %s::time >= start_time and %s::time <= end_time
        """,
        [lawyer_id, weekday, start, end],
    )
    if not inside:
        return bad_request("That time is outside the lawyer's published availability.")

    if _overlaps(lawyer_id, day, start, end):
        return conflict("That slot is already booked for this lawyer.")

    row = insert(
        "appointments",
        {
            "client_id": client_id,
            "consultation_id": int(data["consultationId"]) if data.get("consultationId") else None,
            "lawyer_id": lawyer_id,
            "date": day,
            "start_time": start,
            "end_time": end,
            "status": clean(data.get("status"), "scheduled"),
            "notes": clean(data.get("notes")),
            "created_by": actor["id"],
        },
    )

    record_activity(
        actor, "appointment.create", f"{client['full_name']} with {lawyer['name']} on {day} {start}."
    )
    if client["user_id"]:
        notify(
            client["user_id"],
            "appointment",
            f"Your appointment with {lawyer['name']} is booked for {day} at {start}.",
            "/client/appointments",
        )
    return ok(_load(row["id"]), 201)


# ---------------------------------------------------------------------------
# PUT /api/appointments/<id> — move or edit a booking
# ---------------------------------------------------------------------------
@appointments_bp.put("/appointments/<int:appointment_id>")
@permission_required("appointments.write")
def update_appointment(appointment_id: int):
    actor = current_user()
    target = _load(appointment_id)
    if not target:
        return not_found(f"Appointment #{appointment_id}")
    if not _may_touch(actor, target):
        return forbidden("This appointment is not yours.")

    data = body_of(request)
    values: dict = {}

    if "lawyerId" in data and data.get("lawyerId"):
        values["lawyer_id"] = int(data["lawyerId"])
    if "date" in data:
        values["date"] = clean(data.get("date"))
    if "startTime" in data:
        values["start_time"] = clean(data.get("startTime"))
    if "endTime" in data:
        values["end_time"] = clean(data.get("endTime"))
    if "status" in data and clean(data.get("status")) in STATUSES:
        values["status"] = clean(data.get("status"))
    if "notes" in data:
        values["notes"] = clean(data.get("notes"))

    if not values:
        return bad_request("Nothing to update.")

    day = str(values.get("date", target["date"]))
    start = str(values.get("start_time", target["start_time"]))[:5]
    end = str(values.get("end_time", target["end_time"]))[:5]
    lawyer_id = values.get("lawyer_id", target["lawyer_id"])

    if start >= end:
        return bad_request("The end time must be after the start time.")
    if _overlaps(lawyer_id, day, start, end, ignore_id=appointment_id):
        return conflict("The lawyer already has a booking at that time.")

    # Moving a booking without saying so explicitly means it was rescheduled.
    if any(key in values for key in ("date", "start_time", "end_time", "lawyer_id")) and "status" not in values:
        values["status"] = "rescheduled"

    update("appointments", values, "id = %s", [appointment_id])

    client = query_one("select user_id from public.clients where id = %s", [target["client_id"]])
    if client and client["user_id"]:
        notify(
            client["user_id"],
            "appointment",
            f"Your appointment on {day} at {start} was updated.",
            "/client/appointments",
        )

    record_activity(actor, "appointment.update", f"Moved appointment #{appointment_id} to {day} {start}.")
    return ok(_load(appointment_id))


# ---------------------------------------------------------------------------
# PATCH /api/appointments/<id>/status — confirm / complete / cancel
# ---------------------------------------------------------------------------
@appointments_bp.patch("/appointments/<int:appointment_id>/status")
@permission_required("appointments.write")
def set_appointment_status(appointment_id: int):
    actor = current_user()
    target = _load(appointment_id)
    if not target:
        return not_found(f"Appointment #{appointment_id}")
    if not _may_touch(actor, target):
        return forbidden("This appointment is not yours.")

    data = body_of(request)
    status = clean(data.get("status"))
    if status not in STATUSES:
        return bad_request(f"Status must be one of: {', '.join(STATUSES)}.")

    values = {"status": status}
    if status == "cancelled":
        values["cancel_reason"] = clean(data.get("reason"))

    update("appointments", values, "id = %s", [appointment_id])

    client = query_one("select user_id from public.clients where id = %s", [target["client_id"]])
    if client and client["user_id"]:
        notify(
            client["user_id"],
            "appointment",
            f"Your appointment on {target['date']} is now {status}.",
            "/client/appointments",
        )

    record_activity(actor, "appointment.status", f"Appointment #{appointment_id} → {status}.")
    return ok(_load(appointment_id))


# ---------------------------------------------------------------------------
# DELETE /api/appointments/<id>
# ---------------------------------------------------------------------------
@appointments_bp.delete("/appointments/<int:appointment_id>")
@permission_required("appointments.write")
def delete_appointment(appointment_id: int):
    actor = current_user()
    target = _load(appointment_id)
    if not target:
        return not_found(f"Appointment #{appointment_id}")

    # Staff and the admin may remove a booking outright; a lawyer may only
    # remove their own, and never once it is completed.
    if actor["role"] == "lawyer":
        if target["lawyer_id"] != actor["id"]:
            return forbidden("This appointment is not in your diary.")
        if target["status"] == "completed":
            return bad_request("A completed appointment cannot be deleted.")

    execute("delete from public.appointments where id = %s", [appointment_id])
    record_activity(actor, "appointment.delete", f"Deleted appointment #{appointment_id}.")
    return no_content()


# ---------------------------------------------------------------------------
# GET /api/availability?lawyerId=
# ---------------------------------------------------------------------------
@appointments_bp.get("/availability")
@auth_required
def list_availability():
    user = current_user()
    requested = request.args.get("lawyerId")

    # A lawyer always reads their own grid; staff/admin may inspect anyone's.
    lawyer_id = int(requested) if requested else None
    if user["role"] == "lawyer":
        lawyer_id = user["id"]

    rows = query_all(
        """
        select a.id, a.lawyer_id, u.name as lawyer_name, a.day_of_week,
               a.start_time, a.end_time, a.is_available
          from public.availability a
          join public.users u on u.id = a.lawyer_id
         where (%s is null or a.lawyer_id = %s)
         order by array_position(
                 array['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'],
                 a.day_of_week)
        """,
        [lawyer_id, lawyer_id],
    )

    # Times arrive as `datetime.time`; the client edits plain "HH:MM" strings.
    for row in rows:
        row["start_time"] = str(row["start_time"])[:5]
        row["end_time"] = str(row["end_time"])[:5]
    return ok(rows)


# ---------------------------------------------------------------------------
# PUT /api/availability — replace one lawyer's whole week
# ---------------------------------------------------------------------------
@appointments_bp.put("/availability")
@auth_required
def save_availability():
    actor = current_user()
    if actor["role"] not in ("lawyer", "admin"):
        return forbidden("Only a lawyer or the administrator maintains availability.")

    data = body_of(request)
    lawyer_id = int(data["lawyerId"]) if data.get("lawyerId") else actor["id"]
    if actor["role"] == "lawyer" and lawyer_id != actor["id"]:
        return forbidden("You may only change your own availability.")

    lawyer = query_one("select id, role from public.users where id = %s", [lawyer_id])
    if not lawyer:
        return not_found(f"User #{lawyer_id}")
    if lawyer["role"] != "lawyer":
        return bad_request("Availability belongs to a lawyer.")

    entries = data.get("entries")
    if not isinstance(entries, list) or not entries:
        return bad_request("Provide the weekly slots to save.")

    cleaned: list[dict] = []
    for entry in entries:
        day = clean(entry.get("dayOfWeek"))
        start = clean(entry.get("startTime"))
        end = clean(entry.get("endTime"))
        if day not in DAY_NAMES:
            return bad_request(f"Unknown day: {day}.")
        if not start or not end or start >= end:
            return bad_request(f"{day}: the end time must be after the start time.")
        cleaned.append(
            {
                "day_of_week": day,
                "start_time": start,
                "end_time": end,
                "is_available": entry.get("isAvailable", True) is not False,
            }
        )

    # Replace rather than merge: the client always sends the full week, which is
    # why the endpoint is a single PUT instead of per-day patches.
    execute("delete from public.availability where lawyer_id = %s", [lawyer_id])
    for slot in cleaned:
        insert("availability", {"lawyer_id": lawyer_id, **slot})

    record_activity(actor, "availability.update", f"Saved the weekly grid for lawyer #{lawyer_id}.")

    rows = query_all(
        """
        select id, lawyer_id, start_time, end_time, day_of_week, is_available
          from public.availability where lawyer_id = %s
         order by id
        """,
        [lawyer_id],
    )
    for row in rows:
        row["start_time"] = str(row["start_time"])[:5]
        row["end_time"] = str(row["end_time"])[:5]
    return ok(rows)
