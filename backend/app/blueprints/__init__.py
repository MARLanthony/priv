"""Blueprint registry.

Imported by ``create_app`` — the order only matters for readability, since every
blueprint owns a distinct URL prefix. Each module maps 1:1 onto a group of
endpoints in the frontend's ``src/services``.
"""

from app.blueprints.ai import ai_bp
from app.blueprints.appointments import appointments_bp
from app.blueprints.auth import auth_bp
from app.blueprints.cases import cases_bp
from app.blueprints.clients import clients_bp
from app.blueprints.consultations import consultations_bp
from app.blueprints.dashboard import dashboard_bp
from app.blueprints.documents import documents_bp
from app.blueprints.faqs import faqs_bp, services_bp
from app.blueprints.knowledge import knowledge_bp
from app.blueprints.notifications import notifications_bp
from app.blueprints.roles import roles_bp
from app.blueprints.users import users_bp

ALL_BLUEPRINTS = (
    auth_bp,
    users_bp,
    clients_bp,
    cases_bp,
    consultations_bp,
    appointments_bp,
    documents_bp,
    notifications_bp,
    faqs_bp,
    services_bp,
    knowledge_bp,
    roles_bp,
    dashboard_bp,
    ai_bp,
)

__all__ = ["ALL_BLUEPRINTS"]
