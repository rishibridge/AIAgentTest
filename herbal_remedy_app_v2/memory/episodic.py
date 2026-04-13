"""
Remy Hippocampus — Episodic Memory
Significant past moments stored as embedded, timestamped, significance-scored traces.
Supports similarity retrieval, temporal decay, and pruning.
"""
from datetime import datetime, timezone
import uuid
from memory.embeddings import embed_text, find_similar


class EpisodicMemory:
    """
    Long-term episodic store — significant moments from past sessions.
    Each trace has: text, embedding, timestamp, significance, emotional valence,
    entities, linked memories, decay rate, and optional superseded flag.
    """

    def __init__(self, memories: list[dict] = None):
        self.memories: list[dict] = memories or []

    def store(self, text: str, significance: float, emotional_valence: float,
              decay_rate: float, entities: list[str] = None,
              session_id: str = None, linked_to: list[str] = None,
              embedding: list[float] = None) -> dict:
        """
        Encode a significant moment into episodic memory.
        Generates embedding if not provided.
        """
        if embedding is None:
            embedding = embed_text(text)

        trace = {
            "id": f"mem_{uuid.uuid4().hex[:8]}",
            "text": text,
            "embedding": embedding,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "session_id": session_id,
            "emotional_valence": round(emotional_valence, 3),
            "significance": round(significance, 4),
            "decay_rate": round(decay_rate, 5),
            "entities": entities or [],
            "linked_to": linked_to or [],
            "superseded_by": None,
            "superseded_date": None,
        }

        self.memories.append(trace)
        return trace

    def retrieve(self, query: str, top_k: int = 5) -> list[dict]:
        """
        Find the most relevant past memories for a query.
        Excludes superseded memories. Weights: similarity × significance × recency.
        """
        # Filter out superseded memories
        active = [m for m in self.memories if not m.get("superseded_by")]

        if not active:
            return []

        query_embedding = embed_text(query)
        return find_similar(query_embedding, active, top_k=top_k)

    def retrieve_by_embedding(self, query_embedding: list[float], top_k: int = 5) -> list[dict]:
        """Retrieve using a pre-computed embedding."""
        active = [m for m in self.memories if not m.get("superseded_by")]
        if not active:
            return []
        return find_similar(query_embedding, active, top_k=top_k)

    def supersede(self, memory_id: str, superseded_by_id: str, note: str = ""):
        """Mark a memory as superseded (correction propagation)."""
        for mem in self.memories:
            if mem["id"] == memory_id:
                mem["superseded_by"] = superseded_by_id
                mem["superseded_date"] = datetime.now(timezone.utc).isoformat()
                if note:
                    mem["superseded_note"] = note
                break

    def find_by_entities(self, entities: list[str], min_significance: float = 0.3) -> list[dict]:
        """Find memories that mention specific entities."""
        results = []
        entity_set = set(e.lower() for e in entities)
        for mem in self.memories:
            if mem.get("superseded_by"):
                continue
            if mem["significance"] < min_significance:
                continue
            mem_entities = set(e.lower() for e in mem.get("entities", []))
            if mem_entities & entity_set:
                results.append(mem)
        return sorted(results, key=lambda m: -m["significance"])

    def decay_memories(self) -> int:
        """
        Apply temporal decay to all episodic memories.
        Returns count of pruned memories.
        """
        now = datetime.now(timezone.utc)
        pruned = 0

        for mem in self.memories:
            ts = mem.get("timestamp", "")
            if isinstance(ts, str) and ts:
                try:
                    mem_time = datetime.fromisoformat(ts.replace("Z", "+00:00"))
                    days_since = max((now - mem_time).total_seconds() / 86400, 0)
                except (ValueError, TypeError):
                    days_since = 0
            else:
                days_since = 0

            if days_since > 1:  # don't decay same-day memories
                decay_amount = mem.get("decay_rate", 0.01) * days_since
                mem["significance"] = max(0.0, mem["significance"] - decay_amount)

        # Prune memories below threshold
        before = len(self.memories)
        self.memories = [m for m in self.memories if m["significance"] > 0.03]
        pruned = before - len(self.memories)

        return pruned

    def get_recent(self, n: int = 5, min_significance: float = 0.3) -> list[dict]:
        """Get the N most recent significant memories."""
        active = [m for m in self.memories
                  if not m.get("superseded_by") and m["significance"] >= min_significance]
        active.sort(key=lambda m: m["timestamp"], reverse=True)
        return active[:n]

    def count(self) -> int:
        """Total number of active (non-superseded) memories."""
        return sum(1 for m in self.memories if not m.get("superseded_by"))

    def to_dict(self) -> list[dict]:
        """Serialize for Firestore. Note: embeddings are large float arrays."""
        return [
            {k: v for k, v in mem.items()}
            for mem in self.memories
        ]

    @classmethod
    def from_dict(cls, data: list[dict]) -> "EpisodicMemory":
        """Hydrate from Firestore."""
        return cls(memories=data)
