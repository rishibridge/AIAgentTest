"""
Persistence — Save and load patient graphs to/from disk as JSON files + durable SQLite mirror.
One JSON file per patient in the ally/data/ directory (overridable via ALLY_DATA_DIR),
sealed with a per-patient PBKDF2-HMAC-SHA256 derived key so cross-patient file substitution fails closed.
Uses networkx.readwrite.json_graph for graph serialization.
"""
import hashlib
import hmac
import json
import os
import sqlite3
import tempfile
from typing import Dict, Any, Optional, Tuple
from pathlib import Path

import networkx as nx
from networkx.readwrite.json_graph import node_link_data, node_link_graph

from prism.engine.memory.graph import Node, Edge, Divergence
from ally.engine.patient_graph import (
    Patient, PatientGraph, Conversation, ConversationMessage,
    HandoffPackage, GraphSnapshot, DebateVerdictRecord, _coerce_label_str,
)
from ally.engine.firewall import PatientFirewall

# Default data directory: ALLY_DATA_DIR env var or ally/data/ relative to project root
_PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
DEFAULT_DATA_DIR = os.environ.get("ALLY_DATA_DIR", str(_PROJECT_ROOT / "ally" / "data"))


def _ensure_dir(data_dir: str) -> None:
    """Create the data directory if it doesn't exist."""
    os.makedirs(data_dir, exist_ok=True)


def _derive_patient_key(patient_id: str) -> Tuple[str, bytes]:
    """Derive a per-patient cryptographic HMAC key using PBKDF2-HMAC-SHA256 (M8)."""
    master = os.environ.get("ALLY_MASTER_SECRET", "ally-per-patient-isolation-master-key-v1")
    salt = f"ally-patient-isolation-salt:{patient_id}".encode("utf-8")
    derived = hashlib.pbkdf2_hmac("sha256", master.encode("utf-8"), salt, 50_000)
    key_id = hashlib.sha256(derived).hexdigest()[:12]
    return key_id, derived


