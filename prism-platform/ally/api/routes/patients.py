"""Patient CRUD & New-User Onboarding API routes with persistence sync and email-hash decoupling."""
from datetime import datetime
import hmac
import re
import uuid
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import List, Optional, Dict, Any

from ally.engine.persistence import (
    delete_patient_record,
    hash_user_email,
    hash_user_password,
    save_tester_acknowledgement,
    DEFAULT_DATA_DIR,
)

router = APIRouter(prefix="/api/v1/patients", tags=["patients"])

_store = None

DEMO_TERMS_STATEMENT = (
    "I am 18+ and understand this is an unmonitored product demo, not medical care. "
    "What I type is saved on demo servers so Ally can remember me across sessions and "
    "our team can review conversations to improve Ally. I will use fictional details "
    "rather than sharing real medical or personal secrets, and I understand nothing "
    "entered here is confidential or protected."
)


def set_store(store):
    global _store
    _store = store


def _save(pg) -> None:
    hook = _store.get("save_hook")
    if hook and pg:
        try:
            hook(pg)
        except Exception as e:
            print(f"[WARN] Patient save failed: {e}")


class CreatePatientRequest(BaseModel):
    name: str
    age: int = 0
    bio: str = ""
    bot_context: str = ""
    anonymous: bool = False
    excluded_content: List[str] = []
    locked_nodes: List[str] = []


class OnboardPatientRequest(BaseModel):
    name: str
    email: str
    password: str
    demo_terms_acknowledged: bool = False


class ResumePatientRequest(BaseModel):
    email: str
    password: str


@router.post("")
def create_patient(req: CreatePatientRequest):
    from ally.engine.patient_graph import Patient, PatientGraph

    clean_name = (req.name or "").strip()
    if not clean_name:
        raise HTTPException(400, "Patient name is required")

    patient = Patient(
        id=str(uuid.uuid4()),
        name=clean_name,
        age=req.age,
        bio=req.bio,
        bot_context=req.bot_context,
        anonymous=req.anonymous,
        excluded_content=req.excluded_content,
        locked_nodes=req.locked_nodes,
    )
    pg = PatientGraph(patient)
    pg.add_node(
        node_id=clean_name.split()[0].lower(),
        label=clean_name.split()[0],
        kind="self",
        size=30,
        x=550.0,
        y=310.0,
    )
    pg.graph_version = 1
    _store["firewall"].register_patient(pg)
    _save(pg)
    return {"id": patient.id, "name": patient.name}


@router.post("/onboard")
def onboard_patient(req: OnboardPatientRequest):
    """
    Create a blank-slate Session #1 profile for a new user with email-hash decoupling.
    Plaintext email is stored ONLY in the decoupled tester_acknowledgements log, never in the patient graph JSON.
    """
    from ally.engine.patient_graph import Patient, PatientGraph

    if not req.demo_terms_acknowledged:
        raise HTTPException(400, "You must acknowledge the 18+ non-medical demo terms to proceed.")

    clean_name = " ".join((req.name or "").strip().split())[:48]
    if not clean_name:
        raise HTTPException(400, "First name or nickname is required.")

    clean_email = (req.email or "").strip().lower()
    if "@" not in clean_email or "." not in clean_email.split("@")[-1]:
        raise HTTPException(400, "A valid email address is required.")

    clean_password = (req.password or "").strip()
    if len(clean_password) < 4:
        raise HTTPException(400, "Password must be at least 4 characters.")

    email_hash = hash_user_email(clean_email)
    password_hash = hash_user_password(clean_password, email_hash)

    data_dir = (_store.get("data_dir") if _store else None) or DEFAULT_DATA_DIR
    save_tester_acknowledgement(
        {
            "id": f"ack_{uuid.uuid4().hex[:12]}",
            "name": clean_name,
            "email": clean_email,
            "acknowledged": True,
            "statement": DEMO_TERMS_STATEMENT,
            "timestamp": datetime.utcnow().isoformat(),
        },
        data_dir=data_dir,
    )

    # Check if a custom patient with this email_hash already exists
    for existing_pg in _store["firewall"].graphs.values():
        if getattr(existing_pg.patient, "email_hash", "") == email_hash:
            if hmac.compare_digest(getattr(existing_pg.patient, "password_hash", ""), password_hash):
                return {
                    "id": existing_pg.patient.id,
                    "name": existing_pg.patient.name,
                    "status": "resumed",
                    "is_custom_private": True,
                    "node_count": len(existing_pg.nodes),
                    "edge_count": len(existing_pg.edges),
                    "conversation_count": len(existing_pg.conversations),
                }
            raise HTTPException(
                409,
                "An account with this email already exists. Please use the Returning User (Sign In) tab with your password.",
            )

    patient_id = f"user_{uuid.uuid4().hex[:10]}"
    first_name = clean_name.split()[0]
    self_node_id = re.sub(r"[^a-z0-9]+", "_", first_name.lower()).strip("_") or "self"

    patient = Patient(
        id=patient_id,
        name=clean_name,
        age=0,
        bio="Blank-slate Session #1 onboarding user.",
        bot_context="New user starting Session #1 from a blank-slate 1-node graph.",
        anonymous=False,
        is_custom_private=True,
        email_hash=email_hash,
        password_hash=password_hash,
    )
    pg = PatientGraph(patient)
    pg.add_node(
        node_id=self_node_id,
        label=first_name,
        kind="self",
        size=30,
        x=550.0,
        y=310.0,
    )
    pg.graph_version = 1
    _store["firewall"].register_patient(pg)
    _save(pg)
    return {
        "id": patient.id,
        "name": patient.name,
        "status": "created",
        "is_custom_private": True,
        "node_count": len(pg.nodes),
        "edge_count": len(pg.edges),
        "conversation_count": len(pg.conversations),
    }


