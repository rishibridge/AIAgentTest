"""
PatientGraph — Extends Prism's TemporalGraph for the Ally behavioral health companion.
All graph operations delegate to the inherited NetworkX MultiDiGraph.
"""
import uuid
import math
import random
from typing import Dict, Any, List, Optional, Tuple
from pydantic import BaseModel, Field
from datetime import datetime

from prism.engine.memory.graph import TemporalGraph, Node, Edge

# ── Node Kinds ──────────────────────────────────────────────────────
NODE_KINDS = [
    "self", "person", "clinical", "medication", "undisclosed", "belief",
    "event", "faith", "locked", "symptom", "significance", "referral",
    "inferred", "clinician", "clinician_safety", "therapist_locked",
    "avoidance", "agreed", "life",
]


def _coerce_label_str(raw: Any, fallback: str = "") -> str:
    """Ensure node/edge labels are always strings even if a dict was passed."""
    if isinstance(raw, str):
        return raw
    if isinstance(raw, dict):
        return str(raw.get("text") or raw.get("label") or fallback or str(raw))
    if raw is None:
        return fallback
    return str(raw)


# ── Conversation models (genuinely new — no Prism equivalent) ──────
class ConversationMessage(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    sender: str  # patient name or "bot"
    text: str
    timestamp: str = Field(default_factory=lambda: datetime.utcnow().isoformat())
    highlight: List[str] = Field(default_factory=list)
    adds_node: Optional[str] = None
    adds_nodes: List[str] = Field(default_factory=list)
    significance: bool = False
    pause_before: int = 0
    italic: bool = False
    # Telemetry metadata (M12)
    model: Optional[str] = None
    model_version: Optional[str] = None
    context_tokens: Optional[int] = None
    latency_ms: Optional[int] = None


class Conversation(BaseModel):
    id: str
    patient_id: str
    label: str = ""
    messages: List[ConversationMessage] = Field(default_factory=list)
    started_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())
    status: str = "active"  # active, ended, consolidated


class ClinicalHypothesis(BaseModel):
    id: str = Field(default_factory=lambda: f"hyp_{uuid.uuid4().hex[:8]}")
    text: str
    status: str = "open"  # open, confirmed, refuted
    generated_by: str = "gemini-2.5-flash"
    model_version: str = "ally-v1.1"
    confirmed_by: Optional[str] = None
    timestamp: str = Field(default_factory=lambda: datetime.utcnow().isoformat())
    updated_at: Optional[str] = None
    edge_source: Optional[str] = None
    edge_target: Optional[str] = None


class DebateVerdictRecord(BaseModel):
    id: str = Field(default_factory=lambda: f"verdict_{uuid.uuid4().hex[:8]}")
    session_id: str
    patient_id: str
    topic: str = ""
    judge_type: str = "ai"  # ai or human
    judge_name: str = "Chief Medical Arbiter"
    verdict_text: str = ""
    winning_position: Optional[str] = None
    score: int = 0
    resolved_divergence_id: Optional[str] = None
    rounds_count: int = 0
    judged_output: List[str] = Field(default_factory=list)
    timestamp: str = Field(default_factory=lambda: datetime.utcnow().isoformat())


class HandoffPackage(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    patient_id: str
    patient_name: str = ""
    recipient: str = ""
    context: str = ""
    demographics: Any = ""
    risk_assessment: Dict[str, Any] = Field(default_factory=lambda: {"level": "Low", "details": ""})
    clinical_narrative: str = ""
    active_themes: List[str] = Field(default_factory=list)
    metadata_shadows: List[str] = Field(default_factory=list)
    excluded_content_flag: bool = False
    quotes_vs_inferences: List[Dict[str, str]] = Field(default_factory=list)
    simplified_graph_mermaid: str = ""
    hypotheses: List[Any] = Field(default_factory=list)
    family_overlap_flag: Optional[str] = None
    generated_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())
    model: str = "gemini-2.5-flash"
    model_version: str = "ally-v1.1"
    graph_version: int = 1
    # Pre-computed graph data for InteractiveGraph component
    graph_nodes: List[Dict[str, Any]] = Field(default_factory=list)
    graph_edges: List[Dict[str, Any]] = Field(default_factory=list)
    graph_positions: Dict[str, Dict[str, float]] = Field(default_factory=dict)


