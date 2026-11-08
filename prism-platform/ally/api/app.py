"""
Ally API — FastAPI application for the Castle Behavioral Health Companion.
Enforces session-token authentication (C1, C2), admin role checks on destructive routes (C1),
sliding-window rate limiting on model-spending endpoints (C1), redacted health checks (M6),
and strict HTTP security headers (M7).
"""
import base64
import collections
import hashlib
import hmac
import json
import os
import re
import sys
import time
import uuid
from typing import Dict, Any, Optional, Deque

# Add parent to path for prism imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from prism.engine.reasoning.llm_client import LLMClient
from ally.engine.firewall import PatientFirewall
from ally.engine.conversation_engine import ConversationEngine
from ally.engine.consolidation import ConsolidationEngine
from ally.engine.handoff_generator import HandoffGenerator
from ally.engine.clinician_engine import ClinicianEngine
from ally.engine.persistence import (
    save_patient,
    save_all,
    load_all,
    save_user_feedback,
    list_user_feedback,
    list_tester_acknowledgements,
    DEFAULT_DATA_DIR,
)

from ally.api.routes import patients, conversations, graphs, consolidation, handoffs, clinician, debate

# ── Security Configuration (C1, C2) ─────────────────────────────────
_ENABLE_DOCS = os.environ.get("ALLY_ENABLE_DOCS", "0") == "1"
_SESSION_SECRET = os.environ.get("ALLY_SESSION_SECRET", "ally-prism-hmac-session-secret-2026-v1")
_ADMIN_KEY = os.environ.get("ALLY_ADMIN_KEY", "ally-local-admin-2026")
_USER_RATE_LIMIT_PER_MIN = int(os.environ.get("ALLY_RATE_LIMIT_PER_MIN", "30"))
_ADMIN_RATE_LIMIT_PER_MIN = int(os.environ.get("ALLY_ADMIN_RATE_LIMIT_PER_MIN", "180"))

app = FastAPI(
    title="Ally API",
    description="Castle Behavioral Health Companion — AI-powered patient engagement with persistent graph memory",
    version="1.1.0",
    docs_url="/docs" if _ENABLE_DOCS else None,
    redoc_url="/redoc" if _ENABLE_DOCS else None,
    openapi_url="/openapi.json" if _ENABLE_DOCS else None,
)

# Restrictive same-origin friendly CORS
_ALLOWED_ORIGINS = [
    o.strip()
    for o in os.environ.get(
        "ALLY_CORS_ORIGINS",
        "http://127.0.0.1:8089,http://localhost:8089,http://localhost:5173,http://127.0.0.1:5173,https://prism-platform-525536279111.us-central1.run.app",
    ).split(",")
    if o.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "X-Ally-Token", "X-Ally-Admin-Key", "X-Unlocked-Patients"],
)


# ── Token Signing & Verification (C1, C2) ───────────────────────────

def _issue_session_token(role: str = "user", ttl_seconds: int = 86400) -> str:
    payload = {
        "sub": uuid.uuid4().hex[:16],
        "role": role,
        "accepted_terms": True,
        "iat": int(time.time()),
        "exp": int(time.time()) + ttl_seconds,
    }
    raw = json.dumps(payload, separators=(",", ":"), sort_keys=True).encode("utf-8")
    b64 = base64.urlsafe_b64encode(raw).decode("ascii").rstrip("=")
    sig = hmac.new(_SESSION_SECRET.encode("utf-8"), b64.encode("ascii"), hashlib.sha256).hexdigest()
    return f"{b64}.{sig}"


def _verify_session_token(token: str) -> Optional[Dict[str, Any]]:
    if not token or "." not in token:
        return None
    parts = token.split(".", 1)
    if len(parts) != 2:
        return None
    b64, sig = parts
    expected_sig = hmac.new(_SESSION_SECRET.encode("utf-8"), b64.encode("ascii"), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected_sig, sig):
        return None
    try:
        padded = b64 + "=" * (-len(b64) % 4)
        payload = json.loads(base64.urlsafe_b64decode(padded.encode("ascii")).decode("utf-8"))
    except Exception:
        return None
    if not isinstance(payload, dict) or not payload.get("accepted_terms"):
        return None
    if int(payload.get("exp", 0)) < int(time.time()):
        return None
    return payload


