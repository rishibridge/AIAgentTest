"""
Remy Hippocampus — Working Memory
Short-term session buffer. Holds raw exchanges with timestamps and real-time
emotional valence. Dies with the session but feeds into consolidation.
"""
from datetime import datetime, timezone
from memory.significance import compute_realtime_valence


class WorkingMemory:
    """Current session buffer — the hippocampal 'scratchpad'."""

    def __init__(self, session_id: str):
        self.session_id = session_id
        self.exchanges: list[dict] = []
        self.started_at = datetime.now(timezone.utc)
        self.turn_count = 0

    def add_exchange(self, user_msg: str, assistant_msg: str):
        """Store a user-assistant exchange with metadata."""
        self.turn_count += 1
        valence = compute_realtime_valence(user_msg)

        self.exchanges.append({
            "turn": self.turn_count,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "user_msg": user_msg,
            "assistant_msg": assistant_msg,
            "emotional_valence": round(valence, 3),
        })

    def get_full_transcript(self) -> str:
        """Format the full session as a readable transcript."""
        lines = []
        for ex in self.exchanges:
            ts = ex["timestamp"][:19]  # trim to seconds
            lines.append(f"[{ts}] Patient: {ex['user_msg']}")
            lines.append(f"[{ts}] Remy: {ex['assistant_msg']}")
        return "\n".join(lines)

    def get_user_messages(self) -> list[str]:
        """Return all user messages from this session."""
        return [ex["user_msg"] for ex in self.exchanges]

    def get_history_for_gemini(self) -> list[dict]:
        """Return exchanges in the {role, content} format for Gemini API."""
        history = []
        for ex in self.exchanges:
            history.append({"role": "user", "content": ex["user_msg"]})
            history.append({"role": "assistant", "content": ex["assistant_msg"]})
        return history

    def get_last_exchange(self) -> dict | None:
        """Return the most recent exchange, or None."""
        return self.exchanges[-1] if self.exchanges else None

    def get_session_duration_minutes(self) -> float:
        """How long this session has been active."""
        delta = datetime.now(timezone.utc) - self.started_at
        return delta.total_seconds() / 60.0

    def to_dict(self) -> dict:
        """Serialize for logging/persistence."""
        return {
            "session_id": self.session_id,
            "started_at": self.started_at.isoformat(),
            "turn_count": self.turn_count,
            "exchanges": self.exchanges,
        }
