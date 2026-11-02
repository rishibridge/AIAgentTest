"""Consolidation API routes — trigger, sweep, and monitor the 5-step pipeline."""
from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional

from ally.engine.consolidation import CONSOLIDATION_STEPS, ConsolidationStepError

router = APIRouter(prefix="/api/v1/patients/{patient_id}/consolidation", tags=["consolidation"])

_store = None


def set_store(store):
    global _store
    _store = store


def _save(patient_id: str) -> None:
    hook = _store.get("save_hook")
    pg = _store["firewall"].get_patient_graph(patient_id)
    if hook and pg:
        try:
            hook(pg)
        except Exception as e:
            print(f"[WARN] Save after consolidation failed: {e}")


class ConsolidateRequest(BaseModel):
    conversation_id: Optional[str] = None  # consolidate specific conversation, or latest


@router.get("/steps")
def get_consolidation_steps(patient_id: str):
    """Return the 5 consolidation step definitions."""
    return CONSOLIDATION_STEPS


@router.get("/pending")
def list_unconsolidated_conversations(patient_id: str):
    """List ended-but-unconsolidated conversations so failed runs are never stranded (H1)."""
    pg = _store["firewall"].get_patient_graph(patient_id)
    if not pg:
        raise HTTPException(404, "Patient not found")
    pending = [
        {
            "id": c.id,
            "label": c.label,
            "started_at": c.started_at,
            "status": c.status,
            "message_count": len(c.messages),
        }
        for c in pg.conversations
        if c.status == "ended" and len(c.messages) > 0
    ]
    return {"patient_id": patient_id, "pending_count": len(pending), "pending": pending}


@router.post("")
def trigger_consolidation(patient_id: str, req: ConsolidateRequest = None):
    """Run the full 5-step consolidation pipeline. Only marks 'consolidated' after all 5 steps succeed (H1)."""
    pg = _store["firewall"].get_patient_graph(patient_id)
    if not pg:
        raise HTTPException(404, "Patient not found")

    conv_id = req.conversation_id if req else None
    conv = None
    if conv_id:
        conv = pg.get_conversation(conv_id)
    else:
        for c in reversed(pg.conversations):
            if c.status == "ended":
                conv = c
                break
        if not conv and pg.conversations:
            conv = pg.conversations[-1]

    if not conv:
        raise HTTPException(400, "No conversation to consolidate")

    consolidation_engine = _store["consolidation_engine"]
    messages = [{"sender": m.sender, "text": m.text} for m in conv.messages]

    try:
        result = consolidation_engine.run_full_consolidation(pg, messages)
    except ConsolidationStepError as e:
        return JSONResponse(
            status_code=502,
            content={
                "status": "error",
                "detail": str(e),
                "failed_step": e.step_index,
                "steps": e.completed_steps,
                "conversation_id": conv.id,
                "conversation_status": conv.status,
            },
        )
    except Exception as e:
        return JSONResponse(
            status_code=502,
            content={
                "status": "error",
                "detail": f"Consolidation pipeline failed: {e}",
                "steps": [],
                "conversation_id": conv.id,
                "conversation_status": conv.status,
            },
        )

    # Mark consolidated ONLY after all 5 steps succeeded (H1)
    conv.status = "consolidated"
    pg.graph_version += 1
    _save(patient_id)
    return result


@router.post("/sweep")
def sweep_unconsolidated_sessions(patient_id: str):
    """Consolidate all ended-but-unconsolidated sessions with >= 1 message (H1)."""
    pg = _store["firewall"].get_patient_graph(patient_id)
    if not pg:
        raise HTTPException(404, "Patient not found")

    consolidation_engine = _store["consolidation_engine"]
    consolidated_ids = []
    errors = []

    for conv in pg.conversations:
        if conv.status == "ended":
            if len(conv.messages) == 0:
                conv.status = "consolidated"
                continue
            messages = [{"sender": m.sender, "text": m.text} for m in conv.messages]
            try:
                consolidation_engine.run_full_consolidation(pg, messages)
                conv.status = "consolidated"
                consolidated_ids.append(conv.id)
            except Exception as e:
                errors.append({"conversation_id": conv.id, "error": str(e)})

    if consolidated_ids:
        pg.graph_version += 1
    _save(patient_id)

    if errors:
        return JSONResponse(
            status_code=502,
            content={
                "status": "partial_error",
                "consolidated_ids": consolidated_ids,
                "errors": errors,
            },
        )

    return {
        "status": "complete",
        "consolidated_count": len(consolidated_ids),
        "consolidated_ids": consolidated_ids,
    }
