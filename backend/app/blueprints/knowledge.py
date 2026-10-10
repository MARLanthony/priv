"""Knowledge base — ``/api/knowledge/articles``.

The articles ground the AI: the frontend matcher scores keywords/services, and
the model is told to cite these titles. Full-text search uses the generated
``search_document`` column from migration 010.
"""

from __future__ import annotations

from flask import Blueprint, request

from app.extensions import execute, insert, query_all, query_one, update
from app.utils import (
    as_list,
    auth_required,
    body_of,
    clean,
    current_user,
    ok,
    permission_required,
    record_activity,
)
from app.utils.responses import bad_request, no_content, not_found

knowledge_bp = Blueprint("knowledge", __name__)

ARTICLE_COLUMNS = """
    k.id, k.title, k.category, k.keywords, k.summary, k.content,
    k.attorney_specialist, k.services_needed, k.status, k.match_count,
    k.created_by, u.name as created_by_name, k.created_at, k.updated_at
"""


def _load(article_id: int) -> dict | None:
    return query_one(
        f"""
        select {ARTICLE_COLUMNS}
          from public.knowledge_articles k
          left join public.users u on u.id = k.created_by
         where k.id = %s
        """,
        [article_id],
    )


# ---------------------------------------------------------------------------
# GET /api/knowledge/articles?status=&category=&q=
# ---------------------------------------------------------------------------
@knowledge_bp.get("/knowledge/articles")
@auth_required
def list_articles():
    user = current_user()
    status = clean(request.args.get("status"))
    category = clean(request.args.get("category"))
    term = clean(request.args.get("q"))

    # A client only reads published guidance; staff and up see the drafts too.
    if user["role"] == "client" and status is None:
        status = "published"

    rows = query_all(
        f"""
        select {ARTICLE_COLUMNS}
          from public.knowledge_articles k
          left join public.users u on u.id = k.created_by
         where (%s is null or k.status = %s)
           and (%s is null or lower(k.category) = lower(%s))
           and (
                 %s is null
                 or k.search_document @@ websearch_to_tsquery('english', %s)
                 or k.title ilike '%%' || %s || '%%'
                 or exists (
                      select 1 from unnest(k.keywords) kw where kw ilike '%%' || %s || '%%'
                    )
               )
         order by k.match_count desc, k.title
        """,
        [status, status, category, category, term, term, term, term],
    )
    return ok(rows)


# ---------------------------------------------------------------------------
# GET /api/knowledge/articles/<id>
# ---------------------------------------------------------------------------
@knowledge_bp.get("/knowledge/articles/<int:article_id>")
@auth_required
def get_article(article_id: int):
    user = current_user()
    row = _load(article_id)
    if not row:
        return not_found(f"Article #{article_id}")
    if row["status"] != "published" and user["role"] not in ("admin", "lawyer", "staff"):
        return not_found(f"Article #{article_id}")
    return ok(row)


# ---------------------------------------------------------------------------
# POST /api/knowledge/articles
# ---------------------------------------------------------------------------
@knowledge_bp.post("/knowledge/articles")
@permission_required("faqs.write")
def create_article():
    actor = current_user()
    data = body_of(request)
    title = clean(data.get("title"))

    if not title:
        return bad_request("An article needs a title.")

    row = insert(
        "knowledge_articles",
        {
            "title": title,
            "category": clean(data.get("category"), "General"),
            "keywords": [word.lower() for word in as_list(data.get("keywords"))],
            "summary": clean(data.get("summary"), ""),
            "content": clean(data.get("content"), ""),
            "attorney_specialist": clean(data.get("attorneySpecialist"), ""),
            "services_needed": as_list(data.get("servicesNeeded")),
            "status": clean(data.get("status"), "draft"),
            "created_by": actor["id"],
        },
    )
    record_activity(actor, "article.create", f"Added the article “{title[:60]}”.")
    return ok(_load(row["id"]), 201)


# ---------------------------------------------------------------------------
# PUT /api/knowledge/articles/<id>
# ---------------------------------------------------------------------------
@knowledge_bp.put("/knowledge/articles/<int:article_id>")
@permission_required("faqs.write")
def update_article(article_id: int):
    actor = current_user()
    if not _load(article_id):
        return not_found(f"Article #{article_id}")

    data = body_of(request)
    values: dict = {}
    for key, column in (
        ("title", "title"),
        ("category", "category"),
        ("summary", "summary"),
        ("content", "content"),
        ("attorneySpecialist", "attorney_specialist"),
        ("status", "status"),
    ):
        if key in data:
            values[column] = clean(data.get(key))
    if "keywords" in data:
        values["keywords"] = [word.lower() for word in as_list(data.get("keywords"))]
    if "servicesNeeded" in data:
        values["services_needed"] = as_list(data.get("servicesNeeded"))

    if not values:
        return bad_request("Nothing to update.")

    record_activity(actor, "article.update", f"Updated article #{article_id}.")
    return ok(update("knowledge_articles", values, "id = %s", [article_id]))


# ---------------------------------------------------------------------------
# DELETE /api/knowledge/articles/<id>
# ---------------------------------------------------------------------------
@knowledge_bp.delete("/knowledge/articles/<int:article_id>")
@permission_required("faqs.write")
def delete_article(article_id: int):
    actor = current_user()
    row = _load(article_id)
    if not row:
        return not_found(f"Article #{article_id}")

    execute("delete from public.knowledge_articles where id = %s", [article_id])
    record_activity(actor, "article.delete", f"Deleted the article “{row['title'][:60]}”.")
    return no_content()
