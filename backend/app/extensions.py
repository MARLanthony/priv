"""Shared resources: the Postgres pool, the Supabase client and small helpers.

The API talks to Supabase two ways:

* **Postgres** (``psycopg2``) for every read and write. A tiny connection pool
  lives for the lifetime of the process and hands out short-lived connections
  per request.
* **Storage** (``supabase-py``) for uploads when a service key is configured;
  otherwise files are written to ``UPLOAD_FOLDER`` so local development works
  without a bucket.
"""

from __future__ import annotations

import logging
from contextlib import contextmanager
from typing import Any, Iterable, Iterator, Sequence

import psycopg2
import psycopg2.extras
from flask import Flask, current_app
from psycopg2.extensions import connection as PgConnection

log = logging.getLogger(__name__)

_pool: psycopg2.pool.SimpleConnectionPool | None = None
_supabase: Any = None


def init_extensions(app: Flask) -> None:
    """Creates the connection pool and the Supabase client for this process."""
    global _pool, _supabase

    _pool = psycopg2.pool.SimpleConnectionPool(
        app.config["DB_POOL_MIN"],
        app.config["DB_POOL_MAX"],
        dsn=app.config["DATABASE_URL"],
        cursor_factory=psycopg2.extras.RealDictCursor,
    )

    if app.config["SUPABASE_URL"] and app.config["SUPABASE_SERVICE_KEY"]:
        try:  # pragma: no cover - requires network/credentials
            from supabase import create_client

            _supabase = create_client(
                app.config["SUPABASE_URL"], app.config["SUPABASE_SERVICE_KEY"]
            )
            log.info("Supabase Storage enabled (bucket=%s)", app.config["SUPABASE_STORAGE_BUCKET"])
        except Exception as exc:  # pragma: no cover - optional dependency path
            _supabase = None
            log.warning("Supabase client unavailable, falling back to local uploads: %s", exc)


@contextmanager
def get_connection() -> Iterator[PgConnection]:
    """Borrows a pooled connection and always returns it (rolling back on error)."""
    if _pool is None:  # pragma: no cover - guards against import-order mistakes
        raise RuntimeError("Database pool is not initialised; call init_extensions(app) first.")

    connection = _pool.getconn()
    try:
        yield connection
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        _pool.putconn(connection)


def query_all(sql: str, params: Sequence[Any] | None = None) -> list[dict[str, Any]]:
    """Runs a SELECT and returns every row as a dict."""
    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(sql, params or ())
            return [dict(row) for row in cursor.fetchall()]


def query_one(sql: str, params: Sequence[Any] | None = None) -> dict[str, Any] | None:
    """Runs a SELECT and returns the first row (or ``None``)."""
    rows = query_all(sql, params)
    return rows[0] if rows else None


def execute(sql: str, params: Sequence[Any] | None = None) -> int:
    """Runs a statement and returns the affected row count."""
    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(sql, params or ())
            return cursor.rowcount


def execute_returning(sql: str, params: Sequence[Any] | None = None) -> dict[str, Any] | None:
    """Runs an INSERT/UPDATE ... RETURNING and returns the row."""
    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(sql, params or ())
            row = cursor.fetchone()
            return dict(row) if row else None


def insert(table: str, payload: dict[str, Any], returning: str = "*") -> dict[str, Any] | None:
    """Small convenience wrapper: ``INSERT INTO table (cols) VALUES (...) RETURNING``."""
    columns = list(payload.keys())
    placeholders = ", ".join(["%s"] * len(columns))
    sql = (
        f"INSERT INTO public.{table} ({', '.join(columns)}) "
        f"VALUES ({placeholders}) RETURNING {returning}"
    )
    return execute_returning(sql, [payload[column] for column in columns])


def update(
    table: str,
    values: dict[str, Any],
    where: str,
    params: Iterable[Any] = (),
    returning: str = "*",
) -> dict[str, Any] | None:
    """``UPDATE table SET col = %s, ... WHERE <where> RETURNING``."""
    assignments = ", ".join(f"{column} = %s" for column in values)
    sql = f"UPDATE public.{table} SET {assignments} WHERE {where} RETURNING {returning}"
    return execute_returning(sql, [*values.values(), *params])


# ---------------------------------------------------------------------------
# Storage
# ---------------------------------------------------------------------------
def storage_enabled() -> bool:
    return _supabase is not None


def upload_bytes(path: str, data: bytes, content_type: str | None = None) -> str:
    """Stores a file and returns the path the database should record."""
    if _supabase is not None:  # pragma: no cover - requires Supabase
        bucket = current_app.config["SUPABASE_STORAGE_BUCKET"]
        _supabase.storage.from_(bucket).upload(
            path,
            data,
            {"content-type": content_type or "application/octet-stream", "upsert": "true"},
        )
        return path

    import os

    target = os.path.join(current_app.config["UPLOAD_FOLDER"], path)
    os.makedirs(os.path.dirname(target), exist_ok=True)
    with open(target, "wb") as handle:
        handle.write(data)
    return path


def signed_url(path: str, expires_in: int = 3600) -> str | None:
    """A time-limited download URL (Supabase only); ``None`` when local."""
    if _supabase is None:  # pragma: no cover - requires Supabase
        return None

    bucket = current_app.config["SUPABASE_STORAGE_BUCKET"]
    result = _supabase.storage.from_(bucket).create_signed_url(path, expires_in)
    return result.get("signedURL") or result.get("signed_url")
