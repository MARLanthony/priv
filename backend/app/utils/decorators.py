"""Request-scoped guards: authentication, permissions and audit logging.

Usage::

    from app.utils.decorators import auth_required, permission_required

    @bp.get("/cases")
    @auth_required
    def list_cases():
        user = current_user()          # the users row, without password_hash
        ...

    @bp.delete("/cases/<int:case_id>")
    @permission_required("cases.write")
    def delete_case(case_id):
        ...
"""

from __future__ import annotations

from functools import wraps
from typing import Any, Callable

from flask import g, request

from app.extensions import insert, query_one
from app.utils.rbac import role_has_permission
from app.utils.responses import forbidden, not_found, unauthorized
from app.utils.security import bearer_token, decode_token


# ---------------------------------------------------------------------------
# Current user
# ---------------------------------------------------------------------------
def current_user() -> dict[str, Any] | None:
    """The signed-in user row (cached on ``g`` for the duration of the request)."""
    if hasattr(g, "user"):
        return g.user

    header_token = bearer_token(request.headers.get("Authorization"))
    # Downloads happen in a new tab, where no header can be attached, so the
    # token is also accepted as a query parameter for GET requests only.
    query_token = request.args.get("token") if request.method == "GET" else None
    token = header_token or query_token

    payload = decode_token(token) if token else None
    user = None
    if payload:
        user = query_one(
            """
            select id, name, email, role, phone, address, avatar,
                   specialization, bar_number, is_active, created_at, updated_at
              from public.users
             where id = %s
            """,
            [payload.get("sub")],
        )
        if user and not user["is_active"]:
            user = None

    g.user = user
    return user


def client_record(user: dict[str, Any] | None) -> dict[str, Any] | None:
    """The ``clients`` row that belongs to a client login (``None`` for staff)."""
    if not user or user["role"] != "client":
        return None
    return query_one("select * from public.clients where user_id = %s", [user["id"]])


def scoped_client_id(user: dict[str, Any] | None) -> int | None:
    """The client id a *client* may read; ``None`` for the firm's own users."""
    record = client_record(user)
    return record["id"] if record else None


# ---------------------------------------------------------------------------
# Decorators
# ---------------------------------------------------------------------------
def auth_required(view: Callable) -> Callable:
    """401 unless a valid bearer token resolves to an active user."""

    @wraps(view)
    def wrapper(*args, **kwargs):
        if current_user() is None:
            return unauthorized()
        return view(*args, **kwargs)

    return wrapper


def role_required(*roles: str) -> Callable:
    """403 unless the signed-in user has one of the given roles."""

    def decorator(view: Callable) -> Callable:
        @wraps(view)
        def wrapper(*args, **kwargs):
            user = current_user()
            if user is None:
                return unauthorized()
            if user["role"] not in roles:
                return forbidden(f"This action is reserved for: {', '.join(roles)}.")
            return view(*args, **kwargs)

        return wrapper

    return decorator


def permission_required(permission: str) -> Callable:
    """403 unless the role grants the permission (mirrors ``utils/rbac``)."""

    def decorator(view: Callable) -> Callable:
        @wraps(view)
        def wrapper(*args, **kwargs):
            user = current_user()
            if user is None:
                return unauthorized()
            if not role_has_permission(user["role"], permission):
                return forbidden(f"Missing permission: {permission}.")
            return view(*args, **kwargs)

        return wrapper

    return decorator


# ---------------------------------------------------------------------------
# Audit trail
# ---------------------------------------------------------------------------
def record_activity(
    user: dict[str, Any] | None, action: str, details: str = ""
) -> None:
    """Appends to ``activity_logs`` — never raises, an audit failure is not fatal."""
    try:
        insert(
            "activity_logs",
            {
                "user_id": user["id"] if user else None,
                "action": action,
                "details": details[:800],
                "ip_address": request.headers.get("X-Forwarded-For", request.remote_addr),
            },
        )
    except Exception:  # pragma: no cover - defensive: logging must not break a request
        pass


def notify(user_id: int | None, kind: str, message: str, link: str | None = None) -> None:
    """Creates a notification row for ``user_id`` (silently ignored when null)."""
    if not user_id:
        return
    try:
        insert("notifications", {"user_id": user_id, "type": kind, "message": message, "link": link})
    except Exception:  # pragma: no cover
        pass


def require_row(row: dict[str, Any] | None, what: str):
    """Returns a 404 response when ``row`` is missing, otherwise ``None``."""
    return None if row else not_found(what)
