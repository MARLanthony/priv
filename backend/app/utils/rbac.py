"""Role-based access control — the server-side authority.

Keep this matrix in sync with:

* ``frontend/src/utils/rbac.ts`` (used to hide navigation and buttons), and
* ``database/seeders/002_role_permissions.sql`` (what the database stores and
  what the admin edits on the settings screen).

The API re-checks every route: hiding a button in the browser is a convenience,
never a security control.
"""

from __future__ import annotations

from typing import Iterable

ROLES: tuple[str, ...] = ("admin", "lawyer", "staff", "client")

PERMISSIONS: tuple[str, ...] = (
    "users.read", "users.write",
    "roles.manage",
    "clients.read", "clients.write",
    "cases.read", "cases.write",
    "consultations.read", "consultations.review",
    "appointments.read", "appointments.write",
    "documents.read", "documents.write",
    "nlp.run",
    "faqs.read", "faqs.write",
    "notifications.read", "notifications.settings",
    "reports.read",
    "activity.read",
    "settings.manage",
)

ROLE_PERMISSIONS: dict[str, frozenset[str]] = {
    "admin": frozenset(PERMISSIONS),
    "lawyer": frozenset({
        "clients.read", "clients.write",
        "cases.read", "cases.write",
        "consultations.read", "consultations.review",
        "appointments.read", "appointments.write",
        "documents.read", "documents.write",
        "nlp.run",
        "faqs.read", "faqs.write",
        "notifications.read", "notifications.settings",
        "reports.read", "activity.read",
    }),
    "staff": frozenset({
        "clients.read", "clients.write",
        "cases.read", "cases.write",
        "consultations.read",
        "appointments.read", "appointments.write",
        "documents.read", "documents.write",
        "nlp.run",
        "faqs.read",
        "notifications.read", "notifications.settings",
        "activity.read",
    }),
    "client": frozenset({
        "cases.read",
        "consultations.read",
        "appointments.read", "appointments.write",
        "documents.read", "documents.write",
        "nlp.run",
        "faqs.read",
        "notifications.read", "notifications.settings",
    }),
}


def role_has_permission(role: str | None, permission: str) -> bool:
    """True when the role grants the permission (unknown roles grant nothing)."""
    if not role:
        return False
    return permission in ROLE_PERMISSIONS.get(role, frozenset())


def role_has_any(role: str | None, permissions: Iterable[str]) -> bool:
    return any(role_has_permission(role, permission) for permission in permissions)


def permissions_for(role: str | None) -> list[str]:
    """The permissions to return to the browser after signing in."""
    if not role:
        return []
    return [code for code in PERMISSIONS if code in ROLE_PERMISSIONS.get(role, frozenset())]


def load_role_permissions(rows: Iterable[dict]) -> dict[str, set[str]]:
    """Turns ``role_permissions`` rows into ``{role: {permission, ...}}``.

    Used by the settings screen and to honour an admin's edits at request time:
    the database copy wins when it is present, the built-in matrix is the
    fallback for a fresh install.
    """
    matrix: dict[str, set[str]] = {role: set() for role in ROLES}
    for row in rows:
        role = row.get("role")
        permission = row.get("permission")
        if role in matrix and permission:
            matrix[role].add(permission)

    for role in ROLES:
        if not matrix[role]:
            matrix[role] = set(ROLE_PERMISSIONS[role])
    return matrix