class GraphSnapshot(BaseModel):
    id: str
    label: str
    timestamp: str
    node_ids: List[str]
    edge_ids: List[str]
    node_data: List[Dict[str, Any]]
    edge_data: List[Dict[str, Any]]


class Patient(BaseModel):
    id: str
    name: str
    age: int = 0
    bio: str = ""
    bot_context: str = ""
    anonymous: bool = False
    excluded_content: List[str] = Field(default_factory=list)
    locked_nodes: List[str] = Field(default_factory=list)
    is_custom_private: bool = False
    email_hash: str = ""
    password_hash: str = ""


# ── View wrappers (bridge Prism's Node/Edge to Ally's display format) ──
class _NodeView:
    """Lightweight view object that bridges Prism Node to Ally's expected shape."""
    __slots__ = ('id', 'label', 'size', 'kind', 'is_new', 'x', 'y', 'properties')

    def __init__(self, node: Node, pos: tuple):
        self.id = node.id
        self.label = _coerce_label_str(node.properties.get('label', node.id), fallback=node.id)
        self.size = node.properties.get('size', 14)
        self.kind = node.node_type
        self.is_new = node.properties.get('is_new', False)
        self.x = pos[0]
        self.y = pos[1]
        self.properties = node.properties

    def model_dump(self):
        return {
            'id': self.id, 'label': self.label, 'size': self.size,
            'kind': self.kind, 'is_new': self.is_new,
            'x': self.x, 'y': self.y, 'properties': self.properties,
        }

    def model_copy(self):
        copy = _NodeView.__new__(_NodeView)
        copy.id = self.id
        copy.label = self.label
        copy.size = self.size
        copy.kind = self.kind
        copy.is_new = self.is_new
        copy.x = self.x
        copy.y = self.y
        copy.properties = dict(self.properties)
        return copy


class _EdgeView:
    """Lightweight view object that bridges Prism Edge to Ally's expected shape."""
    __slots__ = ('id', 'source', 'target', 'label', 'weight', 'is_new', 'dashed', 'clinician', 'properties')

    def __init__(self, edge: Edge, key: str):
        self.id = key
        self.source = edge.source
        self.target = edge.target
        self.label = _coerce_label_str(edge.properties.get('label', ''), fallback='')
        self.weight = edge.properties.get('weight', 1)
        self.is_new = edge.properties.get('is_new', False)
        self.dashed = edge.properties.get('dashed', False)
        self.clinician = edge.properties.get('clinician', False)
        self.properties = edge.properties

    def model_dump(self):
        return {
            'id': self.id, 'source': self.source, 'target': self.target,
            'label': self.label, 'weight': self.weight,
            'is_new': self.is_new, 'dashed': self.dashed,
            'clinician': self.clinician, 'properties': self.properties,
        }

    def model_copy(self):
        copy = _EdgeView.__new__(_EdgeView)
        copy.id = self.id
        copy.source = self.source
        copy.target = self.target
        copy.label = self.label
        copy.weight = self.weight
        copy.is_new = self.is_new
        copy.dashed = self.dashed
        copy.clinician = self.clinician
        copy.properties = dict(self.properties)
        return copy


