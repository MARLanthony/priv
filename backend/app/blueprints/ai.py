"""AI layer — ``/api/ai/chat`` and the firm's ``/api/nlp`` endpoints.

The browser never sees the OpenRouter key: every model call is proxied here.
``POST /nlp/analyze`` runs the legal-intake prompt, stores the structured result
in ``nlp_results`` and returns it in the shape the frontend already understands.
"""

from __future__ import annotations

import json
import logging

import requests
from flask import Blueprint, current_app, request

from app.extensions import insert, query_all, query_one
from app.utils import (
    as_int,
    auth_required,
    body_of,
    clean,
    current_user,
    ok,
    permission_required,
    record_activity,
    scoped_client_id,
)
from app.utils.responses import bad_request

ai_bp = Blueprint("ai", __name__)
log = logging.getLogger(__name__)

INTAKE_SYSTEM_PROMPT = """You are JurisFlow's legal intake assistant for a law firm.
Read the client's description and reply with JSON only, using these keys:
caseType (string), confidence (0-1 number), urgency ("High" | "Medium" | "Low"),
articles (array of short legal topics), services (array of practice areas),
nextSteps (array of practical actions), keyFacts (array of facts quoted from the text),
summary (2-3 sentences in plain language).
Never invent facts. If the description is not a legal problem, set caseType to
"Not a legal matter" and explain why in the summary."""

DOCUMENT_SYSTEM_PROMPT = """You classify a legal document for a law firm.
Reply with JSON only: documentType, parties (array), dates (array),
clauses (array of {title, text, risk}), summary (3 sentences), risks (array)."""


def _call_openrouter(
    messages: list[dict], *, model: str | None = None, json_mode: bool = True
) -> dict:
    """One proxy call to OpenRouter, with the key from the backend environment."""
    config = current_app.config
    key = config.get("OPENROUTER_API_KEY")
    if not key:
        raise RuntimeError("OPENROUTER_API_KEY is not configured on the server.")

    payload: dict = {
        "model": model or config["OPENROUTER_MODEL"],
        "messages": messages,
        "temperature": 0.2,
    }
    if json_mode:
        payload["response_format"] = {"type": "json_object"}

    response = requests.post(
        f"{config['OPENROUTER_BASE_URL']}/chat/completions",
        headers={
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
            "HTTP-Referer": config["OPENROUTER_SITE_URL"],
            "X-Title": config["OPENROUTER_APP_NAME"],
        },
        json=payload,
        timeout=config["AI_TIMEOUT_SECONDS"],
    )
    response.raise_for_status()
    data = response.json()

    choice = (data.get("choices") or [{}])[0]
    message = choice.get("message") or {}
    return {
        "content": message.get("content") or "",
        "model": data.get("model") or payload["model"],
        "usage": data.get("usage") or {},
        "reasoning": message.get("reasoning"),
    }


def _parse_json(text: str) -> dict:
    """Extracts the JSON object from a model answer (code fences tolerated)."""
    cleaned = text.strip()
    if cleaned.startswith("```"):
        block = cleaned.split("```")
        cleaned = block[1] if len(block) > 1 else cleaned.strip("`")
        if cleaned.lower().startswith("json"):
            cleaned = cleaned[4:]
    start, end = cleaned.find("{"), cleaned.rfind("}")
    if start == -1 or end == -1:
        raise ValueError("The model did not return JSON.")
    return json.loads(cleaned[start : end + 1])


# ---------------------------------------------------------------------------
# POST /api/ai/chat — raw proxy (used for e-mail drafts and experiments)
# ---------------------------------------------------------------------------
@ai_bp.post("/ai/chat")
@permission_required("nlp.run")
def chat():
    data = body_of(request)
    messages = data.get("messages")
    if not isinstance(messages, list) or not messages:
        return bad_request("Send a non-empty messages array.")

    try:
        result = _call_openrouter(
            messages, model=clean(data.get("model")), json_mode=bool(data.get("json"))
        )
    except requests.HTTPError as error:
        status = error.response.status_code if error.response is not None else 502
        log.warning("OpenRouter error %s: %s", status, error)
        if status < 500:
            return bad_request("The AI provider refused the request.")
        return {"error": "The AI provider is unavailable.", "status": 502}, 502
    except (requests.RequestException, RuntimeError, ValueError) as error:
        log.warning("AI call failed: %s", error)
        return {"error": str(error), "status": 502}, 502

    return ok(result)


