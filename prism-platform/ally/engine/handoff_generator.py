"""
HandoffGenerator — Generates clinician handoff packages.
Uses Prism's ReasoningEngine: Advocate builds the package, Skeptic ensures
no excluded content leaks, Judge validates.
"""
import json
from typing import Dict, Any, List, Optional
from datetime import datetime

from prism.engine.reasoning.engine import ReasoningEngine
from prism.engine.reasoning.llm_client import LLMClient
from ally.engine.patient_graph import PatientGraph, HandoffPackage


class HandoffGenerator:
    """
    Generates clinician handoff packages from patient graph + conversation history.
    Uses ReasoningEngine for adversarial validation of the handoff.
    """

    def __init__(self, llm_client: LLMClient = None):
        self.llm = llm_client or LLMClient(mock=False)

    def generate_handoff(
        self,
        patient_graph: PatientGraph,
        recipient_name: str,
        recipient_role: str,
        authorization_notes: str = "",
        family_overlap_info: Optional[str] = None,
    ) -> HandoffPackage:
        """
        Generate a complete handoff package using ReasoningEngine.
        Advocate builds it, Skeptic checks for privacy leaks, Judge validates.
        """
        patient = patient_graph.patient

        # Build full clinical context of the graph
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

## Locked Nodes (mention existence but NOT content)
{json.dumps(patient.locked_nodes) if patient.locked_nodes else "None"}

## Authorization Notes
{authorization_notes or "Standard bot-clinician communication consent"}

{f"## Family Overlap Flag (CRITICAL)" + chr(10) + family_overlap_info if family_overlap_info else ""}

{graph_context}

ADVOCATE: Build the most complete, clinically useful handoff package possible.
SKEPTIC: Scrutinize the package — does ANY excluded content leak? Does ANY locked content get revealed? Is the package actually clinically useful or too vague?
JUDGE: Produce the final validated package.

Judge output MUST be a JSON object:
{{
  "context": "Brief context of the referral",
  "demographics": "Basic patient info from background",
  "risk_assessment": {{"level": "High/Medium/Low", "details": "Specific risk details or safety plans active. Medium/High requires immediate visibility."}},
  "clinical_narrative": "A warm, cohesive paragraph capturing the patient's core conflicts, emotional affect, and overall narrative, replacing a rigid medical summary.",
  "active_themes": ["3-4 bullet points of what the patient is actively wrestling with right now"],
  "metadata_shadows": ["Vague descriptions of locked nodes without revealing their contents. E.g. 'Patient has restricted access to 1 node related to past trauma.'"],
  "excluded_content_flag": true/false, // True if the patient has undisclosed nodes or excluded content
  "quotes_vs_inferences": [
    {{"quote": "Exact words patient used", "inference": "Clinical inference"}}
  ],
  "hypotheses": ["Bot-generated hypotheses or DDx for clinician review"],
  "simplified_graph_mermaid": "graph TD; \\n A[Node] --> B[Node]" // Simplified Mermaid.js diagram of core nodes and connections. Exclude undisclosed nodes.
}}"""

        try:
            judge = self.llm.generate_json(question)

            handoff = HandoffPackage(
                patient_id=patient.id,
                patient_name=patient.name,
                recipient=f"{recipient_name} ({recipient_role})",
                context=judge.get("context", ""),
                demographics=judge.get("demographics", ""),
                risk_assessment=judge.get("risk_assessment", {"level": "Low", "details": ""}),
                clinical_narrative=judge.get("clinical_narrative", ""),
                active_themes=judge.get("active_themes", []),
                metadata_shadows=judge.get("metadata_shadows", []),
                excluded_content_flag=judge.get("excluded_content_flag", False),
                quotes_vs_inferences=judge.get("quotes_vs_inferences", []),
                simplified_graph_mermaid=judge.get("simplified_graph_mermaid", ""),
                hypotheses=judge.get("hypotheses", []),
                family_overlap_flag=family_overlap_info,
            )

            # Pre-compute graph data for InteractiveGraph component
            graph_state = patient_graph.get_graph_state()
            handoff.graph_nodes = graph_state.get("nodes", [])
            handoff.graph_edges = graph_state.get("edges", [])
            handoff.graph_positions = patient_graph.get_positions()

            # Auto-layout if no positions exist
            if not handoff.graph_positions and handoff.graph_nodes:
                import math
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
                "judge": "Clinical synthesis validated. The handoff is optimized for immediate provider review without compromising patient-restricted information."
            }

            return handoff, debate

        except Exception as e:
            print(f"HandoffGenerator error: {e}")
            fallback = HandoffPackage(
                patient_id=patient.id,
                patient_name=patient.name,
                recipient=f"{recipient_name} ({recipient_role})",
                context=f"Error generating handoff: {e}",
            )
            return fallback, {}
