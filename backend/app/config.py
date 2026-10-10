"""Application configuration.

Every value comes from the environment (``backend/.env`` in development) so the
same image can run locally, in CI and on a host without code changes. Defaults
are development-friendly; production must override the secrets.
"""

from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent

# Load backend/.env once, before any os.environ lookups below.
load_dotenv(BASE_DIR / ".env")


def _bool(name: str, default: bool = False) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


def _int(name: str, default: int) -> int:
    try:
        return int(os.getenv(name, str(default)))
    except (TypeError, ValueError):
        return default


def _list(name: str, default: str = "") -> list[str]:
    raw = os.getenv(name, default)
    return [item.strip() for item in raw.split(",") if item.strip()]


class Config:
    """Base configuration shared by every environment."""

    # --- Flask ----------------------------------------------------------
    SECRET_KEY = os.getenv("SECRET_KEY", "jurisflow-dev-secret")
    JSON_SORT_KEYS = False
    PROPAGATE_EXCEPTIONS = True

    # --- Auth -----------------------------------------------------------
    JWT_SECRET = os.getenv("JWT_SECRET", os.getenv("SECRET_KEY", "jurisflow-dev-secret"))
    JWT_EXPIRY_HOURS = _int("JWT_EXPIRY_HOURS", 12)

    # --- CORS -----------------------------------------------------------
    CORS_ORIGINS = _list(
        "CORS_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173",
    )

    # --- Database -------------------------------------------------------
    DATABASE_URL = os.getenv(
        "DATABASE_URL", "postgresql://postgres:postgres@127.0.0.1:54322/postgres"
    )
    DB_POOL_MIN = _int("DB_POOL_MIN", 1)
    DB_POOL_MAX = _int("DB_POOL_MAX", 8)

    # --- Supabase -------------------------------------------------------
    SUPABASE_URL = os.getenv("SUPABASE_URL", "")
    SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY", "")
    SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY", "")
    SUPABASE_STORAGE_BUCKET = os.getenv("SUPABASE_STORAGE_BUCKET", "documents")

    # --- AI -------------------------------------------------------------
    OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY", "")
    OPENROUTER_BASE_URL = os.getenv("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1")
    OPENROUTER_MODEL = os.getenv("OPENROUTER_MODEL", "deepseek/deepseek-r1:free")
    OPENROUTER_FALLBACK_MODEL = os.getenv(
        "OPENROUTER_FALLBACK_MODEL", "deepseek/deepseek-r1-distill-llama-70b:free"
    )
    OPENROUTER_APP_NAME = os.getenv("OPENROUTER_APP_NAME", "JurisFlow")
    OPENROUTER_SITE_URL = os.getenv("OPENROUTER_SITE_URL", "http://localhost:5173")
    AI_TIMEOUT_SECONDS = _int("AI_TIMEOUT_SECONDS", 90)

    # --- Uploads --------------------------------------------------------
    UPLOAD_FOLDER = os.getenv("UPLOAD_FOLDER", str(BASE_DIR / "uploads"))
    MAX_CONTENT_LENGTH_MB = _int("MAX_CONTENT_LENGTH_MB", 25)
    MAX_CONTENT_LENGTH = MAX_CONTENT_LENGTH_MB * 1024 * 1024

    # --- Bootstrap ------------------------------------------------------
    DEBUG = _bool("FLASK_DEBUG", True)
    TESTING = False


class ProductionConfig(Config):  # pragma: no cover - selected by FLASK_ENV
    DEBUG = False


def config_for(env: str | None = None) -> type[Config]:
    """Returns the config class for ``FLASK_ENV`` (defaults to development)."""
    name = (env or os.getenv("FLASK_ENV") or "development").lower()
    return ProductionConfig if name.startswith("prod") else Config
