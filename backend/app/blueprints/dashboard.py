"""Dashboards and the audit trail — ``/api/dashboard``, ``/api/activity``.

Counters are computed from what the caller may *see*, so the client portal shows
their own file, a lawyer their docket and the admin the whole firm. The frontend
renders these directly (`DashboardOverview.tsx`), which is why the shape of the
overview series is fixed.
"""

from __future__ import annotations

from flask import Blueprint, request

from app.extensions import query_all, query_one
from app.utils import as_int, auth_required, clean, current_user, ok, permission_required, scoped_client_id

dashboard_bp = Blueprint("dashboard", __name__)

CASE_STATUSES = ("open", "pending", "active", "discovery", "closed", "archived")
CONSULTATION_STATUSES = ("pending", "approved", "declined", "completed")

# Column names in the six-month series, oldest first.
MONTHS = ("Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec")


def _visibility(user: dict) -> tuple[str, list]:
    """The SQL fragment plus its parameters that scope rows to this caller."""
    if user["role"] == "admin":
        return "true", []
    if user["role"] == "staff":
        return "true", []
    if user["role"] == "lawyer":
        return "c.assigned_lawyer_id = %s", [user["id"]]
    return "c.client_id = %s", [scoped_client_id(user)]


# ---------------------------------------------------------------------------
# GET /api/dashboard/stats
# ---------------------------------------------------------------------------
@dashboard_bp.get("/dashboard/stats")
@auth_required
def stats():
    user = current_user()
    clause, params = _visibility(user)
    client_id = scoped_client_id(user)

    cases = query_one(f"select count(*) as total from public.cases c where {clause}", params)

    if user["role"] == "client":
        consult_filter, consult_params = "client_id = %s", [client_id]
        appt_filter, appt_params = "client_id = %s", [client_id]
        doc_filter, doc_params = "client_id = %s", [client_id]
    elif user["role"] == "lawyer":
        consult_filter, consult_params = "true", []
        appt_filter, appt_params = "lawyer_id = %s", [user["id"]]
        doc_filter, doc_params = (
            """
            (case_id is null or case_id in (
                select id from public.cases where assigned_lawyer_id = %s
            ))
            """,
            [user["id"]],
        )
    else:
        consult_filter, consult_params = "true", []
        appt_filter, appt_params = "true", []
        doc_filter, doc_params = "true", []

    consultations = query_one(
        f"select count(*) as total from public.consultations where {consult_filter}", consult_params
    )
    appointments = query_one(
        f"select count(*) as total from public.appointments where {appt_filter}", appt_params
    )
    documents = query_one(
        f"select count(*) as total from public.documents where {doc_filter}", doc_params
    )
    clients = query_one(
        "select count(*) as total from public.clients"
        if user["role"] != "client"
        else "select count(*) as total from public.clients where id = %s",
        [] if user["role"] != "client" else [client_id],
    )
    unread = query_one(
        "select count(*) as total from public.notifications where user_id = %s and not is_read",
        [user["id"]],
    )
    team = query_one("select count(*) as total from public.users where is_active") if user["role"] == "admin" else None

    return ok(
        {
            "users": team["total"] if team else None,
            "clients": clients["total"] if clients else 0,
            "cases": cases["total"] if cases else 0,
            "consultations": consultations["total"] if consultations else 0,
            "appointments": appointments["total"] if appointments else 0,
            "documents": documents["total"] if documents else 0,
            "unreadNotifications": unread["total"] if unread else 0,
        }
    )


# ---------------------------------------------------------------------------
# GET /api/dashboard/overview — the series behind the charts
# ---------------------------------------------------------------------------
@dashboard_bp.get("/dashboard/overview")
@auth_required
def overview():
    user = current_user()
    clause, params = _visibility(user)
    client_id = scoped_client_id(user)

    cases_by_status = query_all(
        f"select c.status as label, count(*) as value from public.cases c where {clause} group by c.status",
        params,
    )

    if user["role"] == "client":
        consult_clause, consult_params = "client_id = %s", [client_id]
    else:
        consult_clause, consult_params = "true", []

    consultations_by_status = query_all(
        f"""
        select status as label, count(*) as value
          from public.consultations
         where {consult_clause}
         group by status
        """,
        consult_params,
    )

    # Appointments for the last six months, oldest first (the chart expects a
    # fixed-length series, so the months are generated rather than grouped).
    months = query_all(
        """
        with span as (
          select generate_series(
                   date_trunc('month', now()) - interval '5 months',
                   date_trunc('month', now()),
                   interval '1 month'
                 )::date as month
        )
        select to_char(s.month, 'Mon') as label,
               (select count(*)
                  from public.appointments a
                 where date_trunc('month', a.date) = s.month
                   and (%s = 'admin' or %s = 'staff' or a.lawyer_id = %s or a.client_id = %s)
               ) as value
          from span s
         order by s.month
        """,
        [user["role"], user["role"], user["id"], client_id],
    )

    top_lawyers = query_all(
        """
        select u.id, u.name, count(c.id) as cases
          from public.users u
          left join public.cases c on c.assigned_lawyer_id = u.id
         where u.role = 'lawyer' and u.is_active
         group by u.id, u.name
         order by cases desc, u.name
         limit 5
        """
    )

    by_status = {row["label"]: row["value"] for row in cases_by_status}
    consult_by_status = {row["label"]: row["value"] for row in consultations_by_status}

    return ok(
        {
            "casesByStatus": [
                {"label": status, "value": by_status.get(status, 0)} for status in CASE_STATUSES
            ],
            "consultationsByStatus": [
                {"label": status, "value": consult_by_status.get(status, 0)}
                for status in CONSULTATION_STATUSES
            ],
            "appointmentsByMonth": months,
            "topLawyers": [dict(row) for row in top_lawyers],
        }
    )


# ---------------------------------------------------------------------------
# GET /api/activity?limit=
# ---------------------------------------------------------------------------
@dashboard_bp.get("/activity")
@permission_required("activity.read")
def activity():
    user = current_user()
    limit = as_int(request.args.get("limit")) or 25

    rows = query_all(
        """
        select a.id, a.user_id, u.name as user_name, a.action, a.details, a.created_at
          from public.activity_logs a
          left join public.users u on u.id = a.user_id
         where (%s or a.user_id = %s)
         order by a.created_at desc
         limit %s
        """,
        [user["role"] == "admin", user["id"], limit],
    )
    return ok(rows)
