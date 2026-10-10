"""Reference data — ``/api/faqs`` and ``/api/services``.

Both are small catalogues: every signed-in role may read them (the client portal
shows the FAQs and the intake form lists the practice areas), while writing needs
``faqs.write`` (FAQs) or the admin role (services).
"""

from __future__ import annotations

from flask import Blueprint, request

from app.extensions import execute, insert, query_all, query_one, update
from app.utils import (
    as_bool,
    auth_required,
    body_of,
    clean,
    current_user,
    missing,
    ok,
    permission_required,
    record_activity,
    role_required,
)
from app.utils.responses import bad_request, conflict, no_content, not_found

faqs_bp = Blueprint("faqs", __name__)
services_bp = Blueprint("services", __name__)


# ---------------------------------------------------------------------------
# FAQs
# ---------------------------------------------------------------------------
@faqs_bp.get("/faqs")
@auth_required
def list_faqs():
    category = clean(request.args.get("category"))
    term = clean(request.args.get("q"))

    rows = query_all(
        """
        select f.id, f.question, f.answer, f.category, f.created_by,
               u.name as created_by_name, f.created_at, f.updated_at
          from public.faqs f
          left join public.users u on u.id = f.created_by
         where (%s is null or lower(f.category) = lower(%s))
           and (
                 %s is null
                 or f.question ilike '%%' || %s || '%%'
                 or f.answer ilike '%%' || %s || '%%'
               )
         order by f.category, f.question
        """,
        [category, category, term, term, term],
    )
    return ok(rows)


@faqs_bp.post("/faqs")
@permission_required("faqs.write")
def create_faq():
    actor = current_user()
    data = body_of(request)
    question = clean(data.get("question"))
    answer = clean(data.get("answer"))

    problems = missing(("question", question), ("answer", answer))
    if problems:
        return bad_request(f"Missing: {', '.join(problems)}.")

    row = insert(
        "faqs",
        {
            "question": question,
            "answer": answer,
            "category": clean(data.get("category"), "General"),
            "created_by": actor["id"],
        },
    )
    record_activity(actor, "faq.create", f"Added the FAQ “{question[:60]}”.")
    return ok(row, 201)


@faqs_bp.put("/faqs/<int:faq_id>")
@permission_required("faqs.write")
def update_faq(faq_id: int):
    actor = current_user()
    if not query_one("select id from public.faqs where id = %s", [faq_id]):
        return not_found(f"FAQ #{faq_id}")

    data = body_of(request)
    values = {
        key: clean(data.get(key)) for key in ("question", "answer", "category") if key in data
    }
    if not values:
        return bad_request("Nothing to update.")

    record_activity(actor, "faq.update", f"Updated FAQ #{faq_id}.")
    return ok(update("faqs", values, "id = %s", [faq_id]))


@faqs_bp.delete("/faqs/<int:faq_id>")
@permission_required("faqs.write")
def delete_faq(faq_id: int):
    actor = current_user()
    row = query_one("select question from public.faqs where id = %s", [faq_id])
    if not row:
        return not_found(f"FAQ #{faq_id}")

    execute("delete from public.faqs where id = %s", [faq_id])
    record_activity(actor, "faq.delete", f"Deleted the FAQ “{row['question'][:60]}”.")
    return no_content()


# ---------------------------------------------------------------------------
# Legal services (practice areas)
# ---------------------------------------------------------------------------
@services_bp.get("/services")
@auth_required
def list_services():
    # `isActive=true` filters to what clients may choose from; the admin
    # catalogue asks for everything.
    only_active = as_bool(request.args.get("isActive"))

    rows = query_all(
        """
        select id, name, description, is_active, created_at, updated_at
          from public.legal_services
         where (not %s or is_active)
         order by is_active desc, name
        """,
        [only_active],
    )
    return ok(rows)


@services_bp.post("/services")
@role_required("admin")
def create_service():
    actor = current_user()
    data = body_of(request)
    name = clean(data.get("name"))
    if not name:
        return bad_request("A practice area needs a name.")
    if query_one("select id from public.legal_services where lower(name) = lower(%s)", [name]):
        return conflict("That practice area already exists.")

    row = insert(
        "legal_services",
        {
            "name": name,
            "description": clean(data.get("description"), ""),
            "is_active": bool(data.get("isActive", True)),
            "created_by": actor["id"],
        },
    )
    record_activity(actor, "service.create", f"Added the practice area {name}.")
    return ok(row, 201)


@services_bp.put("/services/<int:service_id>")
@role_required("admin")
def update_service(service_id: int):
    actor = current_user()
    if not query_one("select id from public.legal_services where id = %s", [service_id]):
        return not_found(f"Service #{service_id}")

    data = body_of(request)
    values: dict = {}
    if "name" in data:
        values["name"] = clean(data.get("name"))
    if "description" in data:
        values["description"] = clean(data.get("description"), "")
    if "isActive" in data:
        values["is_active"] = bool(data.get("isActive"))
    if not values:
        return bad_request("Nothing to update.")

    record_activity(actor, "service.update", f"Updated practice area #{service_id}.")
    return ok(update("legal_services", values, "id = %s", [service_id]))


@services_bp.delete("/services/<int:service_id>")
@role_required("admin")
def delete_service(service_id: int):
    actor = current_user()
    row = query_one("select name from public.legal_services where id = %s", [service_id])
    if not row:
        return not_found(f"Service #{service_id}")

    # Consultations keep working: `service_id` is ON DELETE SET NULL.
    execute("delete from public.legal_services where id = %s", [service_id])
    record_activity(actor, "service.delete", f"Deleted the practice area {row['name']}.")
    return no_content()
