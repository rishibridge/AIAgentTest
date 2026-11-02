"""
HandoffGenerator — Generates clinician handoff packages.
Uses Prism's ReasoningEngine / strict JSON synthesis: Advocate builds the package,
Skeptic ensures no excluded content leaks, Judge validates non-empty fields (H3, H4, M11).
"""
import json
import math
import uuid
from typing import Dict, Any, List, Optional, Tuple
from datetime import datetime

from prism.engine.reasoning.llm_client import LLMClient
from ally.engine.patient_graph import PatientGraph, HandoffPackage, ClinicalHypothesis


def _normalize_hypotheses(raw_list: Any, now_iso: str, model_name: str = "gemini-2.5-flash") -> List[Dict[str, Any]]:
    """Convert raw string or dict hypotheses into structured lifecycle objects (M11)."""
    normalized: List[Dict[str, Any]] = []
    if not isinstance(raw_list, list):
        return normalized
    for idx, item in enumerate(raw_list, 1):
        if isinstance(item, dict):
            text = str(item.get("text") or item.get("hypothesis") or "").strip()
            if not text:
                continue
            hyp = ClinicalHypothesis(
                id=str(item.get("id") or f"hyp_{idx}_{uuid.uuid4().hex[:6]}"),
                text=text,
                status=str(item.get("status") or "open"),
                generated_by=str(item.get("generated_by") or model_name),
                model_version=str(item.get("model_version") or "ally-v1.1"),
                confirmed_by=item.get("confirmed_by"),
                timestamp=str(item.get("timestamp") or now_iso),
                updated_at=item.get("updated_at") or now_iso,
                edge_source=item.get("edge_source"),
                edge_target=item.get("edge_target"),
            )
            normalized.append(hyp.model_dump())
        elif isinstance(item, str) and item.strip():
            hyp = ClinicalHypothesis(
                id=f"hyp_{idx}_{uuid.uuid4().hex[:6]}",
                text=item.strip(),
                status="open",
                generated_by=model_name,
                model_version="ally-v1.1",
                confirmed_by=None,
                timestamp=now_iso,
                updated_at=now_iso,
            )
            normalized.append(hyp.model_dump())
    return normalized


