"""Notification inbox — ``/api/notifications``.

Every row belongs to exactly one user; the API never returns somebody else's.
Other blueprints call ``notify()`` to create rows (an approved consultation, a
moved appointment, a reviewed document).
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
    ok,
    permission_required,
    record_activity,
)
from app.utils.responses import bad_request, forbidden, no_content, not_found

notifications_bp = Blueprint("notifications", __name__)

TYPES = ("consultation", "appointment", "case", "document", "system")


def _settings_payload(row: dict | None) -> dict:
    """Database row → the camelCase shape the settings screen expects."""
    base = {
        "email": True, "inApp": True,
        "consultations": True, "appointments": True, "documents": True,
    }
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
    return base


# ---------------------------------------------------------------------------
# GET /api/notifications?isRead=&limit=
# ---------------------------------------------------------------------------
@notifications_bp.get("/notifications")
@permission_required("notifications.read")
def list_notifications():
    user = current_user()
    limit = as_int(request.args.get("limit")) or 25
    raw = request.args.get("isRead")
    is_read = None if raw in (None, "") else as_bool(raw)

    rows = query_all(
        """
        select id, user_id, type, message, link, is_read, created_at
          from public.notifications
         where user_id = %s and (%s is null or is_read = %s)
         order by created_at desc
         limit %s
        """,
        [user["id"], is_read, is_read, limit],
    )
    return ok(rows)


# ---------------------------------------------------------------------------
# GET /api/notifications/unread-count
# ---------------------------------------------------------------------------
@notifications_bp.get("/notifications/unread-count")
@permission_required("notifications.read")
def unread_count():
    user = current_user()
    row = query_one(
        "select count(*) as count from public.notifications where user_id = %s and not is_read",
        [user["id"]],
    )
    return ok({"count": row["count"] if row else 0})


# ---------------------------------------------------------------------------
# POST /api/notifications/read-all   (declared before /<id>/read)
# ---------------------------------------------------------------------------
@notifications_bp.post("/notifications/read-all")
@permission_required("notifications.read")
def mark_all_read():
    user = current_user()
    updated = execute(
        "update public.notifications set is_read = true where user_id = %s and not is_read",
        [user["id"]],
    )
    return ok({"updated": updated})


# ---------------------------------------------------------------------------
# GET / PUT /api/notifications/settings
# ---------------------------------------------------------------------------
@notifications_bp.get("/notifications/settings")
@permission_required("notifications.settings")
def get_settings():
    user = current_user()
    row = query_one("select * from public.notification_settings where user_id = %s", [user["id"]])
    if row is None:
        insert("notification_settings", {"user_id": user["id"]})
    return ok(_settings_payload(row))


@notifications_bp.put("/notifications/settings")
@permission_required("notifications.settings")
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
    existing = query_one(
        "select user_id from public.notification_settings where user_id = %s", [user["id"]]
    )
    row = (
        update("notification_settings", values, "user_id = %s", [user["id"]])
        if existing
        else insert("notification_settings", {**values, "user_id": user["id"]})
    )
    return ok(_settings_payload(row))


# ---------------------------------------------------------------------------
# POST /api/notifications — internal helper (staff and up)
# ---------------------------------------------------------------------------
@notifications_bp.post("/notifications")
@auth_required
def create_notification():
    actor = current_user()
    if actor["role"] == "client":
        return forbidden("A client cannot create notifications for others.")

    data = body_of(request)
    target_id = as_int(data.get("userId"))
    kind = clean(data.get("type"), "system")
    message = clean(data.get("message"))

    if not target_id or not message:
        return bad_request("Provide userId and message.")
    if kind not in TYPES:
        return bad_request(f"Type must be one of: {', '.join(TYPES)}.")
    if not query_one("select id from public.users where id = %s", [target_id]):
        return not_found(f"User #{target_id}")

    row = insert(
        "notifications",
        {"user_id": target_id, "type": kind, "message": message, "link": clean(data.get("link"))},
    )
    record_activity(actor, "notification.create", f"Notified user #{target_id}.")
    return ok(row, 201)


# ---------------------------------------------------------------------------
# PATCH /api/notifications/<id>/read
# ---------------------------------------------------------------------------
@notifications_bp.patch("/notifications/<int:notification_id>/read")
@permission_required("notifications.read")
def mark_read(notification_id: int):
    user = current_user()
    row = query_one("select user_id from public.notifications where id = %s", [notification_id])
    if not row:
        return not_found(f"Notification #{notification_id}")
    if row["user_id"] != user["id"]:
        return forbidden("This notification belongs to another account.")
    return ok(update("notifications", {"is_read": True}, "id = %s", [notification_id]))


# ---------------------------------------------------------------------------
# DELETE /api/notifications/<id>
# ---------------------------------------------------------------------------
@notifications_bp.delete("/notifications/<int:notification_id>")
@permission_required("notifications.read")
def delete_notification(notification_id: int):
    user = current_user()
    row = query_one("select user_id from public.notifications where id = %s", [notification_id])
    if not row:
        return not_found(f"Notification #{notification_id}")
    if row["user_id"] != user["id"]:
        return forbidden("This notification belongs to another account.")

    execute("delete from public.notifications where id = %s", [notification_id])
    return no_content()
