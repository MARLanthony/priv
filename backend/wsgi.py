"""WSGI entry point.

Development::

    python -m flask --app wsgi:app run --debug

Production::

    gunicorn --bind 0.0.0.0:5000 wsgi:app
"""

from app import create_app

app = create_app()

if __name__ == "__main__":  # pragma: no cover - manual run helper
    import os

    app.run(host="0.0.0.0", port=int(os.getenv("PORT", "5000")), debug=app.config["DEBUG"])
