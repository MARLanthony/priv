"""Roles & permissions — ``/api/permissions`` and ``/api/roles``.

The admin edits the role → permission matrix here; ``utils/rbac.py`` mirrors it
so the API can answer "may this role do X?" without a query on every request.
"""

from __future__ import annotations

from flask import Blueprint, request

from app.extensions import execute, insert, query_all
from app.utils import (
    PERMISSIONS,
    ROLES,
    body_of,
    current_user,
    ok,
    record_activity,
    role_required,
)
from app.utils.responses import bad_request, not_found

roles_bp = Blueprint("roles", __name__)

# Labels and grouping — mirrors `PERMISSION_GROUPS` in the frontend.
PERMISSION_META: dict[str, tuple[str, str]] = {
    "users.read": ("View users", "Users & roles"),
    "users.write": ("Create / edit users", "Users & roles"),
    "roles.manage": ("Manage roles & permissions", "Users & roles"),
    "clients.read": ("View clients", "Clients"),
    "clients.write": ("Create / edit clients", "Clients"),
    "cases.read": ("View cases", "Cases"),
    "cases.write": ("Create / edit cases", "Cases"),
    "consultations.read": ("View consultations", "Consultations"),
    "consultations.review": ("Approve / decline consultations", "Consultations"),
    "appointments.read": ("View appointments", "Appointments"),
    "appointments.write": ("Schedule / edit appointments", "Appointments"),
    "documents.read": ("View documents", "Documents"),
    "documents.write": ("Upload / manage documents", "Documents"),
    "nlp.run": ("Run AI case analysis", "AI analysis"),
    "faqs.read": ("View FAQs", "Knowledge & FAQs"),
    "faqs.write": ("Manage FAQs", "Knowledge & FAQs"),
    "notifications.read": ("View notifications", "Notifications"),
    "notifications.settings": ("Change notification settings", "Notifications"),
    "reports.read": ("View reports", "Firm"),
    "activity.read": ("View activity logs", "Firm"),
    "settings.manage": ("Manage firm settings", "Firm"),
}


# ---------------------------------------------------------------------------
# GET /api/permissions — the catalogue
# ---------------------------------------------------------------------------
@roles_bp.get("/permissions")
@role_required("admin")
def list_permissions():
    rows = query_all(
        "select code, label, group_label from public.permissions order by group_label, code"
    )
    if rows:
        return ok(rows)

    # A fresh install without the seeder still answers, from the built-in matrix.
    return ok(
        [
            {
                "code": code,
                "label": PERMISSION_META.get(code, (code, "Other"))[0],
                "group_label": PERMISSION_META.get(code, (code, "Other"))[1],
            }
            for code in PERMISSIONS
        ]
    )


# ---------------------------------------------------------------------------
# GET /api/roles/permissions — the whole matrix
# ---------------------------------------------------------------------------
@roles_bp.get("/roles/permissions")
@role_required("admin")
def list_role_permissions():
    rows = query_all(
        """
        select rp.id, rp.role, rp.permission, rp.created_at
          from public.role_permissions rp
         order by rp.role, rp.permission
        """
    )
    return ok(rows)


# ---------------------------------------------------------------------------
# GET /api/roles/<role>/permissions — one row of the matrix
# ---------------------------------------------------------------------------
@roles_bp.get("/roles/<string:role>/permissions")
@role_required("admin")
def list_permissions_for_role(role: str):
    if role not in ROLES:
        return not_found(f"Role {role}")

    rows = query_all(
        "select permission from public.role_permissions where role = %s order by permission",
        [role],
    )
    if rows:
        return ok([row["permission"] for row in rows])

    from app.utils import ROLE_PERMISSIONS

    return ok(sorted(ROLE_PERMISSIONS.get(role, frozenset())))


# ---------------------------------------------------------------------------
# PUT /api/roles/<role>/permissions — replace a role's grants
# ---------------------------------------------------------------------------
@roles_bp.put("/roles/<string:role>/permissions")
@role_required("admin")
def save_permissions_for_role(role: str):
    actor = current_user()
    if role not in ROLES:
        return not_found(f"Role {role}")

    data = body_of(request)
    requested = data.get("permissions")
    if not isinstance(requested, list):
        return bad_request("Send the permissions as a list.")

    unknown = [code for code in requested if code not in PERMISSIONS]
    if unknown:
        return bad_request(f"Unknown permission(s): {', '.join(unknown)}.")

    # The owner keeps the keys to the house: the admin role can never lose
    # `roles.manage`, or the screen that fixes mistakes would be unreachable.
    if role == "admin" and "roles.manage" not in requested:
        return bad_request("The admin role must keep roles.manage.")

    execute("delete from public.role_permissions where role = %s", [role])
    for code in sorted(set(requested)):
        insert("role_permissions", {"role": role, "permission": code})

    record_activity(actor, "roles.update", f"Updated the {role} permission matrix.")

    rows = query_all(
        """
        select rp.id, rp.role, rp.permission, rp.created_at
          from public.role_permissions rp
         where rp.role = %s
         order by rp.permission
        """,
        [role],
    )
    return ok(rows)
