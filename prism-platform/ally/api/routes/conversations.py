"""Conversation API routes — start conversations, send messages, get real bot responses."""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import uuid

router = APIRouter(prefix="/api/v1/patients/{patient_id}/conversations", tags=["conversations"])

_store = None

def set_store(store):
    global _store
    _store = store


class SendMessageRequest(BaseModel):
    text: str
    sender: Optional[str] = None  # defaults to patient name


class StartConversationRequest(BaseModel):
    label: str = ""


@router.post("")
def start_conversation(patient_id: str, req: StartConversationRequest = None):
    pg = _store["firewall"].get_patient_graph(patient_id)
    if not pg:
        raise HTTPException(404, "Patient not found")

    label = req.label if req else ""
    conv = pg.start_conversation(label=label)
    # Snapshot graph at conversation start
    pg.snapshot(f"pre-session-{conv.id[:8]}")

    # Initialize session context — full graph loaded into LLM context once
    conv_engine = _store["conversation_engine"]
    conv_engine.start_session(pg)

    # Save delta
    _save_delta(patient_id)

    return {"conversation_id": conv.id, "status": "active"}


@router.get("")
def list_conversations(patient_id: str):
    pg = _store["firewall"].get_patient_graph(patient_id)
    if not pg:
        raise HTTPException(404, "Patient not found")
    return [
        {
            "id": c.id,
            "label": c.label,
            "message_count": len(c.messages),
            "status": c.status,
            "started_at": c.started_at,
        }
        for c in pg.conversations
    ]


@router.get("/{conv_id}")
def get_conversation(patient_id: str, conv_id: str):
    pg = _store["firewall"].get_patient_graph(patient_id)
    if not pg:
        raise HTTPException(404, "Patient not found")
    conv = pg.get_conversation(conv_id)
    if not conv:
        raise HTTPException(404, "Conversation not found")
    return conv.model_dump()


@router.post("/{conv_id}/messages")
def send_message(patient_id: str, conv_id: str, req: SendMessageRequest):
    """Send a patient message and receive a real bot response via function calling."""
    pg = _store["firewall"].get_patient_graph(patient_id)
    if not pg:
        raise HTTPException(404, "Patient not found")

    conv = pg.get_conversation(conv_id)
    if not conv:
        raise HTTPException(404, "Conversation not found")

    from ally.engine.patient_graph import ConversationMessage

    # Add patient message
    sender = req.sender or pg.patient.name.split()[0].lower()
    patient_msg = ConversationMessage(sender=sender, text=req.text)
    pg.add_message(conv_id, patient_msg)

    # Generate bot response using function calling
    conv_engine = _store["conversation_engine"]
    bot_response = conv_engine.generate_response(
        patient_graph=pg,
        conversation_history=conv.messages,
        patient_message=req.text,
    )

    # Tool calls already applied graph updates directly — no need for GraphBuilder

    # Extract node IDs from tool calls for adds_nodes field
    added_node_ids = [
        tc["args"].get("node_id", "")
        for tc in bot_response.get("tool_calls", [])
        if tc["tool"] == "add_node" and tc["result"].get("status") == "created"
    ]

    # Add bot message to conversation
    bot_msg = ConversationMessage(
        sender="bot",
        text=bot_response["text"],
        significance=bot_response.get("significance", False),
        highlight=bot_response.get("highlight", []),
        adds_nodes=added_node_ids,
    )
    pg.add_message(conv_id, bot_msg)

    # Save delta after every message
    _save_delta(patient_id)

    return {
        "patient_message": patient_msg.model_dump(),
        "bot_response": bot_msg.model_dump(),
        "tool_calls": bot_response.get("tool_calls", []),
        "graph_updates": {
            "nodes_added": len(added_node_ids),
            "tool_calls": bot_response.get("tool_calls", []),
        },
        "current_graph": pg.get_graph_state(),
    }


@router.post("/{conv_id}/end")
def end_conversation(patient_id: str, conv_id: str):
    """Mark a conversation as ended and persist full state."""
    pg = _store["firewall"].get_patient_graph(patient_id)
    if not pg:
        raise HTTPException(404, "Patient not found")
    conv = pg.get_conversation(conv_id)
    if not conv:
        raise HTTPException(404, "Conversation not found")
    conv.status = "ended"
    pg.snapshot(f"post-session-{conv_id[:8]}")

    # Full save at session end
    _save_delta(patient_id)

    return {"status": "ended", "message_count": len(conv.messages)}


def _save_delta(patient_id: str):
    """Save patient graph to disk after mutation."""
    try:
        save_hook = _store.get("save_hook")
        if save_hook:
            pg = _store["firewall"].get_patient_graph(patient_id)
            if pg:
                save_hook(pg)
    except Exception as e:
        print(f"[WARN] Delta save failed for {patient_id}: {e}")
