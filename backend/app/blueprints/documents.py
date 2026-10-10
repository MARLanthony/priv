"""Filing cabinet — ``/api/documents``.

Uploads arrive as ``multipart/form-data``, stream into Supabase Storage (or the
local ``uploads`` folder when no service key is configured) and are recorded in
``documents``. Downloads are answered with a signed URL when storage is
available, otherwise the API streams the local file.
"""

from __future__ import annotations

import os
import re
from datetime import datetime

from flask import Blueprint, current_app, request, send_file

from app.extensions import execute, insert, query_all, query_one, signed_url, storage_enabled, update, upload_bytes
from app.utils import (
    auth_required,
    body_of,
    clean,
    current_user,
    notify,
    ok,
    permission_required,
    record_activity,
    role_has_permission,
    scoped_client_id,
)
from app.utils.responses import bad_request, forbidden, no_content, not_found

documents_bp = Blueprint("documents", __name__)

STATUSES = ("received", "reviewing", "processed", "rejected")

DOCUMENT_COLUMNS = """
    d.id, d.client_id, cl.full_name as client_name, d.case_id, cs.title as case_name,
    d.name, d.file_url, d.mime_type, d.size_bytes, d.status, d.review_note,
    d.uploaded_by, u.name as uploaded_by_name, d.created_at, d.updated_at
"""

FROM_CLAUSE = """
    from public.documents d
    left join public.clients cl on cl.id = d.client_id
    left join public.cases cs on cs.id = d.case_id
    left join public.users u on u.id = d.uploaded_by
"""


def _load(document_id: int) -> dict | None:
    return query_one(
        f"select {DOCUMENT_COLUMNS} {FROM_CLAUSE} where d.id = %s", [document_id]
    )


def _may_read(user: dict, row: dict) -> bool:
    if user["role"] in ("admin", "lawyer", "staff"):
        return True
    return row["client_id"] == scoped_client_id(user)


def _safe_name(filename: str) -> str:
    """Strips directory parts and characters that break a storage key."""
    base = os.path.basename(filename or "document")
    return re.sub(r"[^\w.\- ]+", "_", base)[:180] or "document"


# ---------------------------------------------------------------------------
# GET /api/documents?clientId=&caseId=&status=&q=
# ---------------------------------------------------------------------------
@documents_bp.get("/documents")
@permission_required("documents.read")
def list_documents():
    user = current_user()
    term = clean(request.args.get("q"))
    status = clean(request.args.get("status"))
    case_filter = request.args.get("caseId")

    # Clients are locked to their own uploads.
    client_id = scoped_client_id(user)
    requested_client = request.args.get("clientId")
    if user["role"] != "client" and requested_client:
        client_id = int(requested_client)

    if user["role"] == "lawyer":
        # A lawyer sees files on their own cases plus anything filed for a client
        # they are working with; the case link is the reliable signal.
        scope = """
          (
            d.case_id is null
            or exists (
              select 1 from public.cases c
               where c.id = d.case_id and c.assigned_lawyer_id = %(user_id)s
            )
            or d.client_id in (
              select distinct c2.client_id from public.cases c2
               where c2.assigned_lawyer_id = %(user_id)s
            )
          )
        """
    else:
        scope = "true"

    rows = query_all(
        f"""
        select {DOCUMENT_COLUMNS} {FROM_CLAUSE}
         where (%(client)s is null or d.client_id = %(client)s)
           and (%(case)s is null or d.case_id = %(case)s)
           and (%(status)s is null or d.status = %(status)s)
           and (%(term)s is null or d.name ilike '%%' || %(term)s || '%%'
                or cl.full_name ilike '%%' || %(term)s || '%%')
           and {scope}
         order by d.created_at desc
        """,
        {
            "client": client_id,
            "case": int(case_filter) if case_filter else None,
            "status": status,
            "term": term,
            "user_id": user["id"],
        },
    )

    # The download URL is signed on read, never stored, so links cannot be shared.
    for row in rows:
        if storage_enabled():
            row["file_url"] = signed_url(row["file_url"] or "") or None
    return ok(rows)


# ---------------------------------------------------------------------------
# GET /api/documents/<id>
# ---------------------------------------------------------------------------
@documents_bp.get("/documents/<int:document_id>")
@permission_required("documents.read")
def get_document(document_id: int):
    user = current_user()
    row = _load(document_id)
    if not row:
        return not_found(f"Document #{document_id}")
    if not _may_read(user, row):
        return forbidden("This document is not yours.")
    return ok(row)