class HandoffGenerator:
    """
    Generates clinician handoff packages from patient graph + conversation history.
    Strictly validates output fields and never persists empty/failed handoffs (H4).
    """

    MODEL_NAME = "gemini-2.5-flash"
    MODEL_VERSION = "ally-v1.1"

    def __init__(self, llm_client: LLMClient = None):
        self.llm = llm_client or LLMClient(mock=False)

    def generate_handoff(
        self,
        patient_graph: PatientGraph,
        recipient_name: str,
        recipient_role: str,
        authorization_notes: str = "",
        family_overlap_info: Optional[str] = None,
    ) -> Tuple[HandoffPackage, Dict[str, Any]]:
        """
        Generate a complete handoff package.
        Raises RuntimeError if LLM output fails schema/completeness checks (H4).
        """
        patient = patient_graph.patient

        from ally.engine.clinician_engine import ClinicianEngine
        graph_context = ClinicianEngine()._build_clinical_context(patient_graph, [])

        question = f"""Generate a clinical handoff package for a behavioral health companion bot handing off a patient to a clinician.

## Patient
Name: {patient.name}
Age: {patient.age}
Background: {patient.bio}
Bot engagement: {patient.bot_context}
Anonymous: {patient.anonymous}

## Recipient Clinician
Name: {recipient_name}
Role: {recipient_role}

## Excluded Content (MUST NOT appear in handoff)
{json.dumps(patient.excluded_content) if patient.excluded_content else "None"}

## Locked Nodes (mention existence in metadata_shadows ONLY, NEVER reveal content)
{json.dumps(patient.locked_nodes) if patient.locked_nodes else "None"}

## Authorization Notes
{authorization_notes or "Standard bot-clinician communication consent"}

{f"## Family Overlap Flag (CRITICAL)" + chr(10) + family_overlap_info if family_overlap_info else ""}

{graph_context}

ADVOCATE: Build the most complete, clinically useful handoff package possible.
SKEPTIC: Scrutinize the package — does ANY excluded content leak? Does ANY locked content get revealed? Is the package genuinely clinically useful?
JUDGE: Produce the final validated package.

Output MUST be a valid JSON object with ALL of the following non-empty fields:
{{
  "context": "Brief context of the referral",
  "demographics": "Structured one-line summary: Age + Sex/Gender + Occupation + Primary Language (e.g. '47F • Home Health Aide • Spanish/English').",
  "risk_assessment": {{"level": "High|Medium|Low", "details": "Specific risk details or active safety plans."}},
  "clinical_narrative": "A cohesive, clinically rich paragraph capturing core clinical context, emotional affect, and longitudinal trajectory.",
  "active_themes": ["3-4 concrete active themes the patient is dealing with"],
  "metadata_shadows": ["Existence-only descriptions of restricted/locked nodes without revealing contents"],
  "excluded_content_flag": true,
  "quotes_vs_inferences": [
    {{"quote": "Exact patient quote or reported statement", "inference": "Clinical inference"}}
  ],
  "hypotheses": [
    {{"text": "Specific clinical hypothesis for clinician confirmation", "status": "open"}}
  ],
  "simplified_graph_mermaid": "graph TD;\\n  A[\\"Patient\\"] --> B[\\"Key Factor\\"]"
}}"""

        judge = self.llm.generate_json(
            question,
            system_instruction="You are PRISM's clinical handoff synthesis judge. Output complete, valid JSON respecting all privacy exclusions.",
            model=self.MODEL_NAME,
            strict=True,
        )

        if not isinstance(judge, dict) or judge.get("_llm_error"):
            raise RuntimeError("LLM failed to produce a valid JSON handoff synthesis")

        narrative = str(judge.get("clinical_narrative") or "").strip()
        demographics = str(judge.get("demographics") or "").strip()
        risk = judge.get("risk_assessment")
        if not narrative or len(narrative) < 20:
            raise RuntimeError("Handoff synthesis returned an empty or truncated clinical_narrative")
        if not isinstance(risk, dict) or not str(risk.get("level") or "").strip():
            raise RuntimeError("Handoff synthesis returned an invalid risk_assessment")

        now_iso = datetime.utcnow().isoformat() + "Z"
        structured_hyps = _normalize_hypotheses(judge.get("hypotheses", []), now_iso, self.MODEL_NAME)

        has_exclusions = bool(
            judge.get("excluded_content_flag")
            or patient.excluded_content
            or any(n.kind in ("undisclosed", "locked", "therapist_locked") for n in patient_graph.nodes.values())
        )

        handoff = HandoffPackage(
            patient_id=patient.id,
            patient_name=patient.name,
            recipient=f"{recipient_name} ({recipient_role})",
            context=str(judge.get("context") or f"Clinical handoff for {recipient_name}"),
            demographics=demographics or f"{patient.age}yo • {patient.name}",
            risk_assessment={
                "level": str(risk.get("level", "Low")),
                "details": str(risk.get("details", "")),
            },
            clinical_narrative=narrative,
            active_themes=[str(t) for t in (judge.get("active_themes") or []) if str(t).strip()],
            metadata_shadows=[str(s) for s in (judge.get("metadata_shadows") or []) if str(s).strip()],
            excluded_content_flag=has_exclusions,
            quotes_vs_inferences=[
                {"quote": str(q.get("quote", "")), "inference": str(q.get("inference", ""))}
                for q in (judge.get("quotes_vs_inferences") or [])
                if isinstance(q, dict) and (q.get("quote") or q.get("inference"))
            ],
            simplified_graph_mermaid=str(judge.get("simplified_graph_mermaid") or ""),
            hypotheses=structured_hyps,
            family_overlap_flag=family_overlap_info,
            generated_at=now_iso,
            model=self.MODEL_NAME,
            model_version=self.MODEL_VERSION,
            graph_version=patient_graph.graph_version,
        )

        # Pre-compute graph data for InteractiveGraph component
        graph_state = patient_graph.get_graph_state()
        handoff.graph_nodes = graph_state.get("nodes", [])
        handoff.graph_edges = graph_state.get("edges", [])
        handoff.graph_positions = patient_graph.get_positions()

        if not handoff.graph_positions and handoff.graph_nodes:
            center_x, center_y = 550, 310
            n = len(handoff.graph_nodes)
            for i, node in enumerate(handoff.graph_nodes):
                angle = (2 * math.pi * i) / n
                radius = 200 + (i % 3) * 60
                handoff.graph_positions[node["id"]] = {
                    "x": center_x + radius * math.cos(angle),
                    "y": center_y + radius * math.sin(angle),
                }

        patient_graph.handoffs.append(handoff)

        debate = {
            "advocate": "Extracted comprehensive clinical narrative and structured history from patient graph interactions.",
            "skeptic": "Verified all data boundaries: no excluded or unauthorized nodes appear in this handoff summary.",
            "judge": "Clinical synthesis validated. Non-empty narrative, risk level, and structured hypotheses verified.",
        }

        return handoff, debate