def _extract_auth_claims(request: Request) -> Optional[Dict[str, Any]]:
    admin_hdr = request.headers.get("X-Ally-Admin-Key", "")
    if admin_hdr and hmac.compare_digest(admin_hdr, _ADMIN_KEY):
        return {"sub": "admin-key", "role": "admin", "accepted_terms": True}

    token = request.headers.get("X-Ally-Token", "").strip()
    if not token:
        auth_hdr = request.headers.get("Authorization", "").strip()
        if auth_hdr.lower().startswith("bearer "):
            token = auth_hdr[7:].strip()
    if not token:
        token = (request.cookies.get("ally_session") or "").strip()
    if not token:
        token = (request.query_params.get("token") or "").strip()

    return _verify_session_token(token)


# ── Route Classification for RBAC & Rate Limiting (C1) ──────────────

_PUBLIC_PATHS = {
    "/api/v1/health",
    "/api/v1/auth/accept-terms",
}

_MODEL_SPENDING_PATTERNS = [
    ("POST", re.compile(r"^/api/v1/patients/[^/]+/conversations/[^/]+/messages$")),
    ("POST", re.compile(r"^/api/v1/patients/[^/]+/clinician/messages$")),
    ("POST", re.compile(r"^/api/v1/patients/[^/]+/clinician/post_visit$")),
    ("POST", re.compile(r"^/api/v1/patients/[^/]+/handoffs$")),
    ("POST", re.compile(r"^/api/v1/patients/[^/]+/consolidation(?:/sweep)?$")),
    ("POST", re.compile(r"^/api/v1/patients/[^/]+/graph/ingest$")),
    ("GET", re.compile(r"^/api/v1/patients/[^/]+/debate/stream$")),
]

_ADMIN_ONLY_PATTERNS = [
    ("POST", re.compile(r"^/api/v1/patients$")),
    ("DELETE", re.compile(r"^/api/v1/patients/[^/]+$")),
    ("DELETE", re.compile(r"^/api/v1/patients/[^/]+/graph/nodes/[^/]+$")),
    ("DELETE", re.compile(r"^/api/v1/patients/[^/]+/graph/edges$")),
    ("POST", re.compile(r"^/api/v1/patients/[^/]+/graph/reset$")),
]

_rate_buckets: Dict[str, Deque[float]] = collections.defaultdict(collections.deque)


def _is_model_spending(method: str, path: str) -> bool:
    return any(m == method and pat.match(path) for m, pat in _MODEL_SPENDING_PATTERNS)


def _is_admin_only(method: str, path: str) -> bool:
    return any(m == method and pat.match(path) for m, pat in _ADMIN_ONLY_PATTERNS)


def _check_rate_limit(bucket_key: str, limit_per_min: int) -> bool:
    now = time.monotonic()
    window = _rate_buckets[bucket_key]
    while window and (now - window[0]) > 60.0:
        window.popleft()
    if len(window) >= limit_per_min:
        return False
    window.append(now)
    return True


_SECURITY_HEADERS = {
    "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
    "Content-Security-Policy": (
        "default-src 'self'; "
        "script-src 'self' 'unsafe-inline'; "
        "style-src 'self' 'unsafe-inline'; "
        "font-src 'self' data:; "
        "img-src 'self' data: blob:; "
        "connect-src 'self' http://127.0.0.1:8089 http://localhost:8089 https://prism-platform-525536279111.us-central1.run.app; "
        "frame-ancestors 'none'; "
        "base-uri 'self'; "
        "form-action 'self'"
    ),
    "X-Frame-Options": "DENY",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
}


