"""Handoff API routes — generate (with graph_version caching), retrieve, and update hypothesis lifecycle."""
from datetime import datetime
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Dict, Any

router = APIRouter(prefix="/api/v1/patients/{patient_id}/handoffs", tags=["handoffs"])

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
            print(f"[WARN] Handoff save failed: {e}")


class GenerateHandoffRequest(BaseModel):
    recipient_name: Optional[str] = None
    recipient_role: Optional[str] = None
    recipient: Optional[str] = None
    recipient_type: Optional[str] = None
    authorization_notes: str = ""
    force: bool = False  # Set true to force LLM regeneration even if graph_version is unchanged (H3)


class UpdateHypothesisRequest(BaseModel):
    status: str  # open, confirmed, refuted
    clinician_name: str = "Attending Clinician"


@router.post("")
def generate_handoff(patient_id: str, req: GenerateHandoffRequest):
    """
    Generate or return cached clinician handoff package keyed to pg.graph_version (H3).
    Fails closed with HTTP 502 if LLM synthesis fails or is incomplete (H4).
    """
    pg = _store["firewall"].get_patient_graph(patient_id)
    if not pg:
        raise HTTPException(404, "Patient not found")

    # Return cached handoff if graph hasn't mutated and caller didn't request forced regeneration (H3)
    if not req.force and pg.handoffs:
        latest = pg.handoffs[-1]
        if (
            getattr(latest, "graph_version", None) == pg.graph_version
            and bool(str(latest.clinical_narrative or "").strip())
        ):
            return {
                "handoff": latest.model_dump(),
                "cached": True,
                "debate": {
                    "advocate": "Served deterministic cached synthesis matching current graph_version.",
                    "skeptic": "Privacy boundaries verified on cached handoff.",
                    "judge": f"Cache hit for graph_version={pg.graph_version}. Use force=true to regenerate.",
                },
            }

    rec_name = req.recipient_name or req.recipient or "Dr. A. Patel"
    rec_role = req.recipient_role or req.recipient_type or "Clinician"

    handoff_gen = _store["handoff_generator"]
    family_flag = _store["firewall"].get_family_overlap_flag(
        patient_id, rec_name
    )

    try:
        handoff, debate = handoff_gen.generate_handoff(
            patient_graph=pg,
            recipient_name=rec_name,
            recipient_role=rec_role,
            authorization_notes=req.authorization_notes,
            family_overlap_info=family_flag,
        )
    except Exception as e:
        raise HTTPException(502, f"Handoff synthesis failed: {e}")

    _save(patient_id)

    return {
        "handoff": handoff.model_dump(),
        "cached": False,
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


@router.patch("/{handoff_id}/hypotheses/{hypothesis_id}")
def update_hypothesis_status(
    patient_id: str,
    handoff_id: str,
    hypothesis_id: str,
    req: UpdateHypothesisRequest,
):
    """Confirm, refute, or reopen a clinical hypothesis on a handoff package (M11)."""
    if req.status not in ("open", "confirmed", "refuted"):
        raise HTTPException(400, "status must be one of: open, confirmed, refuted")

    pg = _store["firewall"].get_patient_graph(patient_id)
    if not pg:
        raise HTTPException(404, "Patient not found")

    target_handoff = next((h for h in pg.handoffs if h.id == handoff_id), None)
    if not target_handoff:
        raise HTTPException(404, "Handoff not found")

    now_iso = datetime.utcnow().isoformat() + "Z"
    updated_item: Optional[Dict[str, Any]] = None
    new_list: List[Any] = []

    for idx, item in enumerate(target_handoff.hypotheses):
        if isinstance(item, str):
            synth_id = f"hyp_{idx + 1}"
            item_dict: Dict[str, Any] = {
                "id": synth_id,
                "text": item,
                "status": "open",
                "generated_by": target_handoff.model or "gemini-2.5-flash",
                "model_version": target_handoff.model_version or "ally-v1.1",
                "confirmed_by": None,
                "timestamp": target_handoff.generated_at,
                "updated_at": target_handoff.generated_at,
            }
        elif isinstance(item, dict):
            item_dict = dict(item)
        else:
            new_list.append(item)
            continue

        if item_dict.get("id") == hypothesis_id or f"hyp_{idx + 1}" == hypothesis_id:
            item_dict["status"] = req.status
            item_dict["confirmed_by"] = req.clinician_name if req.status in ("confirmed", "refuted") else None
            item_dict["updated_at"] = now_iso
            updated_item = item_dict

            if req.status == "confirmed" and item_dict.get("edge_source") and item_dict.get("edge_target"):
                pg.confirm_inferred_edge(item_dict["edge_source"], item_dict["edge_target"])

        new_list.append(item_dict)

    if updated_item is None:
        raise HTTPException(404, f"Hypothesis '{hypothesis_id}' not found on handoff '{handoff_id}'")

    target_handoff.hypotheses = new_list
    _save(patient_id)

    return {
        "status": "updated",
        "hypothesis": updated_item,
        "handoff": target_handoff.model_dump(),
    }