@router.post("/resume")
def resume_patient(req: ResumePatientRequest):
    """Sign in a returning user via email + password using salted SHA-256 hash matching."""
    clean_email = (req.email or "").strip().lower()
    clean_password = (req.password or "").strip()
    if not clean_email or not clean_password:
        raise HTTPException(400, "Email address and password are required.")

    email_hash = hash_user_email(clean_email)
    password_hash = hash_user_password(clean_password, email_hash)

    for pg in _store["firewall"].graphs.values():
        if getattr(pg.patient, "email_hash", "") == email_hash:
            if not hmac.compare_digest(getattr(pg.patient, "password_hash", ""), password_hash):
                raise HTTPException(401, "Incorrect password for this email address.")
            return {
                "id": pg.patient.id,
                "name": pg.patient.name,
                "status": "resumed",
                "is_custom_private": True,
                "node_count": len(pg.nodes),
                "edge_count": len(pg.edges),
                "conversation_count": len(pg.conversations),
            }

    raise HTTPException(404, "No saved profile found for that email address. Try creating a new profile first.")


@router.get("")
def list_patients(request: Request):
    unlocked_hdr = request.headers.get("X-Unlocked-Patients", "")
    unlocked_q = request.query_params.get("unlocked", "")
    unlocked_ids = {
        tok.strip()
        for tok in f"{unlocked_hdr},{unlocked_q}".split(",")
        if tok.strip()
    }
    claims = getattr(request.state, "auth_claims", None) or {}
    is_admin = claims.get("role") == "admin"

    results = []
    for pg in _store["firewall"].graphs.values():
        is_private = bool(getattr(pg.patient, "is_custom_private", False))
        if is_private and not is_admin and pg.patient.id not in unlocked_ids:
            continue
        results.append(
            {
                "id": pg.patient.id,
                "name": pg.patient.name,
                "age": pg.patient.age,
                "anonymous": pg.patient.anonymous,
                "is_custom_private": is_private,
                "node_count": len(pg.nodes),
                "edge_count": len(pg.edges),
                "conversation_count": len(pg.conversations),
            }
        )
    return results


@router.get("/{patient_id}")
def get_patient(patient_id: str):
    pg = _store["firewall"].get_patient_graph(patient_id)
    if not pg:
        raise HTTPException(404, "Patient not found")
    return pg.to_dict()


@router.delete("/{patient_id}")
def delete_patient(patient_id: str):
    if not _store["firewall"].remove_patient(patient_id):
        raise HTTPException(404, "Patient not found")
    data_dir = _store.get("data_dir")
    if data_dir:
        delete_patient_record(patient_id, data_dir)
    else:
        delete_patient_record(patient_id)
    return {"status": "deleted"}