def _stored_result(result_id: int) -> dict:
    """A stored row in the shape the frontend's ``NLPResult`` expects."""
    row = query_one(
        """
        select id, document_id, client_id, classification, urgency, confidence,
               summary, result, model, source, latency_ms, created_at
          from public.nlp_results where id = %s
        """,
        [result_id],
    )
    if not row:
        return {}

    return {
        "id": row["id"],
        "documentId": row["document_id"],
        "documentName": None,
        "classification": row["classification"],
        "extractedInfo": row["result"],
        "summary": row["summary"],
        "urgency": row["urgency"],
        "confidence": float(row["confidence"] or 0),
        "model": row["model"],
        "source": row["source"],
        "createdAt": row["created_at"].isoformat() if row["created_at"] else None,
    }


# ---------------------------------------------------------------------------
# POST /api/nlp/analyze — legal intake, stored against the client
# ---------------------------------------------------------------------------
@ai_bp.post("/nlp/analyze")
@permission_required("nlp.run")
def analyze():
    actor = current_user()
    data = body_of(request)
    query = clean(data.get("query"))

    if not query or len(query) < 20:
        return bad_request("Describe the situation in at least 20 characters.")

    client_id = scoped_client_id(actor) or as_int(data.get("clientId"))

    try:
        response = _call_openrouter(
            [
                {"role": "system", "content": INTAKE_SYSTEM_PROMPT},
                {"role": "user", "content": query},
            ]
        )
        analysis = _parse_json(response["content"])
    except (requests.RequestException, RuntimeError, ValueError) as error:
        log.warning("Intake analysis failed: %s", error)
        return {"error": "The AI could not analyse that description.", "status": 502}, 502

    row = insert(
        "nlp_results",
        {
            "client_id": client_id,
            "kind": "intake",
            "classification": clean(analysis.get("caseType")),
            "urgency": clean(analysis.get("urgency")),
            "confidence": float(analysis.get("confidence") or 0),
            "summary": clean(analysis.get("summary")),
            "result": json.dumps(
                {
                    "query": query,
                    "extractedKeywords": analysis.get("articles") or [],
                    "suggestedCaseType": analysis.get("caseType"),
                    "confidence": analysis.get("confidence"),
                    "matchedArticles": analysis.get("articles") or [],
                    "requiredServices": analysis.get("services") or [],
                    "nextSteps": analysis.get("nextSteps") or [],
                    "keyFacts": analysis.get("keyFacts") or [],
                    "summary": analysis.get("summary"),
                }
            ),
            "model": response["model"],
            "source": "openrouter",
        },
    )

    record_activity(actor, "nlp.analyze", "Ran the AI intake on a client description.")
    return ok(_stored_result(row["id"]))


# ---------------------------------------------------------------------------
# GET /api/nlp/results?clientId=
# ---------------------------------------------------------------------------
@ai_bp.get("/nlp/results")
@permission_required("nlp.run")
def results():
    user = current_user()
    client_id = scoped_client_id(user) or as_int(request.args.get("clientId"))

    rows = query_all(
        """
        select id from public.nlp_results
         where (%s is null or client_id = %s)
           and kind = 'intake'
         order by created_at desc
         limit 25
        """,
        [client_id, client_id],
    )
    return ok([_stored_result(row["id"]) for row in rows])


# ---------------------------------------------------------------------------
# POST /api/nlp/email-reply — drafts a reply, nothing is stored
# ---------------------------------------------------------------------------
@ai_bp.post("/nlp/email-reply")
@permission_required("nlp.run")
def email_reply():
    data = body_of(request)
    context = data.get("context") or {}
    tone = clean(data.get("tone"), "professional")

    prompt = (
        f"Draft a concise reply to a client in a {tone} tone, as JSON with "
        "`subject` and `body`.\n"
        f"Client: {context.get('clientName', 'the client')}\n"
        f"Case: {context.get('caseType', 'general')} {context.get('caseNumber', '')}\n"
        f"Summary: {context.get('caseSummary', '')}\n"
    )

    try:
        response = _call_openrouter(
            [
                {
                    "role": "system",
                    "content": "You draft replies for a law firm. Reply with JSON only.",
                },
                {"role": "user", "content": prompt},
            ]
        )
        draft = _parse_json(response["content"])
    except (requests.RequestException, RuntimeError, ValueError) as error:
        log.warning("Email draft failed: %s", error)
        return {"error": "The AI could not draft that reply.", "status": 502}, 502

    record_activity(current_user(), "nlp.email_reply", "Drafted a client e-mail reply.")
    return ok(
        {
            "subject": draft.get("subject", "Regarding your matter"),
            "body": draft.get("body", ""),
            "tone": tone,
        }
    )