class PatientGraph(TemporalGraph):
    """
    Extends Prism's TemporalGraph with patient-specific semantics.
    All node/edge operations go through the inherited NetworkX MultiDiGraph.
    """

    def __init__(self, patient: Patient):
        super().__init__()  # Initializes self._graph (NetworkX) and self._divergences
        self.patient = patient
        self.snapshots: List[GraphSnapshot] = []
        self.conversations: List[Conversation] = []
        self.handoffs: List[HandoffPackage] = []
        self.debates: List[DebateVerdictRecord] = []
        self.graph_version: int = 1
        # Ally-specific: position + display metadata tracked per node
        self._positions: Dict[str, Tuple[float, float]] = {}
        self._display: Dict[str, Dict[str, Any]] = {}  # node_id -> {label, size, kind, is_new}

    # ── Node operations (delegate to TemporalGraph) ─────────────────
    def add_node(self, node_id: str, label: Any, kind: str = "event",
                 size: float = 14, x: float = 0.0, y: float = 0.0,
                 is_new: bool = False, properties: Dict[str, Any] = None) -> str:
        """Add a node using Prism's TemporalGraph.add_node with Ally display metadata."""
        props = dict(properties) if properties else {}
        if isinstance(label, dict):
            # Defensive safeguard against (node_type, properties_dict) callers (H5/H1)
            extra = dict(label)
            clean_label = _coerce_label_str(label, fallback=node_id)
            props.update(extra)
        else:
            clean_label = _coerce_label_str(label, fallback=node_id)

        props.update({
            "label": clean_label,
            "size": size,
            "kind": kind,
            "is_new": is_new,
        })
        if "text" not in props:
            props["text"] = clean_label.replace("\n", " ")

        # If node already exists in the graph, update it
        if self._graph.has_node(node_id):
            self._graph.nodes[node_id]['data'] = Node(id=node_id, node_type=kind, properties=props)
        else:
            # Use TemporalGraph's underlying graph directly with our chosen ID
            node = Node(id=node_id, node_type=kind, properties=props)
            self._graph.add_node(node_id, data=node)

        # Track position
        if x == 0.0 and y == 0.0 and self._positions:
            x, y = self._auto_position(node_id)
        self._positions[node_id] = (x, y)

        # Track display metadata
        self._display[node_id] = {
            "label": clean_label, "size": size, "kind": kind, "is_new": is_new
        }
        self.graph_version += 1

        return node_id

    def get_node(self, node_id: str) -> Optional[Node]:
        """Get a node from the inherited graph."""
        if self._graph.has_node(node_id):
            return self._graph.nodes[node_id].get('data')
        return None

    def remove_node(self, node_id: str) -> bool:
        """Remove a node and its connected edges from the inherited graph."""
        if self._graph.has_node(node_id):
            self._graph.remove_node(node_id)  # NetworkX removes connected edges
            self._positions.pop(node_id, None)
            self._display.pop(node_id, None)
            self.graph_version += 1
            return True
        return False

    # ── Edge operations (delegate to TemporalGraph) ─────────────────
    def add_edge(self, source: str, target: str, label: str = "",
                 weight: int = 1, is_new: bool = False,
                 dashed: bool = False, clinician: bool = False,
                 properties: Dict[str, Any] = None) -> str:
        """Add an edge using Prism's TemporalGraph.add_edge with Ally display metadata."""
        clean_label = _coerce_label_str(label, fallback="")
        props = dict(properties) if properties else {}
        props.update({
            "label": clean_label,
            "weight": weight,
            "is_new": is_new,
            "dashed": dashed,
            "clinician": clinician,
        })
        # Use deterministic key for Ally's source__target pattern
        edge_id = f"{source}__{target}"
        edge = Edge(id=edge_id, source=source, target=target, edge_type=clean_label, properties=props)
        self._graph.add_edge(source, target, key=edge_id, data=edge)
        self.graph_version += 1
        return edge_id

    def get_edge(self, source: str, target: str) -> Optional[Edge]:
        """Get an edge by source/target."""
        edge_id = f"{source}__{target}"
        if self._graph.has_edge(source, target, key=edge_id):
            return self._graph.edges[source, target, edge_id].get('data')
        return None

    def remove_edge(self, source: str, target: str) -> bool:
        """Remove a specific edge."""
        edge_id = f"{source}__{target}"
        if self._graph.has_edge(source, target, key=edge_id):
            self._graph.remove_edge(source, target, key=edge_id)
            self.graph_version += 1
            return True
        return False

    def thicken_edge(self, source: str, target: str, amount: int = 1) -> Optional[Edge]:
        """Increase edge weight (max 4)."""
        edge = self.get_edge(source, target)
        if edge:
            edge.properties["weight"] = min(4, edge.properties.get("weight", 1) + amount)
            self.graph_version += 1
        return edge

    def confirm_inferred_edge(self, source: str, target: str) -> Optional[Edge]:
        """Confirm a dashed/inferred edge — make it solid."""
        edge = self.get_edge(source, target)
        if edge and edge.properties.get("dashed"):
            edge.properties["dashed"] = False
            self.graph_version += 1
        return edge

    # ── Graph state queries ─────────────────────────────────────────
    @property
    def nodes(self) -> Dict[str, Any]:
        """Return dict of node_id -> display info (backwards compatible with old code)."""
        result = {}
        for node_id in self._graph.nodes:
            data = self._graph.nodes[node_id].get('data')
            if data:
                pos = self._positions.get(node_id, (0, 0))
                result[node_id] = _NodeView(data, pos)
        return result

    @property
    def edges(self) -> Dict[str, Any]:
        """Return dict of edge_id -> display info (backwards compatible with old code)."""
        result = {}
        for u, v, k, d in self._graph.edges(keys=True, data=True):
            data = d.get('data')
            if data:
                result[k] = _EdgeView(data, k)
        return result

    def get_graph_state(self) -> Dict[str, Any]:
        return {
            "patient_id": self.patient.id,
            "patient_name": self.patient.name,
            "graph_version": self.graph_version,
            "nodes": [n.model_dump() for n in self.nodes.values()],
            "edges": [e.model_dump() for e in self.edges.values()],
            "node_count": self._graph.number_of_nodes(),
            "edge_count": self._graph.number_of_edges(),
        }

    def get_positions(self) -> Dict[str, Dict[str, float]]:
        return {nid: {"x": pos[0], "y": pos[1]} for nid, pos in self._positions.items()}

    # ── Snapshots ───────────────────────────────────────────────────
    def snapshot(self, label: str, timestamp: Optional[str] = None, snap_id: Optional[str] = None) -> GraphSnapshot:
        snap = GraphSnapshot(
            id=snap_id or str(uuid.uuid4()),
            label=label,
            timestamp=timestamp or datetime.utcnow().isoformat(),
            node_ids=list(self._graph.nodes),
            edge_ids=[k for _, _, k in self._graph.edges(keys=True)],
            node_data=[n.model_dump() for n in self.nodes.values()],
            edge_data=[e.model_dump() for e in self.edges.values()],
        )
        self.snapshots.append(snap)
        return snap

    # ── Conversations ───────────────────────────────────────────────
    def start_conversation(
        self,
        label: str = "",
        started_at: Optional[str] = None,
        conv_id: Optional[str] = None,
    ) -> Conversation:
        conv = Conversation(
            id=conv_id or str(uuid.uuid4()),
            patient_id=self.patient.id,
            label=label,
            started_at=started_at or datetime.utcnow().isoformat(),
        )
        self.conversations.append(conv)
        return conv

    def get_conversation(self, conv_id: str) -> Optional[Conversation]:
        for c in self.conversations:
            if c.id == conv_id:
                return c
        return None

    def add_message(self, conv_id: str, message: ConversationMessage) -> Optional[ConversationMessage]:
        conv = self.get_conversation(conv_id)
        if conv:
            conv.messages.append(message)
            self.graph_version += 1
            return message
        return None

    # ── Auto-positioning ────────────────────────────────────────────
    def _auto_position(self, node_id: str) -> Tuple[float, float]:
        """Place new node in a clean golden-angle radial constellation around the central self node."""
        if not self._positions:
            return (550.0, 310.0)
        self_pos = None
        for nid in self._graph.nodes:
            data = self._graph.nodes[nid].get("data")
            if data and getattr(data, "node_type", "") == "self" and nid in self._positions:
                self_pos = self._positions[nid]
                break
        if self_pos:
            cx, cy = self_pos
        else:
            xs = [p[0] for p in self._positions.values()]
            ys = [p[1] for p in self._positions.values()]
            cx = sum(xs) / len(xs)
            cy = sum(ys) / len(ys)

        idx = max(1, len(self._positions))
        golden_angle = 2.399963229728653  # 137.507764 degrees in radians
        angle = idx * golden_angle
        ring = (idx - 1) // 7
        radius = 155.0 + ring * 72.0
        x = round(max(80.0, min(1020.0, cx + radius * math.cos(angle))), 1)
        y = round(max(70.0, min(550.0, cy + radius * math.sin(angle))), 1)
        return (x, y)

    # ── Serialization ───────────────────────────────────────────────
    def to_dict(self) -> Dict[str, Any]:
        return {
            "patient": self.patient.model_dump(exclude={"password_hash"}),
            "graph_version": self.graph_version,
            "graph": self.get_graph_state(),
            "conversations": [c.model_dump() for c in self.conversations],
            "snapshots": [s.model_dump() for s in self.snapshots],
            "handoffs": [h.model_dump() for h in self.handoffs],
            "debates": [d.model_dump() for d in self.debates],
        }
