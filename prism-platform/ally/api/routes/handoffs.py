"""Handoff API routes — generate and retrieve clinician handoff packages."""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional

router = APIRouter(prefix="/api/v1/patients/{patient_id}/handoffs", tags=["handoffs"])

_store = None

def set_store(store):
    global _store
    _store = store


class GenerateHandoffRequest(BaseModel):
    recipient_name: str
    recipient_role: str
    authorization_notes: str = ""


@router.post("")
def generate_handoff(patient_id: str, req: GenerateHandoffRequest):
    """Generate a clinician handoff package using real LLM analysis."""
    pg = _store["firewall"].get_patient_graph(patient_id)
    if not pg:
        raise HTTPException(404, "Patient not found")

    handoff_gen = _store["handoff_generator"]

    # Check for family overlap with this clinician
    family_flag = _store["firewall"].get_family_overlap_flag(
        patient_id, req.recipient_name
    )

    handoff, debate = handoff_gen.generate_handoff(
        patient_graph=pg,
        recipient_name=req.recipient_name,
        recipient_role=req.recipient_role,
        authorization_notes=req.authorization_notes,
        family_overlap_info=family_flag,
    )

    return {
        "handoff": handoff.model_dump(),
        "debate": debate,
    }


@router.get("")
def list_handoffs(patient_id: str):
    pg = _store["firewall"].get_patient_graph(patient_id)
    if not pg:
        raise HTTPException(404, "Patient not found")
    return [h.model_dump() for h in pg.handoffs]


@router.get("/{handoff_id}")
def get_handoff(patient_id: str, handoff_id: str):
    pg = _store["firewall"].get_patient_graph(patient_id)
    if not pg:
        raise HTTPException(404, "Patient not found")
    for h in pg.handoffs:
        if h.id == handoff_id:
            return h.model_dump()
    raise HTTPException(404, "Handoff not found")
