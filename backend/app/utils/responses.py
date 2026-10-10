"""JSON responses and input helpers shared by every blueprint.

The frontend's ``apiClient`` expects a bare JSON body for success and
``{"error": "..."}`` for failures, with the HTTP status carrying the meaning.
These helpers keep that contract in one place.
"""

from __future__ import annotations

from typing import Any, Iterable, Mapping

from flask import jsonify


# ---------------------------------------------------------------------------
# Success
# ---------------------------------------------------------------------------
def ok(payload: Any = None, status: int = 200):
    """200 with the payload (a list, a dict, or nothing at all)."""
    if payload is None:
        return ("", status)
    return jsonify(payload), status


def created(payload: Any):
    """201 for a newly created resource."""
    return jsonify(payload), 201


def no_content():
    """204 for a successful delete."""
    return ("", 204)


# ---------------------------------------------------------------------------
# Failures
# ---------------------------------------------------------------------------
def error(status: int, message: str):
    """The single error shape the client knows how to read."""
    return jsonify({"error": message, "status": status}), status


def bad_request(message: str = "The request could not be understood."):
    return error(400, message)


def unauthorized(message: str = "Sign in to continue."):
    return error(401, message)


def forbidden(message: str = "Your role does not allow this action."):
    return error(403, message)


def not_found(what: str = "Resource"):
    return error(404, f"{what} was not found.")


def conflict(message: str = "That conflicts with an existing record."):
    return error(409, message)


# ---------------------------------------------------------------------------
# Input helpers
# ---------------------------------------------------------------------------
def body_of(request) -> dict[str, Any]:
    """The JSON body as a dict, tolerating an empty or malformed body."""
    data = request.get_json(silent=True)
    return data if isinstance(data, dict) else {}


def clean(value: Any, default: str | None = None) -> str | None:
    """Trims a string; empty strings become ``default``."""
    if value is None:
        return default
    text = str(value).strip()
    return text or default


def as_int(value: Any) -> int | None:
    """Best-effort integer conversion (``None`` when it is not a number)."""
    if value is None or value == "":
        return None
    try:
        return int(str(value).strip())
    except (TypeError, ValueError):
        return None


def as_bool(value: Any, default: bool = False) -> bool:
    if value is None:
        return default
    return str(value).strip().lower() in {"1", "true", "yes", "on"}


def as_list(value: Any) -> list[str]:
    """Accepts a list, a comma-separated string, or nothing."""
    if value is None:
        return []
    if isinstance(value, (list, tuple, set)):
        return [str(item).strip() for item in value if str(item).strip()]
    return [item.strip() for item in str(value).split(",") if item.strip()]


def missing(*pairs: tuple[str, Any]) -> list[str]:
    """Names of the required fields that are empty — used for validation messages."""
    return [name for name, value in pairs if value in (None, "", [], {})]


def join_columns(mapping: Mapping[str, Any], allowed: Iterable[str]) -> dict[str, Any]:
    """Keeps only the keys the client is allowed to write."""
    allow = set(allowed)
    return {key: value for key, value in mapping.items() if key in allow and value is not None}