@app.middleware("http")
async def security_and_auth_middleware(request: Request, call_next):
    path = request.url.path
    method = request.method.upper()

    # Enforce auth, RBAC, and rate limiting on all /api routes except explicit public endpoints (C1, C2)
    if (path == "/api" or path.startswith("/api/")) and method != "OPTIONS":
        if path not in _PUBLIC_PATHS:
            claims = _extract_auth_claims(request)
            if not claims:
                resp = JSONResponse(
                    status_code=401,
                    content={"detail": "Authentication required. Accept platform terms at /api/v1/auth/accept-terms to obtain a session token."},
                )
                for hk, hv in _SECURITY_HEADERS.items():
                    resp.headers[hk] = hv
                return resp

            role = claims.get("role", "user")
            request.state.auth_claims = claims

            if _is_admin_only(method, path) and role != "admin":
                resp = JSONResponse(
                    status_code=403,
                    content={"detail": "Admin role required for destructive patient or graph operations."},
                )
                for hk, hv in _SECURITY_HEADERS.items():
                    resp.headers[hk] = hv
                return resp

            if _is_model_spending(method, path):
                client_ip = request.client.host if request.client else "unknown"
                bucket_key = f"{client_ip}:{claims.get('sub', 'anon')}"
                cap = _ADMIN_RATE_LIMIT_PER_MIN if role == "admin" else _USER_RATE_LIMIT_PER_MIN
                if not _check_rate_limit(bucket_key, cap):
                    resp = JSONResponse(
                        status_code=429,
                        content={"detail": f"Rate limit exceeded ({cap} model requests per minute). Please wait before retrying."},
                        headers={"Retry-After": "60"},
                    )
                    for hk, hv in _SECURITY_HEADERS.items():
                        resp.headers[hk] = hv
                    return resp

    response = await call_next(request)
    for hk, hv in _SECURITY_HEADERS.items():
        response.headers[hk] = hv
    return response


# ── Auth Endpoints (C2, C1) ─────────────────────────────────────────

class AcceptTermsRequest(BaseModel):
    accepted: bool
    admin_key: Optional[str] = None


class ElevateAdminRequest(BaseModel):
    admin_key: str


@app.post("/api/v1/auth/accept-terms")
def accept_terms(req: AcceptTermsRequest, response: Response):
    """Issue a server-verified HMAC session token upon acceptance of legal/clinical terms (C2)."""
    if not req.accepted:
        raise HTTPException(400, "Terms must be explicitly accepted (accepted=true)")

    role = "user"
    if req.admin_key and hmac.compare_digest(req.admin_key, _ADMIN_KEY):
        role = "admin"

    token = _issue_session_token(role=role)
    response.set_cookie(
        key="ally_session",
        value=token,
        max_age=86400,
        httponly=True,
        samesite="lax",
        path="/",
    )
    return {
        "status": "authorized",
        "token": token,
        "role": role,
        "expires_in": 86400,
    }


@app.post("/api/v1/auth/elevate")
def elevate_to_admin(req: ElevateAdminRequest, response: Response):
    """Elevate an authenticated session to admin role for authorized graph maintenance (C1)."""
    if not req.admin_key or not hmac.compare_digest(req.admin_key, _ADMIN_KEY):
        raise HTTPException(403, "Invalid admin key")

    token = _issue_session_token(role="admin")
    response.set_cookie(
        key="ally_session",
        value=token,
        max_age=86400,
        httponly=True,
        samesite="lax",
        path="/",
    )
    return {
        "status": "elevated",
        "token": token,
        "role": "admin",
        "expires_in": 86400,
    }


@app.get("/api/v1/auth/me")
def get_current_session(request: Request):
    claims = getattr(request.state, "auth_claims", None) or _extract_auth_claims(request)
    if not claims:
        raise HTTPException(401, "Not authenticated")
    return {
        "authenticated": True,
        "role": claims.get("role", "user"),
        "accepted_terms": bool(claims.get("accepted_terms")),
    }


# ── Initialize shared services ──────────────────────────────────────
llm = LLMClient(mock=False)

store = {
    "firewall": PatientFirewall(),
    "conversation_engine": ConversationEngine(llm_client=llm),
    "llm": llm,
    "consolidation_engine": ConsolidationEngine(llm_client=llm),
    "handoff_generator": HandoffGenerator(llm_client=llm),
    "clinician_engine": ClinicianEngine(llm_client=llm),
    "save_hook": lambda pg: save_patient(pg, DEFAULT_DATA_DIR),
    "data_dir": DEFAULT_DATA_DIR,
}

# ── Inject store into route modules ────────────────────────────────
patients.set_store(store)
conversations.set_store(store)
graphs.set_store(store)
consolidation.set_store(store)
handoffs.set_store(store)
clinician.set_store(store)
debate.set_store(store)

# ── Register routers ───────────────────────────────────────────────
app.include_router(patients.router)
app.include_router(conversations.router)
app.include_router(graphs.router)
app.include_router(consolidation.router)
app.include_router(handoffs.router)
app.include_router(clinician.router)
app.include_router(debate.router)


