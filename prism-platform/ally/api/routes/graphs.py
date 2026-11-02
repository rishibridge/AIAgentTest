"""Graph API routes — read graph state, snapshots, graph editing, document ingestion, and divergence tracking."""
from fastapi import APIRouter, Body, HTTPException, Query
from pydantic import BaseModel
from typing import Dict, Any, Optional

from ally.engine.patient_graph import _coerce_label_str

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


def _hydrate_node_claim(node) -> Dict[str, Any]:
    """Resolve human-readable text, source, and credibility from a Prism/Ally node (M14)."""
    if node is None:
        return {
            "node_id": "",
            "text": "Unknown",
            "source": "Unknown",
            "credibility": 0.5,
        }
    props = node.properties or {}
    raw_text = props.get("text") or props.get("label") or node.id
    clean_text = " ".join(_coerce_label_str(raw_text, fallback=node.id).split())
    source = props.get("source_doc") or props.get("source")
    if not source:
        kind = node.node_type or props.get("kind") or "clinical"
        source = f"Patient Graph ({kind})"
    raw_cred = props.get("credibility")
    if raw_cred is None:
        kind = (node.node_type or props.get("kind") or "").lower()
        raw_cred = 0.9 if kind in ("clinical", "medication", "clinician", "clinician_safety") else 0.75
    try:
        cred = float(raw_cred)
    except (TypeError, ValueError):
        cred = 0.75
    return {
        "node_id": node.id,
        "text": clean_text,
        "source": str(source),
        "credibility": cred,
    }


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
        {
            "id": s.id,
            "label": s.label,
            "timestamp": s.timestamp,
            "node_count": len(s.node_ids),
            "edge_count": len(s.edge_ids),
        }
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
def get_firewall_status(patient_id: str):
    """Get the overall firewall status (authenticated system-level view)."""
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
    """Reset patient graph to initial seed data. Clears all live conversations, handoffs, and snapshots back to seed."""
    pg = _store["firewall"].get_patient_graph(patient_id)
    if not pg:
        raise HTTPException(404, "Patient not found")

    patient_name = pg.patient.name
    from ally.seed import seed_elena_and_daniel
    from ally.engine.firewall import PatientFirewall

    temp_fw = PatientFirewall()
    seed_elena_and_daniel(temp_fw)

    fresh_pg = temp_fw.get_patient_graph(patient_id)
    if not fresh_pg:
        raise HTTPException(500, f"Could not re-seed patient '{patient_id}'")

    _store["firewall"].graphs[patient_id] = fresh_pg
    _save(patient_id)

    return {
        "status": "reset",
        "patient_id": patient_id,
        "patient_name": patient_name,
        "current_graph": fresh_pg.get_graph_state(),
    }


# ═══════════════════════════════════════════════════════════════════
# Quick Win #5: Document Ingestion — showcase Prism's DocumentExtractor
# ═══════════════════════════════════════════════════════════════════

class IngestRequest(BaseModel):
    text: str
    source_name: str = "Clinical Note"


@router.post("/ingest")
def ingest_document(patient_id: str, req: IngestRequest):
    """Ingest raw clinical text → extract discrete claims → auto-populate PatientGraph via DocumentExtractor."""
    pg = _store["firewall"].get_patient_graph(patient_id)
    if not pg:
        raise HTTPException(404, "Patient not found")
    if not req.text or not req.text.strip():
        raise HTTPException(400, "Document text cannot be empty")

    from prism.engine.memory.extractor import DocumentExtractor
    from prism.engine.reasoning.llm_client import LLMClient

    llm = LLMClient(mock=False)
    extractor = DocumentExtractor(graph=pg, llm_client=llm)

    try:
        result = extractor.ingest_text(req.text, source_name=req.source_name)
    except Exception as e:
        raise HTTPException(502, f"Document extraction failed: {e}")

    _save(patient_id)

    return {
        "status": "ingested",
        "source": req.source_name,
        "nodes_added": result.get("nodes_added", 0) if isinstance(result, dict) else 0,
        "edges_added": result.get("edges_added", 0) if isinstance(result, dict) else 0,
        "extraction_stats": result,
        "current_graph": pg.get_graph_state(),
    }


# ═══════════════════════════════════════════════════════════════════
# Quick Win #6: Divergence Tracking — showcase Prism's Divergence system
# ═══════════════════════════════════════════════════════════════════

class AddDivergenceRequest(BaseModel):
    topic: Optional[str] = None
    claim_a_node_id: Optional[str] = None
    claim_b_node_id: Optional[str] = None
    claim_a_id: Optional[str] = None
    claim_b_id: Optional[str] = None


@router.get("/divergences")
def get_divergences(patient_id: str):
    """Return all divergences (contradictions) from Prism's TemporalGraph with hydrated node text."""
    pg = _store["firewall"].get_patient_graph(patient_id)
    if not pg:
        raise HTTPException(404, "Patient not found")

    divergences = pg.get_all_divergences()

    results = []
    for d in divergences:
        claim_a = pg.get_node(d.claim_a_id)
        claim_b = pg.get_node(d.claim_b_id)
        hydrated_a = _hydrate_node_claim(claim_a)
        hydrated_b = _hydrate_node_claim(claim_b)
        hydrated_a["node_id"] = d.claim_a_id
        hydrated_b["node_id"] = d.claim_b_id

        results.append({
            "id": d.id,
            "topic": d.topic,
            "status": d.status,
            "claim_a": hydrated_a,
            "claim_b": hydrated_b,
        })

    return {
        "patient_id": patient_id,
        "divergence_count": len(results),
        "divergences": results,
    }


@router.post("/divergences")
def add_divergence(
    patient_id: str,
    topic: Optional[str] = Query(default=None),
    claim_a_node_id: Optional[str] = Query(default=None),
    claim_b_node_id: Optional[str] = Query(default=None),
    body: Optional[AddDivergenceRequest] = Body(default=None),
):
    """Manually register a divergence between two existing graph nodes (accepts JSON body or query params)."""
    pg = _store["firewall"].get_patient_graph(patient_id)
    if not pg:
        raise HTTPException(404, "Patient not found")

    resolved_topic = (body.topic if body and body.topic else topic) or ""
    resolved_a = (
        (body.claim_a_node_id or body.claim_a_id) if body else None
    ) or claim_a_node_id or ""
    resolved_b = (
        (body.claim_b_node_id or body.claim_b_id) if body else None
    ) or claim_b_node_id or ""

    if not resolved_topic or not resolved_a or not resolved_b:
        raise HTTPException(400, "topic, claim_a_node_id, and claim_b_node_id are required")

    node_a = pg.get_node(resolved_a)
    node_b = pg.get_node(resolved_b)
    if not node_a or not node_b:
        raise HTTPException(404, "One or both node IDs not found on graph")

    div_id = pg.add_divergence(resolved_a, resolved_b, resolved_topic)
    pg.graph_version += 1
    _save(patient_id)

    hydrated_a = _hydrate_node_claim(node_a)
    hydrated_b = _hydrate_node_claim(node_b)
    return {
        "status": "created",
        "divergence_id": div_id,
        "topic": resolved_topic,
        "claim_a": hydrated_a,
        "claim_b": hydrated_b,
        "divergence": {
            "id": div_id,
            "topic": resolved_topic,
            "status": "active",
            "claim_a": hydrated_a,
            "claim_b": hydrated_b,
            "claimA": hydrated_a,
            "claimB": hydrated_b,
        },
    }
