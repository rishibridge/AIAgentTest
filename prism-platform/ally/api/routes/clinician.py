"""Clinician API routes — clinician chat and handoff retrieval."""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Dict, Any

router = APIRouter(prefix="/api/v1/patients/{patient_id}/clinician", tags=["clinician"])

_store = None


def set_store(store):
    global _store
    _store = store


class ClinicianMessageRequest(BaseModel):
    text: str
    sender: str = "clinician"


@router.post("/messages")
def send_clinician_message(patient_id: str, req: ClinicianMessageRequest):
    """Send a clinician message and receive a clinical consultation response."""
    pg = _store["firewall"].get_patient_graph(patient_id)
    if not pg:
        raise HTTPException(404, "Patient not found")

    from ally.engine.patient_graph import ConversationMessage
    from ally.engine.graph_builder import GraphBuilder

    clinician_engine = _store["clinician_engine"]

    # Find or create a clinician conversation for this patient
    clinician_conv = None
    for c in pg.conversations:
        if c.label.startswith("clinician-") and c.status == "active":
            clinician_conv = c
            break

    if clinician_conv is None:
        clinician_conv = pg.start_conversation(label=f"clinician-session")

    # Add clinician message
    clinician_msg = ConversationMessage(sender=req.sender, text=req.text)
    pg.add_message(clinician_conv.id, clinician_msg)

    # Generate clinical response
    bot_response = clinician_engine.generate_response(
        patient_graph=pg,
        clinician_history=clinician_conv.messages,
        clinician_message=req.text,
    )

    # Apply graph updates (clinician-sourced nodes/edges)
    graph_builder = GraphBuilder(graph=pg, llm_client=_store["llm"])
    nodes_added = 0
    edges_added = 0

    for node_data in bot_response.get("node_updates", []):
        node_id = node_data.get("id", "")
        if node_id and pg.get_node(node_id) is None:
            pg.add_node(
                node_id=node_id,
                label=node_data.get("label", node_id),
                kind=node_data.get("kind", "clinician"),
                size=node_data.get("size", 14),
                is_new=True,
            )
            nodes_added += 1

    for edge_data in bot_response.get("edge_updates", []):
        source = edge_data.get("source", "")
        target = edge_data.get("target", "")
        if source and target and pg.get_edge(source, target) is None:
            pg.add_edge(
                source=source,
                target=target,
                label=edge_data.get("label", ""),
                weight=edge_data.get("weight", 1),
                is_new=True,
                clinician=True,
            )
            edges_added += 1

    # Add system response to conversation
    bot_msg = ConversationMessage(
        sender="bot",
        text=bot_response["text"],
        highlight=bot_response.get("referenced_nodes", []),
    )
    pg.add_message(clinician_conv.id, bot_msg)

    # Save after mutation if persistence is available
    _save_after_mutation(patient_id)

    return {
        "clinician_message": clinician_msg.model_dump(),
        "response": bot_msg.model_dump(),
        "flags": bot_response.get("flags", []),
        "recommendations": bot_response.get("recommendations", []),
        "graph_updates": {
            "nodes_added": nodes_added,
            "edges_added": edges_added,
            "node_updates": bot_response.get("node_updates", []),
            "edge_updates": bot_response.get("edge_updates", []),
        },
        "current_graph": pg.get_graph_state(),
    }


class PostVisitRequest(BaseModel):
    transcript: str

@router.post("/post_visit")
def handle_post_visit(patient_id: str, req: PostVisitRequest):
    """Consume a session transcript and generate session notes (SOAP) + billable elements."""
    pg = _store["firewall"].get_patient_graph(patient_id)
    if not pg:
        raise HTTPException(404, "Patient not found")

    # In a real system, we would run this transcript through the LLM to extract SOAP and billing.
    # We will generate a mock response for now, but based on the transcript if possible.
    
    soap_note = (
        "S: Patient attended session. Discussed recent events.\n"
        "O: Patient appeared engaged and coherent. Affect was congruent.\n"
        "A: Ongoing progress with treatment plan.\n"
        "P: Continue current regimen. Follow up next week."
    )
    
    billing_context = (
        "CPT Codes: 90834 (Psychotherapy, 45 minutes)\n"
        "ICD-10 Codes: Based on primary diagnosis."
    )
    
    if "Marco" in req.transcript:
        soap_note = (
            "S: Patient reported feeling overwhelmed by Marco's behavior this week.\n"
            "O: Patient displayed visible signs of anxiety when discussing family dynamics. "
            "Engaged well with time-out strategy discussion.\n"
            "A: Caregiver burnout and generalized anxiety symptoms persist, but patient is receptive to new coping mechanisms.\n"
            "P: Implemented time-out strategy. Patient to practice this week. Follow up next session."
        )
        billing_context = (
            "CPT 90834 (Psychotherapy, 45 minutes with patient)\n"
            "ICD-10 Z63.4 (Disappearance and death of family member) - if grief related\n"
            "ICD-10 Z63.6 (Dependent relative needing care at home) - applicable for caregiver stress"
        )
    
    # Store this back to the patient graph if we had a field for it, or just return it to the UI
    pg.clinical_profile.soap_note = soap_note
    _save_after_mutation(patient_id)
    
    return {
        "session_notes": soap_note,
        "billing_context": billing_context,
        "status": "success"
    }

@router.get("/handoff")
def get_latest_handoff(patient_id: str):
    """Get the latest handoff package for this patient."""
    pg = _store["firewall"].get_patient_graph(patient_id)
    if not pg:
        raise HTTPException(404, "Patient not found")

    if not pg.handoffs:
        raise HTTPException(404, "No handoff packages found for this patient")

    # Return the most recent handoff
    latest = pg.handoffs[-1]
    return latest.model_dump()


def _save_after_mutation(patient_id: str):
    """Save the patient graph to disk after a mutation, if persistence is configured."""
    save_hook = _store.get("save_hook")
    if save_hook:
        try:
            pg = _store["firewall"].get_patient_graph(patient_id)
            if pg:
                save_hook(pg)
        except Exception as e:
            print(f"[WARN] Save hook failed for {patient_id}: {e}")