@app.get("/api")
def api_root():
    return {
        "name": "Ally API",
        "description": "Castle Behavioral Health Companion",
        "version": "1.1.0",
        "endpoints": {
            "auth": "/api/v1/auth/accept-terms",
            "patients": "/api/v1/patients",
            "conversations": "/api/v1/patients/{id}/conversations",
            "graph": "/api/v1/patients/{id}/graph",
            "consolidation": "/api/v1/patients/{id}/consolidation",
            "handoffs": "/api/v1/patients/{id}/handoffs",
            "clinician_chat": "/api/v1/patients/{id}/clinician/messages",
            "clinician_handoff": "/api/v1/patients/{id}/clinician/handoff",
            "debate_verdicts": "/api/v1/patients/{id}/debate/verdicts",
        },
    }


@app.get("/api/v1/health")
def health():
    """Public health probe — redacted so zero patient IDs or family links are published (M6)."""
    return {"status": "healthy"}


class FeedbackSubmissionRequest(BaseModel):
    rating: int = 5
    comment: str
    email: Optional[str] = ""
    patient_id: Optional[str] = ""


@app.post("/api/v1/feedback")
def submit_feedback(req: FeedbackSubmissionRequest):
    """Persist user feedback on Ally onboarding & session experience."""
    from datetime import datetime
    clean_comment = (req.comment or "").strip()
    if not clean_comment:
        raise HTTPException(400, "Feedback text is required.")
    rating = max(1, min(5, int(req.rating or 5)))
    data_dir = store.get("data_dir") or DEFAULT_DATA_DIR
    record = save_user_feedback(
        {
            "id": f"fb_{uuid.uuid4().hex[:10]}",
            "rating": rating,
            "comment": clean_comment[:2000],
            "email": (req.email or "").strip()[:120],
            "patient_id": (req.patient_id or "").strip()[:64],
            "timestamp": datetime.utcnow().isoformat(),
        },
        data_dir=data_dir,
    )
    return {"status": "saved", "feedback": record}


@app.get("/api/v1/feedback")
def get_feedback():
    """List submitted user feedback records."""
    data_dir = store.get("data_dir") or DEFAULT_DATA_DIR
    items = list_user_feedback(data_dir=data_dir)
    return {"count": len(items), "feedback": items}


@app.get("/api/v1/phi-acknowledgements")
def get_phi_acknowledgements():
    """List decoupled 18+ plain-English demo acknowledgement records."""
    data_dir = store.get("data_dir") or DEFAULT_DATA_DIR
    items = list_tester_acknowledgements(data_dir=data_dir)
    return {"count": len(items), "acknowledgements": items}


@app.on_event("startup")
def load_or_seed_data():
    """
    On startup: check if ally/data/ has saved patient records → load them.
    If empty or missing → run deterministic seed + save to disk (H11).
    """
    loaded_firewall = load_all(DEFAULT_DATA_DIR)

    if loaded_firewall and loaded_firewall.graphs:
        store["firewall"] = loaded_firewall
        _reinject_store()
        print(f"[OK] Loaded {len(loaded_firewall.graphs)} patient record(s) from persistent store")
    else:
        from ally.seed import seed_elena_and_daniel
        seed_elena_and_daniel(store["firewall"])
        count = save_all(store["firewall"], DEFAULT_DATA_DIR)
        print(f"[OK] Ally demo data seeded and saved to persistent store: {count} patients")


def _reinject_store():
    """Re-inject store into all route modules after firewall replacement."""
    patients.set_store(store)
    conversations.set_store(store)
    graphs.set_store(store)
    consolidation.set_store(store)
    handoffs.set_store(store)
    clinician.set_store(store)
    debate.set_store(store)


ui_dist = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "ui", "dist"))
if os.path.isdir(ui_dist):
    assets_dir = os.path.join(ui_dist, "assets")
    if os.path.isdir(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")
    fonts_dir = os.path.join(ui_dist, "fonts")
    if os.path.isdir(fonts_dir):
        app.mount("/fonts", StaticFiles(directory=fonts_dir), name="fonts")

    @app.get("/{full_path:path}")
    def serve_react_app(full_path: str):
        if full_path.startswith("api/") or full_path in ("docs", "redoc", "openapi.json"):
            raise HTTPException(404, "Not found")
        candidate = os.path.abspath(os.path.join(ui_dist, full_path))
        if candidate.startswith(ui_dist) and os.path.isfile(candidate):
            return FileResponse(candidate)
        return FileResponse(
            os.path.join(ui_dist, "index.html"),
            headers={
                "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
                "Pragma": "no-cache",
                "Expires": "0",
            },
        )
