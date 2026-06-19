"""Consolidation API routes — trigger and monitor the 5-step pipeline."""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

router = APIRouter(prefix="/api/v1/patients/{patient_id}/consolidation", tags=["consolidation"])

_store = None

def set_store(store):
    global _store
    _store = store


class ConsolidateRequest(BaseModel):
    conversation_id: Optional[str] = None  # consolidate specific conversation, or latest


@router.get("/steps")
def get_consolidation_steps():
    """Return the 5 consolidation step definitions."""
    from ally.engine.consolidation import CONSOLIDATION_STEPS
    return CONSOLIDATION_STEPS


@router.post("")
def trigger_consolidation(patient_id: str, req: ConsolidateRequest = None):
    """Run the full 5-step consolidation pipeline."""
    pg = _store["firewall"].get_patient_graph(patient_id)
    if not pg:
        raise HTTPException(404, "Patient not found")

    # Find the conversation to consolidate
    conv_id = req.conversation_id if req else None
    conv = None
    if conv_id:
        conv = pg.get_conversation(conv_id)
    else:
        # Use the latest ended conversation
        for c in reversed(pg.conversations):
            if c.status == "ended":
                conv = c
                break
        # Or use the latest active one
        if not conv and pg.conversations:
            conv = pg.conversations[-1]

    if not conv:
        raise HTTPException(400, "No conversation to consolidate")

    # Mark as consolidated
    conv.status = "consolidated"

    # Run the pipeline
    consolidation_engine = _store["consolidation_engine"]
    messages = [{"sender": m.sender, "text": m.text} for m in conv.messages]

    result = consolidation_engine.run_full_consolidation(pg, messages)

    return result
