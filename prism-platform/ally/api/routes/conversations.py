"""Conversation API routes — start conversations, sweep abandoned sessions (M2), send messages with telemetry (M12)."""
from datetime import datetime, timedelta
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Dict, Any

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


def _parse_iso(ts: str) -> Optional[datetime]:
    if not ts:
        return None
    try:
        cleaned = ts.rstrip("Z")
        return datetime.fromisoformat(cleaned)
    except ValueError:
        return None


def _prune_abandoned_zero_message_sessions(pg, max_age_seconds: int = 120) -> int:
    """
    Remove zero-message 'active' conversations older than max_age_seconds (M2).
    When max_age_seconds == 0, prunes all prior zero-message active sessions immediately.
    """
    now = datetime.utcnow()
    kept = []
    removed_ids = set()

    for c in pg.conversations:
        if c.status == "active" and len(c.messages) == 0:
            started = _parse_iso(c.started_at)
            if max_age_seconds <= 0 or started is None or (now - started) > timedelta(seconds=max_age_seconds):
                removed_ids.add(c.id[:8])
                continue
        kept.append(c)

    if removed_ids:
        pg.conversations = kept
        pg.snapshots = [
            s for s in pg.snapshots
            if not any(s.label == f"pre-session-{short_id}" for short_id in removed_ids)
        ]
    return len(removed_ids)


@router.post("")
def start_conversation(patient_id: str, req: StartConversationRequest = None):
    pg = _store["firewall"].get_patient_graph(patient_id)
    if not pg:
        raise HTTPException(404, "Patient not found")

    # Sweep any prior abandoned 0-message active sessions before opening a new one (M2)
    _prune_abandoned_zero_message_sessions(pg, max_age_seconds=0)

    label = req.label if req else ""
    conv = pg.start_conversation(label=label)
    pg.snapshot(f"pre-session-{conv.id[:8]}")

    conv_engine = _store["conversation_engine"]
    conv_engine.start_session(pg)

    _save_delta(patient_id)

    return {"conversation_id": conv.id, "status": "active", "started_at": conv.started_at}


@router.get("")
def list_conversations(patient_id: str):
    pg = _store["firewall"].get_patient_graph(patient_id)
    if not pg:
        raise HTTPException(404, "Patient not found")

    pruned = _prune_abandoned_zero_message_sessions(pg, max_age_seconds=120)
    if pruned:
        _save_delta(patient_id)

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
    """Send a patient message and receive a real bot response with model, version, context_tokens, and latency_ms (M12)."""
    pg = _store["firewall"].get_patient_graph(patient_id)
    if not pg:
        raise HTTPException(404, "Patient not found")

    conv = pg.get_conversation(conv_id)
    if not conv:
        raise HTTPException(404, "Conversation not found")

    from ally.engine.patient_graph import ConversationMessage

    sender = req.sender or pg.patient.name.split()[0].lower()
    patient_msg = ConversationMessage(sender=sender, text=req.text)
    pg.add_message(conv_id, patient_msg)

    conv_engine = _store["conversation_engine"]
    bot_response = conv_engine.generate_response(
        patient_graph=pg,
        conversation_history=conv.messages,
        patient_message=req.text,
        conversation_id=conv_id,
    )

    added_node_ids = [
        tc["result"].get("node_id") or tc["args"].get("node_id", "")
        for tc in bot_response.get("tool_calls", [])
        if tc["tool"] == "add_node" and tc["result"].get("status") in ("created", "updated")
    ]

    model_name = bot_response.get("model", "gemini-2.5-flash")
    model_version = bot_response.get("model_version", "ally-v1.1")
    context_tokens = bot_response.get("context_tokens", 0)
    latency_ms = bot_response.get("latency_ms", 0)

    bot_msg = ConversationMessage(
        sender="bot",
        text=bot_response["text"],
        significance=bot_response.get("significance", False),
        highlight=bot_response.get("highlight", []),
        adds_nodes=added_node_ids,
        model=model_name,
        model_version=model_version,
        context_tokens=context_tokens,
        latency_ms=latency_ms,
    )
    pg.add_message(conv_id, bot_msg)

    _save_delta(patient_id)

    return {
        "patient_message": patient_msg.model_dump(),
        "bot_response": bot_msg.model_dump(),
        "model": model_name,
        "model_version": model_version,
        "version": model_version,
        "context_tokens": context_tokens,
        "latency_ms": latency_ms,
        "tool_calls": bot_response.get("tool_calls", []),
        "graph_updates": {
            "nodes_added": len(added_node_ids),
            "tool_calls": bot_response.get("tool_calls", []),
        },
        "current_graph": pg.get_graph_state(),
    }


@router.post("/{conv_id}/end")
def end_conversation(patient_id: str, conv_id: str):
    """Mark a conversation as ended (or prune if 0 messages) and persist full state (M2)."""
    pg = _store["firewall"].get_patient_graph(patient_id)
    if not pg:
        raise HTTPException(404, "Patient not found")
    conv = pg.get_conversation(conv_id)
    if not conv:
        raise HTTPException(404, "Conversation not found")

    if len(conv.messages) == 0:
        pg.conversations = [c for c in pg.conversations if c.id != conv_id]
        pg.snapshots = [s for s in pg.snapshots if s.label != f"pre-session-{conv_id[:8]}"]
        _save_delta(patient_id)
        return {"status": "abandoned_pruned", "message_count": 0}

    conv.status = "ended"
    pg.snapshot(f"post-session-{conv_id[:8]}")
    _save_delta(patient_id)

    return {"status": "ended", "message_count": len(conv.messages)}


@router.post("/{conv_id}/abandon")
def abandon_conversation(patient_id: str, conv_id: str):
    """Called on page unload / view navigation to clean up 0-message sessions or end active ones (M2)."""
    pg = _store["firewall"].get_patient_graph(patient_id)
    if not pg:
        raise HTTPException(404, "Patient not found")
    conv = pg.get_conversation(conv_id)
    if not conv:
        return {"status": "already_closed"}

    if len(conv.messages) == 0:
        pg.conversations = [c for c in pg.conversations if c.id != conv_id]
        pg.snapshots = [s for s in pg.snapshots if s.label != f"pre-session-{conv_id[:8]}"]
        _save_delta(patient_id)
        return {"status": "pruned", "message_count": 0}

    if conv.status == "active":
        conv.status = "ended"
        _save_delta(patient_id)
    return {"status": conv.status, "message_count": len(conv.messages)}


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
