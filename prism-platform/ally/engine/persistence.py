"""
Persistence — Save and load patient graphs to/from disk as JSON files.
One JSON file per patient in the ally/data/ directory.
Uses networkx.readwrite.json_graph for graph serialization.
"""
import json
import os
from typing import Dict, Any, Optional
from pathlib import Path

import networkx as nx
from networkx.readwrite.json_graph import node_link_data, node_link_graph

from prism.engine.memory.graph import Node, Edge, Divergence
from ally.engine.patient_graph import (
    Patient, PatientGraph, Conversation, ConversationMessage,
    HandoffPackage, GraphSnapshot,
)
from ally.engine.firewall import PatientFirewall

# Default data directory: ally/data/ relative to the project root
_PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
DEFAULT_DATA_DIR = str(_PROJECT_ROOT / "ally" / "data")


def _ensure_dir(data_dir: str) -> None:
    """Create the data directory if it doesn't exist."""
    os.makedirs(data_dir, exist_ok=True)


def _sanitize_for_json(obj):
    """Recursively convert any Pydantic models to dicts for JSON serialization."""
    if hasattr(obj, "model_dump"):
        return obj.model_dump()
    elif isinstance(obj, dict):
        return {k: _sanitize_for_json(v) for k, v in obj.items()}
    elif isinstance(obj, (list, tuple)):
        return [_sanitize_for_json(item) for item in obj]
    return obj


# ── Save a single patient ───────────────────────────────────────────

def save_patient(patient_graph: PatientGraph, data_dir: str = DEFAULT_DATA_DIR) -> str:
    """
    Save one patient's full state to a JSON file: {patient_id}.json.
    Returns the path to the written file.
    """
    _ensure_dir(data_dir)

    # Serialize the NetworkX graph via node_link_data then sanitize all Pydantic objects
    graph_data = _sanitize_for_json(node_link_data(patient_graph._graph))

    # Serialize positions
    positions = {
        nid: {"x": pos[0], "y": pos[1]}
        for nid, pos in patient_graph._positions.items()
    }

    # Serialize divergences from the inherited TemporalGraph
    divergences = {
        div_id: div.model_dump()
        for div_id, div in patient_graph._divergences.items()
    }

    # Build the full save payload
    payload = {
        "patient": patient_graph.patient.model_dump(),
        "graph_nx": graph_data,
        "positions": positions,
        "display": dict(patient_graph._display),
        "divergences": divergences,
        "conversations": [c.model_dump() for c in patient_graph.conversations],
        "snapshots": [s.model_dump() for s in patient_graph.snapshots],
        "handoffs": [h.model_dump() for h in patient_graph.handoffs],
    }

    file_path = os.path.join(data_dir, f"{patient_graph.patient.id}.json")
    with open(file_path, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2, ensure_ascii=False)

    return file_path


# ── Load a single patient ───────────────────────────────────────────

def load_patient(patient_id: str, data_dir: str = DEFAULT_DATA_DIR) -> Optional[PatientGraph]:
    """
    Load a patient graph from disk: {patient_id}.json.
    Returns None if the file does not exist.
    """
    file_path = os.path.join(data_dir, f"{patient_id}.json")
    if not os.path.isfile(file_path):
        return None

    with open(file_path, "r", encoding="utf-8") as f:
        payload = json.load(f)

    # Reconstruct Patient
    patient = Patient(**payload["patient"])
    pg = PatientGraph(patient)

    # Reconstruct the NetworkX graph from saved node_link data
    graph_data = payload["graph_nx"]
    pg._graph = node_link_graph(graph_data, directed=True, multigraph=True)

    # Reconstruct Pydantic Node objects on loaded graph nodes
    for node_id in list(pg._graph.nodes):
        node_attrs = pg._graph.nodes[node_id]
        if "data" in node_attrs and isinstance(node_attrs["data"], dict):
            node_attrs["data"] = Node(**node_attrs["data"])

    # Reconstruct Pydantic Edge objects on loaded graph edges
    for u, v, k, edge_attrs in pg._graph.edges(keys=True, data=True):
        if "data" in edge_attrs and isinstance(edge_attrs["data"], dict):
            edge_attrs["data"] = Edge(**edge_attrs["data"])

    # Restore positions
    pg._positions = {
        nid: (pos["x"], pos["y"])
        for nid, pos in payload.get("positions", {}).items()
    }

    # Restore display metadata
    pg._display = payload.get("display", {})

    # Restore divergences
    pg._divergences = {
        div_id: Divergence(**div_data)
        for div_id, div_data in payload.get("divergences", {}).items()
    }

    # Restore conversations
    pg.conversations = [
        Conversation(
            id=c["id"],
            patient_id=c["patient_id"],
            label=c.get("label", ""),
            started_at=c.get("started_at", ""),
            status=c.get("status", "active"),
            messages=[ConversationMessage(**m) for m in c.get("messages", [])],
        )
        for c in payload.get("conversations", [])
    ]

    # Restore snapshots
    pg.snapshots = [
        GraphSnapshot(**s)
        for s in payload.get("snapshots", [])
    ]

    # Restore handoffs
    pg.handoffs = [
        HandoffPackage(**h)
        for h in payload.get("handoffs", [])
    ]

    return pg


# ── Save all patients ───────────────────────────────────────────────

def save_all(firewall: PatientFirewall, data_dir: str = DEFAULT_DATA_DIR) -> int:
    """
    Save all patient graphs in the firewall to disk.
    Returns the number of patients saved.
    """
    count = 0
    for patient_id, patient_graph in firewall.graphs.items():
        save_patient(patient_graph, data_dir)
        count += 1
    return count


# ── Load all patients ───────────────────────────────────────────────

def load_all(data_dir: str = DEFAULT_DATA_DIR) -> Optional[PatientFirewall]:
    """
    Load all patient JSON files from the data directory into a new PatientFirewall.
    Returns None if the data directory doesn't exist or is empty.
    """
    if not os.path.isdir(data_dir):
        return None

    json_files = [f for f in os.listdir(data_dir) if f.endswith(".json")]
    if not json_files:
        return None

    firewall = PatientFirewall()

    for filename in json_files:
        patient_id = filename.rsplit(".json", 1)[0]
        pg = load_patient(patient_id, data_dir)
        if pg is not None:
            firewall.register_patient(pg)

    return firewall
