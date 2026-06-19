"""Graph API routes — read graph state, snapshots, and graph editing."""
from fastapi import APIRouter, HTTPException, Query
from typing import Dict, Any, Optional

router = APIRouter(prefix="/api/v1/patients/{patient_id}/graph", tags=["graph"])

_store = None

def set_store(store):
    global _store
    _store = store


def _save(patient_id):
    """Save after mutation."""
    hook = _store.get("save_hook")
    pg = _store["firewall"].get_patient_graph(patient_id)
    if hook and pg:
        try:
            hook(pg)
        except Exception as e:
            print(f"[WARN] Save failed: {e}")


@router.get("")
def get_graph(patient_id: str):
    pg = _store["firewall"].get_patient_graph(patient_id)
    if not pg:
        raise HTTPException(404, "Patient not found")
    return pg.get_graph_state()


@router.get("/positions")
def get_positions(patient_id: str):
    pg = _store["firewall"].get_patient_graph(patient_id)
    if not pg:
        raise HTTPException(404, "Patient not found")
    return pg.get_positions()


@router.get("/snapshots")
def get_snapshots(patient_id: str):
    pg = _store["firewall"].get_patient_graph(patient_id)
    if not pg:
        raise HTTPException(404, "Patient not found")
    return [
        {"id": s.id, "label": s.label, "timestamp": s.timestamp,
         "node_count": len(s.nodes), "edge_count": len(s.edges)}
        for s in pg.snapshots
    ]


@router.get("/snapshots/{snapshot_id}")
def get_snapshot(patient_id: str, snapshot_id: str):
    pg = _store["firewall"].get_patient_graph(patient_id)
    if not pg:
        raise HTTPException(404, "Patient not found")
    for s in pg.snapshots:
        if s.id == snapshot_id:
            return s.model_dump()
    raise HTTPException(404, "Snapshot not found")


@router.get("/firewall")
def get_firewall_status():
    """Get the overall firewall status (system-level view)."""
    return _store["firewall"].get_firewall_status()


# ── Graph editing endpoints ─────────────────────────────────────────

@router.delete("/nodes/{node_id}")
def delete_node(patient_id: str, node_id: str):
    """Delete a node and all its connected edges."""
    pg = _store["firewall"].get_patient_graph(patient_id)
    if not pg:
        raise HTTPException(404, "Patient not found")
    node = pg.get_node(node_id)
    if node is None:
        raise HTTPException(404, f"Node '{node_id}' not found")
    ok = pg.remove_node(node_id)
    if not ok:
        raise HTTPException(500, f"Failed to remove node '{node_id}'")
    _save(patient_id)
    return {
        "status": "deleted",
        "node_id": node_id,
        "current_graph": pg.get_graph_state(),
    }


@router.delete("/edges")
def delete_edge(patient_id: str, source: str = Query(...), target: str = Query(...)):
    """Delete an edge between two nodes."""
    pg = _store["firewall"].get_patient_graph(patient_id)
    if not pg:
        raise HTTPException(404, "Patient not found")
    ok = pg.remove_edge(source, target)
    if not ok:
        raise HTTPException(404, f"Edge '{source}' -> '{target}' not found")
    _save(patient_id)
    return {
        "status": "deleted",
        "edge": f"{source} -> {target}",
        "current_graph": pg.get_graph_state(),
    }


@router.post("/reset")
def reset_patient(patient_id: str):
    """Reset patient graph to initial seed data. Clears all conversations, handoffs, and snapshots."""
    pg = _store["firewall"].get_patient_graph(patient_id)
    if not pg:
        raise HTTPException(404, "Patient not found")

    patient_name = pg.patient.name
    # Re-seed just this patient
    from ally.seed import seed_elena_and_daniel
    from ally.engine.firewall import PatientFirewall

    temp_fw = PatientFirewall()
    seed_elena_and_daniel(temp_fw)

    fresh_pg = temp_fw.get_patient_graph(patient_id)
    if not fresh_pg:
        raise HTTPException(500, f"Could not re-seed patient '{patient_id}'")

    # Replace in firewall
    _store["firewall"].graphs[patient_id] = fresh_pg
    _save(patient_id)

    return {
        "status": "reset",
        "patient_id": patient_id,
        "patient_name": patient_name,
        "current_graph": fresh_pg.get_graph_state(),
    }

