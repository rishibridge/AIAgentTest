"""
ClinicianEngine — LLM-powered clinical consultation assistant for clinicians.
Unlike ConversationEngine (patient-facing, companion tone), this engine uses
a professional clinical tone and surfaces authorized graph content for
diagnosis, treatment planning, and handoff recommendations.
"""
import json
from typing import Dict, Any, List, Optional

from prism.engine.reasoning.llm_client import LLMClient
from ally.engine.patient_graph import PatientGraph, ConversationMessage


CLINICIAN_SYSTEM_PROMPT = """You are a clinical consultation assistant for clinicians at Castle Family Health Centers.

## Your Identity
- You are an expert, empathetic, trained psychiatrist and psychologist consulting with fellow clinicians.
- You have deep training and expertise in Cognitive Behavioral Therapy (CBT), Dialectical Behavior Therapy (DBT), Acceptance and Commitment Therapy (ACT), Mindfulness-Based Cognitive Therapy (MBCT), Mindfulness-Based Stress Reduction (MBSR), Exposure and Response Prevention (ERP), Behavioral Activation (BA), Eye Movement Desensitization and Reprocessing (EMDR), Prolonged Exposure Therapy (PE), Cognitive Processing Therapy (CPT), Trauma-Focused Cognitive Behavioral Therapy (TF-CBT), Interpersonal Psychotherapy (IPT), Emotionally Focused Couples Therapy (EFT), Family-Based Treatment (FBT), Functional Family Therapy (FFT), Short-Term Psychodynamic Psychotherapy (STPP), Cognitive Behavioral Therapy for Insomnia (CBT-I), Parent-Child Interaction Therapy (PCIT), Contingency Management (CM), and a robust Buddhist psychology, Vipassana, and mindfulness practice.
- You are a CLINICAL TOOL, not a patient companion. You provide professional, evidence-based support for licensed clinicians.
- You have access to a structured graph model of the patient built from prior AI companion conversations.
- You surface relevant clinical data, flag patterns, and support treatment planning.
- You are precise, professional, and direct. You cite specific graph nodes and relationships.

## Your Capabilities
- Summarize patient history from the graph model: people, conditions, medications, beliefs, events, faith, symptoms.
- Identify clinical patterns across nodes and edges (e.g., temporal correlations, avoidance patterns, belief structures affecting treatment adherence).
- Generate handoff recommendations for other clinicians.
- Discuss diagnosis and treatment planning within the context of what the patient has disclosed.
- Flag items for follow-up: unresolved divergences, inferred connections, avoidance patterns.
- Support consolidation of session notes into the graph.

## Content Visibility Rules
- AUTHORIZED content: Show freely. This is content the patient has consented to share with clinicians.
- EXCLUDED content: You MUST NOT reveal details. Mark as "EXCLUDED — patient has not authorized sharing this content."
- LOCKED nodes: Show the node's existence but NOT its details. Mark as "LOCKED — patient opted out of sharing specifics."
- THERAPIST_LOCKED nodes: These are clinician-only notes locked to specific clinicians. Show existence only.
- CLINICIAN/CLINICIAN_SAFETY nodes: Show freely — these are clinician-sourced.

## Your Voice
- Professional clinical language. Concise. Evidence-referenced.
- When citing patient content, reference graph node IDs so the clinician can locate them.
- When making inferences, clearly mark them as "INFERRED" vs "PATIENT-REPORTED" vs "CLINICIAN-DOCUMENTED".
- Never use the patient companion's warm/empathic tone. This is clinician-to-tool communication.

## Response Format
You MUST respond with a JSON object containing:
{
  "text": "Your clinical response to the clinician",
  "flags": [],
  "node_updates": [],
  "edge_updates": [],
  "referenced_nodes": [],
  "recommendations": []
}

Where:
- text: Your professional clinical response
- flags: Array of clinical flags to surface. Each: {"type": "follow_up|safety|pattern|adherence|divergence", "description": "Flag detail", "node_ids": ["related_node_ids"]}
- node_updates: Array of new nodes to add (clinician-sourced). Each: {"id": "snake_case_id", "label": "Human Label", "kind": "clinician|clinician_safety|therapist_locked", "size": 14-18}
- edge_updates: Array of new edges. Each: {"source": "node_id", "target": "node_id", "label": "relationship", "weight": 1-4}
- referenced_nodes: Array of node IDs referenced in this response (for graph highlighting)
- recommendations: Array of actionable recommendations. Each: {"type": "handoff|follow_up|treatment|assessment", "description": "Detail"}

CRITICAL: Output ONLY the JSON object. No markdown, no commentary.
"""


