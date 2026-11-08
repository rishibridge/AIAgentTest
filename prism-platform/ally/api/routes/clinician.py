"""Clinician API routes — clinician consultation chat, real LLM Post-Visit Scribe + graph extraction, and handoff retrieval."""
import re
import time
import uuid
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any

router = APIRouter(prefix="/api/v1/patients/{patient_id}/clinician", tags=["clinician"])

_store = None


def set_store(store):
    global _store
    _store = store


class ClinicianMessageRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=8000)
    sender: str = Field(default="clinician", max_length=80)


@router.post("/messages")
def send_clinician_message(patient_id: str, req: ClinicianMessageRequest):
    """Send a clinician message and receive a clinical consultation response with telemetry."""
    pg = _store["firewall"].get_patient_graph(patient_id)
    if not pg:
        raise HTTPException(404, "Patient not found")

    from ally.engine.patient_graph import ConversationMessage

    clinician_engine = _store["clinician_engine"]

    clinician_conv = None
    for c in pg.conversations:
        if c.label.startswith("clinician-") and c.status == "active":
            clinician_conv = c
            break

    if clinician_conv is None:
        clinician_conv = pg.start_conversation(label="clinician-session")

    clinician_msg = ConversationMessage(sender=req.sender, text=req.text)
    pg.add_message(clinician_conv.id, clinician_msg)

    t0 = time.perf_counter()
    bot_response = clinician_engine.generate_response(
        patient_graph=pg,
        clinician_history=clinician_conv.messages,
        clinician_message=req.text,
    )
    latency_ms = int((time.perf_counter() - t0) * 1000)

    nodes_added = 0
    edges_added = 0

    for node_data in bot_response.get("node_updates", []):
        node_id = node_data.get("id", "")
        if node_id and pg.get_node(node_id) is None:
            pg.add_node(
                node_id=node_id,
                label=node_data.get("label", node_id),
                kind=node_data.get("kind", "clinician"),
                size=node_data.get("size", 14),
                is_new=True,
            )
            nodes_added += 1

    for edge_data in bot_response.get("edge_updates", []):
        source = edge_data.get("source", "")
        target = edge_data.get("target", "")
        if source and target and pg.get_node(source) and pg.get_node(target) and pg.get_edge(source, target) is None:
            pg.add_edge(
                source=source,
                target=target,
                label=edge_data.get("label", ""),
                weight=edge_data.get("weight", 1),
                is_new=True,
                clinician=True,
            )
            edges_added += 1

    approx_tokens = max(64, (len(req.text) + len(bot_response.get("text", ""))) // 4 + pg._graph.number_of_nodes() * 18)

    bot_msg = ConversationMessage(
        sender="bot",
        text=bot_response["text"],
        highlight=bot_response.get("referenced_nodes", []),
        model="gemini-2.5-flash",
        model_version="ally-v1.1",
        context_tokens=approx_tokens,
        latency_ms=latency_ms,
    )
    pg.add_message(clinician_conv.id, bot_msg)

    _save_after_mutation(patient_id)

    return {
        "clinician_message": clinician_msg.model_dump(),
        "response": bot_msg.model_dump(),
        "model": "gemini-2.5-flash",
        "model_version": "ally-v1.1",
        "context_tokens": approx_tokens,
        "latency_ms": latency_ms,
        "flags": bot_response.get("flags", []),
        "recommendations": bot_response.get("recommendations", []),
        "debate": bot_response.get("debate", None),
        "graph_updates": {
            "nodes_added": nodes_added,
            "edges_added": edges_added,
            "node_updates": bot_response.get("node_updates", []),
            "edge_updates": bot_response.get("edge_updates", []),
        },
        "current_graph": pg.get_graph_state(),
    }


class PostVisitRequest(BaseModel):
    transcript: str = Field(..., max_length=50000)


def _slugify(text: str) -> str:
    tokens = re.findall(r"[a-z0-9]+", text.lower())[:4]
    return "_".join(tokens) if tokens else f"visit_{uuid.uuid4().hex[:6]}"


@router.post("/post_visit")
def handle_post_visit(patient_id: str, req: PostVisitRequest):
    """
    Consume a clinician-patient visit transcript, generate transcript-specific SOAP notes +
    evidence-backed CPT/ICD-10 billing codes via Gemini, and update the PatientGraph (H6).
    """
    pg = _store["firewall"].get_patient_graph(patient_id)
    if not pg:
        raise HTTPException(404, "Patient not found")
    if not req.transcript or not req.transcript.strip():
        raise HTTPException(400, "Visit transcript cannot be empty")

    from ally.engine.clinician_engine import ClinicianEngine
    clinical_context = ClinicianEngine()._build_clinical_context(pg, [])
    llm = _store["llm"]

    prompt = f"""You are an expert medical & behavioral health clinical scribe integrated with the PRISM PatientGraph.
Analyze the following VISIT TRANSCRIPT in the context of the patient's existing clinical memory graph, and produce:
1. A detailed, transcript-accurate SOAP note (Subjective, Objective, Assessment, Plan) reflecting the specific symptoms, vitals/labs, medications, safety discussions, and plan elements present in the transcript.
2. Evidence-backed CPT and ICD-10-CM billing codes strictly supported by the visit transcript and documented diagnoses.
3. Structured graph updates (`new_nodes`, `new_edges`, `confirmed_edges`) capturing new clinical findings, regimen changes, orders, or agreed plans from this visit so the patient's longitudinal graph stays current.

EXISTING PATIENT CONTEXT:
{clinical_context}

VISIT TRANSCRIPT:
{req.transcript}

Return a valid JSON object matching this exact schema:
{{
  "soap": {{
    "subjective": "Specific patient-reported complaints, adherence, stressors, and history from the transcript",
    "objective": "Specific observations, labs, vitals, mental status, or exam findings mentioned in the transcript",
    "assessment": "Clinical synthesis and differential assessment grounded in the transcript + longitudinal context",
    "plan": "Concrete orders, medication adjustments, counseling, referrals, and follow-up interval"
  }},
  "cpt_codes": [
    {{"code": "99214", "description": "Office/outpatient E&M, moderate complexity", "rationale": "Specific justification from transcript"}}
  ],
  "icd10_codes": [
    {{"code": "E11.65", "description": "Type 2 diabetes mellitus with hyperglycemia", "rationale": "Specific justification from transcript"}}
  ],
  "new_nodes": [
    {{"id": "snake_case_node_id", "label": "Concise node label (<=48 chars)", "kind": "clinical|medication|symptom|agreed|clinician|referral", "text": "Complete clinical finding from visit"}}
  ],
  "new_edges": [
    {{"source": "existing_or_new_node_id", "target": "existing_or_new_node_id", "label": "concise relationship"}}
  ],
  "confirmed_edges": [
    {{"source": "existing_node_id", "target": "existing_node_id"}}
  ]
}}"""

    t0 = time.perf_counter()
    try:
        parsed = llm.generate_json(
            prompt,
            system_instruction="You are a meticulous clinical scribe and medical coder. Never output generic boilerplate; ground every sentence and code in the transcript.",
            strict=True,
        )
    except Exception as e:
        raise HTTPException(502, f"Post-visit clinical scribe synthesis failed: {e}")
    latency_ms = int((time.perf_counter() - t0) * 1000)

    soap = parsed.get("soap") if isinstance(parsed.get("soap"), dict) else {}
    subj = str(soap.get("subjective") or "").strip()
    obj = str(soap.get("objective") or "").strip()
    assess = str(soap.get("assessment") or "").strip()
    plan = str(soap.get("plan") or "").strip()

    if not subj or not assess or not plan:
        raise HTTPException(502, "Post-visit synthesis returned incomplete SOAP sections")

    soap_note = f"S: {subj}\n\nO: {obj or 'Alert, oriented, engaged during clinical encounter.'}\n\nA: {assess}\n\nP: {plan}"

    cpt_list = parsed.get("cpt_codes") if isinstance(parsed.get("cpt_codes"), list) else []
    icd_list = parsed.get("icd10_codes") if isinstance(parsed.get("icd10_codes"), list) else []

    billing_lines: List[str] = []
    if cpt_list:
        billing_lines.append("CPT Codes:")
        for c in cpt_list:
            if isinstance(c, dict) and c.get("code"):
                rat = f" — {c.get('rationale')}" if c.get("rationale") else ""
                billing_lines.append(f"• {c.get('code')}: {c.get('description', '')}{rat}")
    if icd_list:
        if billing_lines:
            billing_lines.append("")
        billing_lines.append("ICD-10-CM Codes:")
        for ic in icd_list:
            if isinstance(ic, dict) and ic.get("code"):
                rat = f" — {ic.get('rationale')}" if ic.get("rationale") else ""
                billing_lines.append(f"• {ic.get('code')}: {ic.get('description', '')}{rat}")

    billing_context = "\n".join(billing_lines) if billing_lines else "No billable codes extracted."

    # Apply extracted clinical updates to PatientGraph (H6)
    valid_kinds = {
        "clinical", "medication", "symptom", "agreed", "clinician",
        "referral", "event", "clinician_safety", "belief",
    }
    self_node_id = next((nid for nid, nv in pg.nodes.items() if nv.kind == "self"), None)
    added_nodes: List[Dict[str, Any]] = []
    added_edges: List[Dict[str, Any]] = []

    for nd in (parsed.get("new_nodes") or []):
        if not isinstance(nd, dict):
            continue
        label = str(nd.get("label") or "").strip()
        full_text = str(nd.get("text") or label).strip()
        if not label:
            continue
        raw_id = str(nd.get("id") or "").strip()
        node_id = re.sub(r"[^a-z0-9_]", "_", raw_id.lower()).strip("_") or f"visit_{_slugify(label)}"
        if pg.get_node(node_id) is not None:
            node_id = f"{node_id}_{uuid.uuid4().hex[:4]}"
        kind = str(nd.get("kind") or "clinician").lower()
        if kind not in valid_kinds:
            kind = "clinician"

        pg.add_node(
            node_id=node_id,
            label=label,
            kind=kind,
            size=15,
            is_new=True,
            properties={
                "text": full_text,
                "source_doc": "Post-Visit Clinician Scribe",
                "credibility": 0.95,
            },
        )
        added_nodes.append({"id": node_id, "label": label, "kind": kind})

        if self_node_id and self_node_id != node_id:
            pg.add_edge(
                source=self_node_id,
                target=node_id,
                label="visit finding",
                weight=2,
                is_new=True,
                clinician=True,
            )
            added_edges.append({"source": self_node_id, "target": node_id, "label": "visit finding"})

    for ed in (parsed.get("new_edges") or []):
        if not isinstance(ed, dict):
            continue
        src = str(ed.get("source") or "").strip()
        tgt = str(ed.get("target") or "").strip()
        elabel = str(ed.get("label") or "clinical link").strip()
        if src and tgt and src != tgt and pg.get_node(src) and pg.get_node(tgt) and pg.get_edge(src, tgt) is None:
            pg.add_edge(
                source=src,
                target=tgt,
                label=elabel,
                weight=2,
                is_new=True,
                clinician=True,
            )
            added_edges.append({"source": src, "target": tgt, "label": elabel})

    for ce in (parsed.get("confirmed_edges") or []):
        if isinstance(ce, dict):
            src = str(ce.get("source") or "")
            tgt = str(ce.get("target") or "")
            if src and tgt:
                pg.confirm_inferred_edge(src, tgt)

    _save_after_mutation(patient_id)

    return {
        "status": "success",
        "session_notes": soap_note,
        "soap": {"subjective": subj, "objective": obj, "assessment": assess, "plan": plan},
        "billing_context": billing_context,
        "cpt_codes": cpt_list,
        "icd10_codes": icd_list,
        "model": "gemini-2.5-flash",
        "model_version": "ally-v1.1",
        "latency_ms": latency_ms,
        "graph_updates": {
            "nodes_added": len(added_nodes),
            "edges_added": len(added_edges),
            "added_nodes": added_nodes,
            "added_edges": added_edges,
        },
        "current_graph": pg.get_graph_state(),
    }


@router.get("/handoff")
def get_latest_handoff(patient_id: str):
    """Get the latest handoff package for this patient."""
    pg = _store["firewall"].get_patient_graph(patient_id)
    if not pg:
        raise HTTPException(404, "Patient not found")

    if not pg.handoffs:
        raise HTTPException(404, "No handoff packages found for this patient")

    latest = pg.handoffs[-1]
    return latest.model_dump()


def _save_after_mutation(patient_id: str):
    """Save the patient graph to disk after a mutation, if persistence is configured."""
    save_hook = _store.get("save_hook")
    if save_hook:
        try:
            pg = _store["firewall"].get_patient_graph(patient_id)
            if pg:
                save_hook(pg)
        except Exception as e:
            print(f"[WARN] Save hook failed for {patient_id}: {e}")