def _compute_payload_mac(payload: Dict[str, Any], key: bytes) -> str:
    body = {k: v for k, v in payload.items() if k != "_isolation_seal"}
    canonical = json.dumps(body, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    return hmac.new(key, canonical, hashlib.sha256).hexdigest()


def _sqlite_path(data_dir: str) -> str:
    return os.path.join(data_dir, "ally_patients.sqlite3")


def _save_to_sqlite(data_dir: str, patient_id: str, serialized_json: str) -> None:
    """Mirror patient state into transactional SQLite database for durable persistence (H11)."""
    db_file = _sqlite_path(data_dir)
    conn = sqlite3.connect(db_file, timeout=10.0)
    try:
        with conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS patient_records (
                    patient_id TEXT PRIMARY KEY,
                    payload_json TEXT NOT NULL,
                    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
                )
                """
            )
            conn.execute(
                """
                INSERT INTO patient_records (patient_id, payload_json, updated_at)
                VALUES (?, ?, CURRENT_TIMESTAMP)
                ON CONFLICT(patient_id) DO UPDATE SET
                    payload_json = excluded.payload_json,
                    updated_at = CURRENT_TIMESTAMP
                """,
                (patient_id, serialized_json),
            )
    finally:
        conn.close()


def _load_from_sqlite(data_dir: str, patient_id: str) -> Optional[Dict[str, Any]]:
    db_file = _sqlite_path(data_dir)
    if not os.path.isfile(db_file):
        return None
    conn = sqlite3.connect(db_file, timeout=10.0)
    try:
        cur = conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='patient_records'"
        )
        if not cur.fetchone():
            return None
        row = conn.execute(
            "SELECT payload_json FROM patient_records WHERE patient_id = ?",
            (patient_id,),
        ).fetchone()
        if not row:
            return None
        return json.loads(row[0])
    finally:
        conn.close()


def delete_patient_record(patient_id: str, data_dir: str = DEFAULT_DATA_DIR) -> None:
    """Remove persisted JSON and SQLite records when a patient is deleted."""
    file_path = os.path.join(data_dir, f"{patient_id}.json")
    if os.path.isfile(file_path):
        os.remove(file_path)
    db_file = _sqlite_path(data_dir)
    if os.path.isfile(db_file):
        conn = sqlite3.connect(db_file, timeout=10.0)
        try:
            with conn:
                conn.execute("DELETE FROM patient_records WHERE patient_id = ?", (patient_id,))
        except sqlite3.Error:
            pass
        finally:
            conn.close()


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
    Save one patient's full state atomically to {patient_id}.json and mirror to SQLite.
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

    patient_id = patient_graph.patient.id
    payload: Dict[str, Any] = {
        "patient": patient_graph.patient.model_dump(),
        "graph_version": getattr(patient_graph, "graph_version", 1),
        "graph_nx": graph_data,
        "positions": positions,
        "display": dict(patient_graph._display),
        "divergences": divergences,
        "conversations": [c.model_dump() for c in patient_graph.conversations],
        "snapshots": [s.model_dump() for s in patient_graph.snapshots],
        "handoffs": [h.model_dump() for h in patient_graph.handoffs],
        "debates": [d.model_dump() for d in getattr(patient_graph, "debates", [])],
    }

    key_id, patient_key = _derive_patient_key(patient_id)
    payload["_isolation_seal"] = {
        "patient_id": patient_id,
        "key_id": key_id,
        "algorithm": "PBKDF2-HMAC-SHA256",
        "hmac": _compute_payload_mac(payload, patient_key),
    }

    serialized = json.dumps(payload, indent=2, ensure_ascii=False)
    file_path = os.path.join(data_dir, f"{patient_id}.json")

    # Atomic write via temporary file + os.replace
    fd, tmp_path = tempfile.mkstemp(prefix=f".{patient_id}_", suffix=".tmp", dir=data_dir)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            f.write(serialized)
        os.replace(tmp_path, file_path)
    finally:
        if os.path.exists(tmp_path):
            try:
                os.remove(tmp_path)
            except OSError:
                pass

    _save_to_sqlite(data_dir, patient_id, serialized)
    return file_path


# ── Load a single patient ───────────────────────────────────────────

def load_patient(patient_id: str, data_dir: str = DEFAULT_DATA_DIR) -> Optional[PatientGraph]:
    """
    Load a patient graph from disk: {patient_id}.json (with SQLite fallback).
    Verifies per-patient HMAC isolation seal if present.
    Returns None if the patient record does not exist.
    """
    file_path = os.path.join(data_dir, f"{patient_id}.json")
    payload: Optional[Dict[str, Any]] = None
    if os.path.isfile(file_path):
        with open(file_path, "r", encoding="utf-8") as f:
            payload = json.load(f)
    else:
        payload = _load_from_sqlite(data_dir, patient_id)

    if payload is None:
        return None

    seal = payload.get("_isolation_seal")
    if isinstance(seal, dict):
        if seal.get("patient_id") != patient_id:
            raise ValueError(f"Per-patient isolation violation: record sealed for {seal.get('patient_id')}, requested {patient_id}")
        _, patient_key = _derive_patient_key(patient_id)
        expected_mac = _compute_payload_mac(payload, patient_key)
        if not hmac.compare_digest(expected_mac, str(seal.get("hmac", ""))):
            raise ValueError(f"Per-patient HMAC integrity verification failed for {patient_id}")

    # Reconstruct Patient
    patient = Patient(**payload["patient"])
    pg = PatientGraph(patient)

    # Reconstruct the NetworkX graph from saved node_link data
    graph_data = payload["graph_nx"]
    pg._graph = node_link_graph(graph_data, directed=True, multigraph=True)

    # Reconstruct Pydantic Node objects on loaded graph nodes (sanitizing legacy dict labels)
    for node_id in list(pg._graph.nodes):
        node_attrs = pg._graph.nodes[node_id]
        if "data" in node_attrs and isinstance(node_attrs["data"], dict):
            nd = dict(node_attrs["data"])
            props = dict(nd.get("properties") or {})
            if "label" in props:
                props["label"] = _coerce_label_str(props["label"], fallback=node_id)
            nd["properties"] = props
            node_attrs["data"] = Node(**nd)

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
    for nid, dmeta in pg._display.items():
        if isinstance(dmeta, dict) and "label" in dmeta:
            dmeta["label"] = _coerce_label_str(dmeta["label"], fallback=nid)

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

    # Restore debate verdicts (M13)
    pg.debates = [
        DebateVerdictRecord(**d)
        for d in payload.get("debates", [])
    ]

    pg.graph_version = int(payload.get("graph_version", 1))
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
    Load all patient records from the data directory (JSON or SQLite) into a new PatientFirewall.
    Returns None if the data directory doesn't exist or has no patient records.
    """
    if not os.path.isdir(data_dir):
        return None

    patient_ids = [
        f.rsplit(".json", 1)[0]
        for f in os.listdir(data_dir)
        if f.endswith(".json") and not f.startswith(".")
    ]

    if not patient_ids:
        db_file = _sqlite_path(data_dir)
        if os.path.isfile(db_file):
            conn = sqlite3.connect(db_file, timeout=10.0)
            try:
                cur = conn.execute(
                    "SELECT name FROM sqlite_master WHERE type='table' AND name='patient_records'"
                )
                if cur.fetchone():
                    rows = conn.execute("SELECT patient_id FROM patient_records").fetchall()
                    patient_ids = [r[0] for r in rows]
            finally:
                conn.close()

    if not patient_ids:
        return None

    firewall = PatientFirewall()

    for patient_id in sorted(set(patient_ids)):
        pg = load_patient(patient_id, data_dir)
        if pg is not None:
            firewall.register_patient(pg)

    return firewall if firewall.graphs else None
