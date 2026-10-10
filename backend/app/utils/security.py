"""Password hashing and JWT issuing/verification.

Passwords use **bcrypt**, the same ``$2a$`` scheme the SQL seeder produces with
pgcrypto (``crypt(password, gen_salt('bf', 12))``), so a seeded demo account and
an account created through ``POST /api/users`` behave identically. Legacy
``pbkdf2:sha256`` hashes are still accepted so an imported database keeps working.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

import bcrypt
import jwt
from flask import current_app


# ---------------------------------------------------------------------------
# Passwords
# ---------------------------------------------------------------------------
def hash_password(raw: str) -> str:
    """bcrypt hash of the password (12 rounds, matching the SQL seeder)."""
    return bcrypt.hashpw(raw.encode("utf-8"), bcrypt.gensalt(rounds=12)).decode("utf-8")


def verify_password(raw: str, stored: str | None) -> bool:
    """True when ``raw`` matches ``stored`` (bcrypt, with a pbkdf2 fallback)."""
    if not stored:
        return False

    if stored.startswith(("$2a$", "$2b$", "$2y$")):
        try:
            return bcrypt.checkpw(raw.encode("utf-8"), stored.encode("utf-8"))
        except ValueError:
            return False

    if stored.startswith("pbkdf2:"):  # pragma: no cover - legacy databases
        try:
            from werkzeug.security import check_password_hash

            return check_password_hash(stored, raw)
        except Exception:
            return False

    return False


# ---------------------------------------------------------------------------
# Tokens
# ---------------------------------------------------------------------------
def issue_token(user: dict[str, Any]) -> str:
    """A signed JWT carrying the user id, role and e-mail."""
    expiry_hours = current_app.config.get("JWT_EXPIRY_HOURS", 12)
    now = datetime.now(tz=timezone.utc)
    payload = {
        "sub": str(user["id"]),
        "role": user["role"],
        "email": user["email"],
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(hours=expiry_hours)).timestamp()),
    }
    return jwt.encode(
        payload, current_app.config["JWT_SECRET"], algorithm="HS256"
    )


def decode_token(token: str) -> dict[str, Any] | None:
    """Decodes a token, returning ``None`` when it is invalid or expired."""
    try:
        return jwt.decode(token, current_app.config["JWT_SECRET"], algorithms=["HS256"])
    except jwt.PyJWTError:
        return None


def bearer_token(header_value: str | None) -> str | None:
    """Extracts the token from an ``Authorization: Bearer <t>`` header."""
    if not header_value:
        return None
    parts = header_value.split()
    if len(parts) == 2 and parts[0].lower() == "bearer":
        return parts[1]
    return None
