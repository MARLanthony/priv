"""JurisFlow API — application factory.

``create_app()`` wires the configuration, the database/Supabase extensions, CORS
and the blueprints, then installs JSON error handlers so the client never has to
parse an HTML page.

    from app import create_app

    app = create_app()          # development
    app.run(port=5000)

Production entry point: ``wsgi.py`` (``gunicorn wsgi:app``).
"""

from __future__ import annotations

import logging

from flask import Flask, jsonify
from flask_cors import CORS
from werkzeug.exceptions import HTTPException

from app.config import Config, config_for
from app.extensions import init_extensions

__version__ = "2.0.0"


def create_app(config_object: type[Config] | None = None) -> Flask:
    app = Flask(__name__, instance_relative_config=False)
    app.config.from_object(config_object or config_for())

    _configure_logging(app)
    _configure_cors(app)
    init_extensions(app)
    _register_blueprints(app)
    _register_error_handlers(app)

    @app.get("/api/health")
    def health():
        """Liveness probe used by the frontend and by deployment checks."""
        from app.extensions import storage_enabled

        return jsonify(
            {
                "status": "ok",
                "service": "jurisflow-api",
                "version": __version__,
                "storage": "supabase" if storage_enabled() else "local",
                "ai": bool(app.config.get("OPENROUTER_API_KEY")),
            }
        )

    app.logger.info("JurisFlow API %s ready (%s)", __version__, app.config.get("ENV", "development"))
    return app


# ---------------------------------------------------------------------------
# Internals
# ---------------------------------------------------------------------------
def _configure_logging(app: Flask) -> None:
    logging.basicConfig(
        level=logging.DEBUG if app.config.get("DEBUG") else logging.INFO,
        format="%(asctime)s %(levelname)-7s %(name)s: %(message)s",
    )


def _configure_cors(app: Flask) -> None:
    """The Vite dev server runs on another origin, so CORS is required locally."""
    origins = app.config.get("CORS_ORIGINS") or "*"
    CORS(
        app,
        resources={r"/api/*": {"origins": origins}},
        supports_credentials=True,
        allow_headers=["Content-Type", "Authorization"],
        methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    )


def _register_blueprints(app: Flask) -> None:
    from app.blueprints import ALL_BLUEPRINTS

    for blueprint in ALL_BLUEPRINTS:
        app.register_blueprint(blueprint, url_prefix="/api")


def _register_error_handlers(app: Flask) -> None:
    """Every failure leaves as ``{"error": "...", "status": n}``."""

    @app.errorhandler(HTTPException)
    def handle_http_error(error: HTTPException):  # pragma: no cover - thin wrapper
        return jsonify({"error": error.description, "status": error.code}), error.code

    @app.errorhandler(Exception)
    def handle_unexpected(error: Exception):  # pragma: no cover
        app.logger.exception("Unhandled error: %s", error)
        return (
            jsonify({"error": "Something went wrong on our side.", "status": 500}),
            500,
        )