class ClinicianEngine:
    """
    LLM-powered clinical consultation engine for clinician-facing chat.
    Uses Prism's LLMClient. Reads from the patient's TemporalGraph.
    """

    def __init__(self, llm_client: LLMClient = None):
        self.llm = llm_client or LLMClient(mock=False)

    def generate_response(
        self,
        patient_graph: PatientGraph,
        clinician_history: List[ConversationMessage],
        clinician_message: str,
    ) -> Dict[str, Any]:
        """
        Generate a clinical response given the patient's graph and clinician chat history.
        Returns structured response with text, flags, graph updates, and recommendations.
        """
        context = self._build_clinical_context(patient_graph, clinician_history)

        prompt = f"""{context}

---
CLINICIAN'S MESSAGE:
{clinician_message}

Generate your clinical consultation response. Remember to respond in the JSON format specified in your instructions."""

        try:
            from prism.engine.reasoning.engine import ReasoningEngine
            import json
            
            debate_result = None
            if "[DDX ARENA" in clinician_message:
                reasoning = ReasoningEngine(graph=patient_graph, llm_client=self.llm)
                debate_result = reasoning.analyze(clinician_message)
                prompt = f"{context}\n\n---\nCLINICIAN'S MESSAGE:\n{clinician_message}\n\nREASONING ENGINE DEBATE RESULTS:\nAdvocate: {json.dumps(debate_result.get('advocate', ''))}\nSkeptic: {json.dumps(debate_result.get('skeptic', ''))}\nJudge: {json.dumps(debate_result.get('judge', ''))}\n\nSynthesize these results into your final clinical consultation response JSON."

            result = self.llm.generate_json(prompt, system_instruction=CLINICIAN_SYSTEM_PROMPT)
            response = {
                "text": result.get("text", "Please clarify your clinical question."),
                "flags": result.get("flags", []),
                "node_updates": result.get("node_updates", []),
                "edge_updates": result.get("edge_updates", []),
                "referenced_nodes": result.get("referenced_nodes", []),
                "recommendations": result.get("recommendations", []),
            }
            if debate_result:
                response["debate"] = {
                    "advocate": debate_result.get("advocate", {}),
                    "skeptic": debate_result.get("skeptic", {}),
                    "judge": debate_result.get("judge", {}),
                }
            return response
        except Exception as e:
            print(f"ClinicianEngine error: {e}")
            return {
                "text": "An error occurred generating the clinical response. Please try again.",
                "flags": [],
                "node_updates": [],
                "edge_updates": [],
                "referenced_nodes": [],
                "recommendations": [],
            }

    def generate_handoff_summary(
        self,
        patient_graph: PatientGraph,
    ) -> Dict[str, Any]:
        """
        Generate a quick handoff summary from the current graph state.
        Returns a structured summary suitable for clinician review.
        """
        context = self._build_clinical_context(patient_graph, [])

        prompt = f"""{context}

---
Generate a concise clinical handoff summary for this patient. Include:
1. Key presenting issues
2. Active medications and adherence concerns
3. Relevant psychosocial factors
4. Safety considerations
5. Recommended follow-up actions

Respond as JSON:
{{
  "text": "Full handoff narrative",
  "flags": [],
  "node_updates": [],
  "edge_updates": [],
  "referenced_nodes": [],
  "recommendations": []
}}"""

        try:
            result = self.llm.generate_json(prompt, system_instruction=CLINICIAN_SYSTEM_PROMPT)
            return {
                "text": result.get("text", ""),
                "flags": result.get("flags", []),
                "node_updates": [],
                "edge_updates": [],
                "referenced_nodes": result.get("referenced_nodes", []),
                "recommendations": result.get("recommendations", []),
            }
        except Exception as e:
            print(f"ClinicianEngine handoff error: {e}")
            return {
                "text": f"Error generating handoff summary: {e}",
                "flags": [],
                "node_updates": [],
                "edge_updates": [],
                "referenced_nodes": [],
                "recommendations": [],
            }

    def _build_clinical_context(
        self,
        patient_graph: PatientGraph,
        clinician_history: List[ConversationMessage],
    ) -> str:
        """Build rich clinical context from the patient's graph for clinician consumption."""
        patient = patient_graph.patient

        # Read from the inherited TemporalGraph
        all_nodes = patient_graph.get_all_nodes()
        nodes_dict = patient_graph.nodes
        edges_dict = patient_graph.edges

        ctx = "## Patient Record\n"
        ctx += f"Name: {patient.name}\n"
        if patient.age:
            ctx += f"Age: {patient.age}\n"
        if patient.bio:
            ctx += f"Clinical Background: {patient.bio}\n"
        if patient.bot_context:
            ctx += f"Bot Engagement History: {patient.bot_context}\n"
        if patient.anonymous:
            ctx += f"Note: Patient is anonymous-by-default.\n"

        # Excluded content — clinician sees the FLAG but not the content
        if patient.excluded_content:
            ctx += "\n## EXCLUDED CONTENT (patient has NOT authorized sharing)\n"
            for i, exc in enumerate(patient.excluded_content, 1):
                ctx += f"- Item {i}: EXCLUDED — patient has not authorized sharing this content\n"

        # Locked nodes — existence shown, details hidden
        if patient.locked_nodes:
            ctx += "\n## LOCKED NODES (existence visible, details withheld)\n"
            for ln in patient.locked_nodes:
                node = patient_graph.get_node(ln)
                if node:
                    ctx += f"- {ln}: LOCKED — patient opted out of sharing specifics\n"
                else:
                    ctx += f"- {ln}: LOCKED — patient opted out of sharing specifics\n"

        # Full graph state grouped by node kind, with visibility rules applied
        if all_nodes:
            ctx += f"\n## Patient Graph ({len(all_nodes)} nodes, {len(edges_dict)} edges)\n"

            by_kind: Dict[str, list] = {}
            for n in all_nodes:
                by_kind.setdefault(n.node_type, []).append(n)

            for kind, kind_nodes in sorted(by_kind.items()):
                ctx += f"\n### {kind.upper()}\n"
                for n in kind_nodes:
                    label = n.properties.get("label", n.id)
                    node_id = n.id

                    # Apply visibility rules
                    if kind == "locked":
                        ctx += f"- [{node_id}] LOCKED — patient opted out of sharing specifics\n"
                    elif kind == "undisclosed":
                        ctx += f"- [{node_id}] EXCLUDED — patient has not authorized sharing this content\n"
                    elif kind == "therapist_locked":
                        ctx += f"- [{node_id}] {label} (therapist-locked, clinician-only)\n"
                    else:
                        size = n.properties.get("size", 14)
                        ctx += f"- [{node_id}] {label} (size: {size})\n"

            # Key relationships
            ctx += "\n### RELATIONSHIPS\n"
            sorted_edges = sorted(edges_dict.values(), key=lambda x: -x.weight)
            for e in sorted_edges:
                src_node = nodes_dict.get(e.source)
                tgt_node = nodes_dict.get(e.target)
                if src_node and tgt_node:
                    flags = []
                    if e.dashed:
                        flags.append("INFERRED")
                    if e.clinician:
                        flags.append("CLINICIAN-DOCUMENTED")
                    flag_str = f" [{', '.join(flags)}]" if flags else " [PATIENT-REPORTED]"
                    ctx += f"- {src_node.label} -> {tgt_node.label}: \"{e.label}\" (weight {e.weight}){flag_str}\n"

        # Divergences
        divergences = patient_graph.get_all_divergences()
        if divergences:
            ctx += "\n### ACTIVE DIVERGENCES\n"
            for d in divergences:
                ctx += f"- Topic: {d.topic} | Status: {d.status} | Claims: {d.claim_a_id} vs {d.claim_b_id}\n"

        # Existing handoffs
        if patient_graph.handoffs:
            h = patient_graph.handoffs[-1]
            ctx += f"- Last Handoff (to {h.recipient}):\n"
            summary_text = getattr(h, 'clinical_narrative', getattr(h, 'session_summary', 'No narrative available'))
            ctx += f"  Summary: {summary_text[:200]}...\n" if len(summary_text) > 200 else f"  Summary: {summary_text}\n"
            themes = getattr(h, 'active_themes', getattr(h, 'goals_for_care', 'None'))
            ctx += f"  Active Themes/Goals: {themes}\n\n"

        # Recent clinician chat history
        if clinician_history:
            ctx += f"\n## Clinician Chat History ({len(clinician_history)} messages)\n"
            recent = clinician_history[-20:]
            for msg in recent:
                sender = "CLINICIAN" if msg.sender != "bot" else "SYSTEM"
                ctx += f"{sender}: {msg.text}\n"

        return ctx
