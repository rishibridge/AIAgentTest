"""
Remy Hippocampus — Association Graph
Typed, weighted, timestamped edges between entities.
Implements Hebbian strengthening, spread activation, and temporal decay.
"""
from datetime import datetime, timezone
import copy


class AssociationGraph:
    """
    Hippocampal association network.
    Nodes = entities (conditions, symptoms, behaviors, emotions, interventions).
    Edges = typed, weighted, timestamped links with Hebbian strengthening.
    """

    # Valid edge types
    EDGE_TYPES = {
        "causes", "worsens", "treats", "triggers", "correlates",
        "contradicts", "replaces", "formerly_treated",
    }

    def __init__(self, nodes: dict = None, edges: list = None):
        self.nodes: dict[str, dict] = nodes or {}  # entity_id → node dict
        self.edges: list[dict] = edges or []

    # ── Node Management ────────────────────────────────────

    def ensure_node(self, entity_id: str, entity_type: str = "unknown",
                    label: str = None):
        """Create a node if it doesn't exist, or update last_activated."""
        if entity_id not in self.nodes:
            self.nodes[entity_id] = {
                "entity_id": entity_id,
                "entity_type": entity_type,
                "label": label or entity_id,
                "first_seen": datetime.now(timezone.utc).isoformat(),
                "last_activated": datetime.now(timezone.utc).isoformat(),
                "activation_count": 1,
            }
        else:
            self.nodes[entity_id]["last_activated"] = datetime.now(timezone.utc).isoformat()
            self.nodes[entity_id]["activation_count"] += 1

    # ── Edge Management (Hebbian Strengthening) ────────────

    def find_edge(self, from_entity: str, to_entity: str) -> dict | None:
        """Find an existing edge between two entities."""
        for edge in self.edges:
            if edge["from"] == from_entity and edge["to"] == to_entity:
                return edge
        return None

    def add_or_strengthen(self, from_entity: str, to_entity: str,
                          edge_type: str, emotional_charge: float = 0.0,
                          evidence_id: str = None,
                          from_type: str = "unknown", to_type: str = "unknown"):
        """
        Hebbian learning: if edge exists, strengthen it. If not, create it.

        Strength formula (asymptotic):
            base = 1 - (1 / (1 + count × 0.3))
            final = base × emotion_multiplier
            (capped at 0.99)

        Emotional charge accelerates strengthening — high-emotion
        co-occurrences wire faster, analogous to amygdala amplification.
        """
        # Ensure nodes exist
        self.ensure_node(from_entity, entity_type=from_type)
        self.ensure_node(to_entity, entity_type=to_type)

        existing = self.find_edge(from_entity, to_entity)

        if existing is None:
            # FIRST CO-OCCURRENCE — create weak edge
            new_edge = {
                "from": from_entity,
                "to": to_entity,
                "type": edge_type,
                "strength": 0.30,
                "emotional_charge": round(emotional_charge, 3),
                "created": datetime.now(timezone.utc).isoformat(),
                "last_activated": datetime.now(timezone.utc).isoformat(),
                "activation_count": 1,
                "evidence": [evidence_id] if evidence_id else [],
            }
            self.edges.append(new_edge)
            return new_edge
        else:
            # REPEATED CO-OCCURRENCE — Hebbian strengthening
            existing["activation_count"] += 1
            existing["last_activated"] = datetime.now(timezone.utc).isoformat()
            if evidence_id:
                existing["evidence"].append(evidence_id)
                # Cap evidence list
                if len(existing["evidence"]) > 20:
                    existing["evidence"] = existing["evidence"][-20:]

            count = existing["activation_count"]

            # Asymptotic strength formula
            base_strength = 1.0 - (1.0 / (1.0 + count * 0.3))

            # Emotional amplification (amygdala analog)
            emotion_multiplier = 1.0 + abs(emotional_charge) * 0.5

            existing["strength"] = min(0.99, round(base_strength * emotion_multiplier, 4))

            # Running average of emotional charge (weighted toward extremes)
            existing["emotional_charge"] = round(
                existing["emotional_charge"] * 0.7 + emotional_charge * 0.3, 3
            )

            # Update edge type if a stronger causal claim is made
            if edge_type in ("causes", "worsens", "treats") and existing["type"] == "correlates":
                existing["type"] = edge_type

            return existing

    # ── Spread Activation ──────────────────────────────────

    def activate(self, seed_entity: str, depth: int = 2,
                 min_strength: float = 0.15,
                 min_activation: float = 0.1) -> list[tuple[str, float, str]]:
        """
        Pattern completion — spread activation from seed through the graph.

        Returns: list of (entity_id, activation_level, via_edge_type)
                 sorted by activation level, excluding seed.
        """
        activated = {seed_entity: (1.0, "seed")}
        frontier = [seed_entity]

        for d in range(depth):
            next_frontier = []
            for entity in frontier:
                for edge in self.edges:
                    if edge["strength"] < min_strength:
                        continue

                    target = None
                    if edge["from"] == entity:
                        target = edge["to"]
                    elif edge["to"] == entity:
                        # Reverse traversal (bidirectional activation)
                        target = edge["from"]

                    if target is None or target == seed_entity:
                        continue

                    # Activation decays with depth and scales with edge strength
                    parent_activation = activated[entity][0]
                    new_activation = parent_activation * edge["strength"] * 0.7

                    if new_activation < min_activation:
                        continue

                    if target not in activated or new_activation > activated[target][0]:
                        activated[target] = (round(new_activation, 4), edge["type"])
                        next_frontier.append(target)

            frontier = next_frontier

        # Return sorted by activation, excluding seed
        results = [
            (entity, level, via)
            for entity, (level, via) in activated.items()
            if entity != seed_entity
        ]
        return sorted(results, key=lambda x: -x[1])

    # ── Temporal Decay ─────────────────────────────────────

    def decay_associations(self) -> int:
        """
        Weaken unused association edges over time.
        High emotional charge slows decay by up to 5×.
        Returns count of pruned edges.
        """
        now = datetime.now(timezone.utc)
        pruned = 0

        for edge in self.edges:
            try:
                last = datetime.fromisoformat(
                    edge["last_activated"].replace("Z", "+00:00")
                )
                days_since = max((now - last).total_seconds() / 86400, 0)
            except (ValueError, TypeError, KeyError):
                days_since = 0

            if days_since > 7:  # grace period: no decay for first week
                base_decay = 0.01 * (days_since - 7)
                # Emotional charge slows decay
                emotion_resistance = 1.0 - abs(edge.get("emotional_charge", 0)) * 0.8
                decay = base_decay * max(emotion_resistance, 0.2)
                edge["strength"] = max(0.0, round(edge["strength"] - decay, 4))

        # Prune edges below threshold
        before = len(self.edges)
        self.edges = [e for e in self.edges if e["strength"] > 0.03]
        pruned = before - len(self.edges)

        return pruned

    # ── Query Helpers ──────────────────────────────────────

    def get_edges_from(self, entity: str, min_strength: float = 0.1) -> list[dict]:
        """Get all outgoing edges from an entity above minimum strength."""
        return [
            e for e in self.edges
            if e["from"] == entity and e["strength"] >= min_strength
        ]

    def get_edges_involving(self, entity: str, min_strength: float = 0.1) -> list[dict]:
        """Get all edges involving an entity (either direction)."""
        return [
            e for e in self.edges
            if (e["from"] == entity or e["to"] == entity) and e["strength"] >= min_strength
        ]

    def get_strongest_associations(self, entity: str, top_k: int = 5) -> list[dict]:
        """Get the strongest edges involving an entity."""
        edges = self.get_edges_involving(entity)
        edges.sort(key=lambda e: -e["strength"])
        return edges[:top_k]

    def get_summary(self) -> str:
        """Human-readable summary for LLM prompts."""
        if not self.edges:
            return "No associations recorded yet."

        # Only include edges with meaningful strength
        strong = [e for e in self.edges if e["strength"] >= 0.2]
        strong.sort(key=lambda e: -e["strength"])

        lines = []
        for e in strong[:20]:  # cap at 20 to avoid prompt bloat
            lines.append(
                f"  {e['from']} ──{e['type']}──→ {e['to']} "
                f"(strength: {e['strength']}, count: {e['activation_count']})"
            )

        return "Association Graph:\n" + "\n".join(lines)

    def node_count(self) -> int:
        return len(self.nodes)

    def edge_count(self) -> int:
        return len(self.edges)

    # ── Serialization ──────────────────────────────────────

    def to_dict(self) -> dict:
        """Serialize for Firestore."""
        return {
            "nodes": copy.deepcopy(self.nodes),
            "edges": copy.deepcopy(self.edges),
        }

    @classmethod
    def from_dict(cls, data: dict) -> "AssociationGraph":
        """Hydrate from Firestore."""
        return cls(
            nodes=data.get("nodes", {}),
            edges=data.get("edges", []),
        )