# ---------------------------------------------------------------------------
# POST /api/documents — multipart upload
# ---------------------------------------------------------------------------
@documents_bp.post("/documents")
@permission_required("documents.write")
def upload_document():
    actor = current_user()
    upload = request.files.get("file")
    if upload is None or not upload.filename:
        return bad_request("Attach a file to upload.")

    # A client uploads to their own file; staff and lawyers name the client.
    client_id = scoped_client_id(actor) or request.form.get("clientId")
    if not client_id:
        return bad_request("Choose the client this document belongs to.")

    client = query_one(
        "select id, user_id, full_name from public.clients where id = %s", [int(client_id)]
    )
    if not client:
        return not_found(f"Client #{client_id}")

    case_id = request.form.get("caseId") or None
    if case_id and not query_one("select id from public.cases where id = %s", [int(case_id)]):
        return not_found(f"Case #{case_id}")

    payload = upload.read()
    if not payload:
        return bad_request("The file is empty.")

    limit = current_app.config["MAX_CONTENT_LENGTH"]
    if len(payload) > limit:
        return bad_request(f"Files must be smaller than {limit // (1024 * 1024)} MB.")

    name = _safe_name(upload.filename)
    stamp = datetime.utcnow()
    key = f"clients/{client['id']}/{stamp:%Y/%m}/{stamp:%Y%m%d%H%M%S}-{name}"
    stored = upload_bytes(key, payload, upload.mimetype)

    row = insert(
        "documents",
        {
            "client_id": client["id"],
            "case_id": int(case_id) if case_id else None,
            "name": name,
            "storage_path": stored,
            "file_url": stored,
            "mime_type": upload.mimetype,
            "size_bytes": len(payload),
            "status": "received",
            "uploaded_by": actor["id"],
        },
    )

    record_activity(actor, "document.upload", f"Uploaded {name} for {client['full_name']}.")
    if client["user_id"]:
        notify(
            client["user_id"],
            "document",
            f"{name} was uploaded to your file.",
            "/client/documents",
        )
    return ok(_load(row["id"]), 201)


# ---------------------------------------------------------------------------
# PATCH /api/documents/<id>/status — move a file through review
# ---------------------------------------------------------------------------
@documents_bp.patch("/documents/<int:document_id>/status")
@permission_required("documents.write")
def set_document_status(document_id: int):
    actor = current_user()
    if actor["role"] == "client":
        return forbidden("A client cannot change the review status.")

    target = _load(document_id)
    if not target:
        return not_found(f"Document #{document_id}")

    status = clean(body_of(request).get("status"))
    if status not in STATUSES:
        return bad_request(f"Status must be one of: {', '.join(STATUSES)}.")

    update("documents", {"status": status}, "id = %s", [document_id])

    client = query_one("select user_id from public.clients where id = %s", [target["client_id"]])
    if client and client["user_id"]:
        notify(
            client["user_id"],
            "document",
            f"{target['name']} is now marked as {status}.",
            "/client/documents",
        )

    record_activity(actor, "document.status", f"{target['name']} → {status}.")
    return ok(_load(document_id))


# ---------------------------------------------------------------------------
# GET /api/documents/<id>/download
# ---------------------------------------------------------------------------
@documents_bp.get("/documents/<int:document_id>/download")
@auth_required
def download_document(document_id: int):
    user = current_user()
    row = _load(document_id)
    if not row:
        return not_found(f"Document #{document_id}")
    if not _may_read(user, row):
        return forbidden("This document is not yours.")

    # Supabase Storage: hand the browser a signed link and let it stream.
    if storage_enabled():
        link = signed_url(row["file_url"] or "")
        if link:
            from flask import redirect

            return redirect(link)

    # Local development: stream the file from UPLOAD_FOLDER.
    path = os.path.join(current_app.config["UPLOAD_FOLDER"], row["file_url"] or "")
    if not os.path.isfile(path):
        return not_found("The stored file")
    return send_file(path, as_attachment=True, download_name=row["name"])


# ---------------------------------------------------------------------------
# GET /api/documents/<id>/analysis — the stored AI classification
# ---------------------------------------------------------------------------
@documents_bp.get("/documents/<int:document_id>/analysis")
@permission_required("documents.read")
def document_analysis(document_id: int):
    user = current_user()
    row = _load(document_id)
    if not row:
        return not_found(f"Document #{document_id}")
    if not _may_read(user, row):
        return forbidden("This document is not yours.")

    analysis = query_one(
        """
        select id, document_id, classification, urgency, confidence, summary,
               result as extracted_info, model, source, latency_ms, created_at
          from public.nlp_results
         where document_id = %s
         order by created_at desc
         limit 1
        """,
        [document_id],
    )
    if not analysis:
        return not_found("An analysis for this document")
    return ok(analysis)


# ---------------------------------------------------------------------------
# DELETE /api/documents/<id>
# ---------------------------------------------------------------------------
@documents_bp.delete("/documents/<int:document_id>")
@permission_required("documents.write")
def delete_document(document_id: int):
    actor = current_user()
    target = _load(document_id)
    if not target:
        return not_found(f"Document #{document_id}")

    if actor["role"] == "client":
        # A client may withdraw a file they uploaded, but not one under review.
        if target["client_id"] != scoped_client_id(actor):
            return forbidden("This document is not yours.")
        if target["status"] != "received":
            return forbidden("A file already under review cannot be withdrawn.")
    elif actor["role"] == "lawyer" and not role_has_permission(actor["role"], "documents.write"):
        return forbidden("Missing permission: documents.write.")

    execute("delete from public.documents where id = %s", [document_id])
    record_activity(actor, "document.delete", f"Deleted {target['name']}.")
    return no_content()
