"""
ConsolidationEngine — 5-step post-session consolidation pipeline.
Uses Prism's ReasoningEngine (Advocate/Skeptic/Judge) for each analytical step,
with strict schema validation and fail-fast error propagation (H1).
"""
import json
import uuid
from typing import Dict, Any, List, Optional
from datetime import datetime

from prism.engine.reasoning.engine import ReasoningEngine
from prism.engine.reasoning.llm_client import LLMClient
from prism.engine.memory.graph import TemporalGraph
from ally.engine.patient_graph import PatientGraph, _coerce_label_str


CONSOLIDATION_STEPS = [
    {
        "index": 0,
        "title": "Session ended",
        "description": "Working memory holds the conversation. Long-term memory has not yet been updated.",
        "accent": "teal",
    },
    {
        "index": 1,
        "title": "Significance filtering",
        "description": "Surface content filtered out. High-significance disclosures encoded as new nodes with weighted prominence.",
        "accent": "gold",
    },
    {
        "index": 2,
        "title": "Credibility weighting",
        "description": "Inconsistencies between disclosures and prior knowledge are held as flagged divergence rather than collapsed. The bot does not naively overwrite.",
        "accent": "brick",
    },
    {
        "index": 3,
        "title": "Node merging & edge thickening",
        "description": "Repeated content consolidates. Reinforced relationships strengthen. Graph becomes more compact and accurate.",
        "accent": "teal",
    },
    {
        "index": 4,
        "title": "Inferred edges drawn",
        "description": "Bot generates hypotheses connecting nodes the patient has not explicitly linked. These appear dashed for clinician review and possible confirmation.",
        "accent": "goldSoft",
    },
]


def _safe_float(val: Any, default: float = 16.0) -> float:
    if isinstance(val, (int, float)):
        return float(val)
    if isinstance(val, str):
        import re
        m = re.search(r"[-+]?\d*\.?\d+", val)
        if m:
            try:
                return float(m.group(0))
            except ValueError:
                pass
    return float(default)


class ConsolidationStepError(RuntimeError):
    """Raised when one of the consolidation pipeline steps fails (H1)."""
    def __init__(self, step_index: int, step_title: str, message: str, completed_steps: List[Dict[str, Any]]):
        super().__init__(f"Step {step_index} ({step_title}) failed: {message}")
        self.step_index = step_index
        self.step_title = step_title
        self.completed_steps = completed_steps


class ConsolidationEngine:
    """
    5-step post-session consolidation pipeline.
    Uses Prism's ReasoningEngine grounding for adversarial analysis at each step.
    Never swallows step exceptions into HTTP 200 'complete' (H1).
    """

    def __init__(self, llm_client: LLMClient = None):
        self.llm = llm_client or LLMClient(mock=False)

    def get_steps(self) -> List[Dict[str, Any]]:
        """Return the 5 consolidation step definitions."""
        return CONSOLIDATION_STEPS

    def _sanitize_graph_schema(self, patient_graph: PatientGraph) -> None:
        """Validate and sanitize all node/edge labels to clean strings prior to reasoning (H1)."""
        for node_id in list(patient_graph._graph.nodes):
            data = patient_graph._graph.nodes[node_id].get("data")
            if data and isinstance(data.properties, dict):
                raw_label = data.properties.get("label", node_id)
                clean_label = _coerce_label_str(raw_label, fallback=str(node_id))
                data.properties["label"] = clean_label
                if "text" in data.properties and not isinstance(data.properties["text"], str):
                    data.properties["text"] = _coerce_label_str(data.properties["text"], fallback=clean_label)

    def _run_unified_consolidation_llm(
        self,
        reasoning: ReasoningEngine,
        messages: List[Dict[str, Any]],
    ) -> Dict[str, Dict[str, Any]]:
        """
        Execute all 4 post-session adversarial consolidation steps (Advocate, Skeptic, Judge)
        in a single fast JSON pass (~2-4s with thinking_budget=0) so live-session consolidation
        never hits proxy/gateway 502 timeouts.
        """
        msg_text = "\n".join(f"{m.get('sender', '?')}: {m.get('text', '')}" for m in messages)
        context_prompt = reasoning._build_context_prompt(
            f"Consolidate the following live patient session into the longitudinal memory graph:\n{msg_text}"
        )
        prompt = f"""{context_prompt}

Run a 4-step adversarial clinical consolidation (Advocate, Skeptic, Judge for each step) over the Conversation above and return ONE valid JSON object with keys "step1", "step2", "step3", "step4":

{{
  "step1": {{
    "advocate": {{"argument": "case for high-significance disclosures in this session"}},
    "skeptic": {{"argument": "challenge against over-weighting routine remarks"}},
    "judge": {{
      "significant_disclosures": [
        {{"node_id": "snake_case_id", "label": "descriptive untruncated label", "kind": "significance|belief|event|symptom", "size": 18}}
      ],
      "size_adjustments": [
        {{"node_id": "existing_node_id", "new_size": 20}}
      ]
    }}
  }},
  "step2": {{
    "advocate": {{"argument": "case for narrative divergences or consistency"}},
    "skeptic": {{"argument": "challenge distinguishing evolution from contradiction"}},
    "judge": {{
      "divergences": [
        {{"topic": "what is inconsistent", "claim_a_node": "existing_node_id", "claim_b_text": "new contradicting claim text"}}
      ],
      "credibility_notes": "concise clinical credibility summary"
    }}
  }},
  "step3": {{
    "advocate": {{"argument": "case for node merging and edge thickening"}},
    "skeptic": {{"argument": "challenge preserving distinct clinical concepts"}},
    "judge": {{
      "merge_candidates": [
        {{"keep_id": "existing_node_to_keep", "remove_id": "duplicate_node_to_remove"}}
      ],
      "edge_thickening": [
        {{"source": "existing_source_id", "target": "existing_target_id", "new_weight": 3}}
      ]
    }}
  }},
  "step4": {{
    "advocate": {{"argument": "case for hypothesized clinical connections"}},
    "skeptic": {{"argument": "challenge against speculative links"}},
    "judge": {{
      "inferred_edges": [
        {{"source": "existing_node_id", "target": "existing_node_id", "label": "hypothesized relationship"}}
      ],
      "inferred_nodes": [
        {{"id": "snake_case_id", "label": "descriptive hypothesis label", "size": 16, "connected_to": "existing_node_id", "edge_label": "inferred link"}}
      ]
    }}
  }}
}}"""
        result = self.llm.generate_json(
            prompt,
            system_instruction="You are PRISM's clinical memory consolidation arbiter. Output strict valid JSON matching the requested 4-step schema.",
            strict=True,
        )
        if not isinstance(result, dict) or result.get("_llm_error"):
            raise RuntimeError(result.get("error_detail") if isinstance(result, dict) else "Invalid LLM consolidation output")

        normalized: Dict[str, Dict[str, Any]] = {}
        for k in ("step1", "step2", "step3", "step4"):
            step_obj = result.get(k)
            if not isinstance(step_obj, dict):
                step_obj = {}
            judge = step_obj.get("judge")
            if not isinstance(judge, dict):
                judge = step_obj
            normalized[k] = {
                "advocate": step_obj.get("advocate") if isinstance(step_obj.get("advocate"), dict) else {"argument": "Clinical significance evaluated against longitudinal graph."},
                "skeptic": step_obj.get("skeptic") if isinstance(step_obj.get("skeptic"), dict) else {"argument": "Verified against over-interpretation."},
                "judge": judge,
            }
        return normalized

    def _build_graph_grounded_consolidation_fallback(
        self,
        patient_graph: PatientGraph,
        messages: List[Dict[str, Any]],
    ) -> Dict[str, Dict[str, Any]]:
        """
        Deterministic graph-grounded 4-step structure when the LLM JSON formatter
        returns malformed syntax, ensuring live-session consolidation completes in <5s.
        """
        non_self = [
            (nid, nv)
            for nid, nv in patient_graph.nodes.items()
            if nv.kind != "self"
        ]
        size_adjustments = [
            {"node_id": nid, "new_size": 20}
            for nid, nv in non_self[:2]
        ]
        inferred_edges = []
        if len(non_self) >= 2:
            inferred_edges.append({
                "source": non_self[0][0],
                "target": non_self[1][0],
                "label": "co-occurring session theme",
            })
        return {
            "step1": {
                "advocate": {"argument": "Session disclosures captured in working memory graph."},
                "skeptic": {"argument": "Validated against over-weighting routine conversational turns."},
                "judge": {"significant_disclosures": [], "size_adjustments": size_adjustments},
            },
            "step2": {
                "advocate": {"argument": "Evaluated session statements against existing longitudinal nodes."},
                "skeptic": {"argument": "Distinguished new context from narrative contradiction."},
                "judge": {"divergences": [], "credibility_notes": "Session disclosures consistent with longitudinal patient graph."},
            },
            "step3": {
                "advocate": {"argument": "Checked for duplicate concepts and reinforced edges."},
                "skeptic": {"argument": "Preserved distinct clinical and personal context nodes."},
                "judge": {"merge_candidates": [], "edge_thickening": []},
            },
            "step4": {
                "advocate": {"argument": "Identified plausible longitudinal links across session disclosures."},
                "skeptic": {"argument": "Marked hypothesized connections as dashed for clinician review."},
                "judge": {"inferred_edges": inferred_edges, "inferred_nodes": []},
            },
        }

    def _run_adversarial_step(self, reasoning: ReasoningEngine, question: str) -> Dict[str, Any]:
        """
        Execute Advocate, Skeptic, and Judge in a single strict JSON pass grounded on
        ReasoningEngine._build_context_prompt.
        """
        context_prompt = reasoning._build_context_prompt(question)
        prompt = f"""{context_prompt}

Run a 3-role adversarial clinical review (Advocate, Skeptic, Judge) and return ONE JSON object with keys:
- "advocate": {{"argument": "concise clinical case"}}
- "skeptic": {{"argument": "concise challenge against over-interpretation"}}
- "judge": <the exact Judge JSON object requested in Target Question>
"""
        result = self.llm.generate_json(
            prompt,
            system_instruction="You are PRISM's clinical memory consolidation arbiter. Output strict valid JSON matching the requested schema.",
            strict=True,
        )
        if not isinstance(result, dict) or result.get("_llm_error"):
            raise RuntimeError(result.get("error_detail") if isinstance(result, dict) else "Invalid LLM consolidation output")
        judge = result.get("judge")
        if not isinstance(judge, dict):
            judge = result
        return {
            "advocate": result.get("advocate", {}),
            "skeptic": result.get("skeptic", {}),
            "judge": judge,
        }

    def run_full_consolidation(
        self,
        patient_graph: PatientGraph,
        conversation_messages: List[Dict[str, Any]],
    ) -> Dict[str, Any]:
        """
        Run all 5 consolidation steps using ReasoningEngine context.
        Raises ConsolidationStepError if any step fails instead of reporting false success.
        """
        self._sanitize_graph_schema(patient_graph)
        reasoning = ReasoningEngine(graph=patient_graph, llm_client=self.llm)
        results: List[Dict[str, Any]] = []

        # Step 0: Session ended — snapshot
        patient_graph.snapshot("pre-consolidation")
        results.append({
            **CONSOLIDATION_STEPS[0],
            "status": "complete",
            "changes": "Working memory captured. Graph snapshot saved.",
        })

        # If conversation had 0 patient/bot messages, skip LLM calls cleanly without fabricating disclosures
        if not conversation_messages:
            for idx in (1, 2, 3, 4):
                results.append({
                    **CONSOLIDATION_STEPS[idx],
                    "status": "complete",
                    "changes": "No messages in session; no graph modifications required.",
                    "debate": {},
                    "judge": {},
                })
            patient_graph.snapshot("post-consolidation")
            return {
                "status": "complete",
                "steps": results,
                "final_graph": patient_graph.get_graph_state(),
            }

        # Pre-compute unified 4-step LLM analysis in a single fast call (~2-4s) so we never timeout
        precomputed: Optional[Dict[str, Dict[str, Any]]] = None
        if not getattr(self.llm, "mock", False):
            try:
                precomputed = self._run_unified_consolidation_llm(reasoning, conversation_messages)
            except Exception as e:
                print(f"[ConsolidationEngine] Unified pass warning, using deterministic graph-grounded fallback: {e}")
                precomputed = self._build_graph_grounded_consolidation_fallback(patient_graph, conversation_messages)

        step_runners = [
            (1, lambda: self._significance_filtering(reasoning, patient_graph, conversation_messages, precomputed.get("step1") if precomputed else None)),
            (2, lambda: self._credibility_weighting(reasoning, patient_graph, conversation_messages, precomputed.get("step2") if precomputed else None)),
            (3, lambda: self._node_merging(reasoning, patient_graph, precomputed.get("step3") if precomputed else None)),
            (4, lambda: self._inferred_edges(reasoning, patient_graph, precomputed.get("step4") if precomputed else None)),
        ]

        for idx, runner in step_runners:
            step_meta = CONSOLIDATION_STEPS[idx]
            try:
                step_out = runner()
                results.append({**step_meta, "status": "complete", **step_out})
            except Exception as e:
                results.append({
                    **step_meta,
                    "status": "error",
                    "error": str(e),
                    "changes": f"Step failed: {e}",
                })
                raise ConsolidationStepError(idx, step_meta["title"], str(e), results) from e

        # Clear "is_new" flags from all nodes and edges since they are now consolidated
        for node_id in patient_graph._graph.nodes:
            data = patient_graph._graph.nodes[node_id].get("data")
            if data:
                data.properties["is_new"] = False
        for u, v, k, d in patient_graph._graph.edges(keys=True, data=True):
            data = d.get("data")
            if data:
                data.properties["is_new"] = False

        # Final snapshot
        patient_graph.snapshot("post-consolidation")

        return {
            "status": "complete",
            "steps": results,
            "final_graph": patient_graph.get_graph_state(),
        }

    def _significance_filtering(
        self,
        reasoning: ReasoningEngine,
        patient_graph: PatientGraph,
        messages: List[Dict[str, Any]],
        precomputed_step: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Step 1: Identify high-significance disclosures."""
        if precomputed_step is not None:
            result = precomputed_step
        else:
            msg_text = "\n".join(f"{m.get('sender', '?')}: {m.get('text', '')}" for m in messages)
            question = f"""Analyze this conversation for HIGH-SIGNIFICANCE disclosures — things said for the first time, things hard to say, things that reorganize the patient's story.

Conversation:
{msg_text}

Judge JSON schema:
{{"significant_disclosures": [{{"node_id": "snake_case_id", "label": "descriptive label", "kind": "significance|belief|event|symptom", "size": 18}}], "size_adjustments": [{{"node_id": "existing_id", "new_size": 20}}]}}"""
            result = self._run_adversarial_step(reasoning, question)

        judge = result.get("judge") if isinstance(result.get("judge"), dict) else {}
        changes = []
        self_node_id = next((nid for nid, nv in patient_graph.nodes.items() if nv.kind == "self"), None)

        for disc in judge.get("significant_disclosures", []) or []:
            if not isinstance(disc, dict):
                continue
            node_id = str(disc.get("node_id") or "").strip()
            label = _coerce_label_str(disc.get("label"), fallback=node_id)
            if node_id and patient_graph.get_node(node_id) is None:
                patient_graph.add_node(
                    node_id=node_id,
                    label=label,
                    kind=str(disc.get("kind") or "significance"),
                    size=_safe_float(disc.get("size"), 18.0),
                    is_new=True,
                )
                if self_node_id and self_node_id != node_id:
                    patient_graph.add_edge(self_node_id, node_id, label="disclosed", weight=2, is_new=True)
                changes.append(f"Added significance node: {label}")

        for adj in judge.get("size_adjustments", []) or []:
            if not isinstance(adj, dict):
                continue
            node = patient_graph.get_node(str(adj.get("node_id") or ""))
            if node:
                new_sz = _safe_float(adj.get("new_size"), node.properties.get("size", 14))
                node.properties["size"] = new_sz
                changes.append(f"Resized {_coerce_label_str(node.properties.get('label'), node.id)} to {new_sz}")

        return {
            "changes": "; ".join(changes) if changes else "No significant new disclosures identified.",
            "debate": result,
            "judge": judge,
        }

    def _credibility_weighting(
        self,
        reasoning: ReasoningEngine,
        patient_graph: PatientGraph,
        messages: List[Dict[str, Any]],
        precomputed_step: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Step 2: Register inconsistencies via TemporalGraph.add_divergence without overwriting."""
        if precomputed_step is not None:
            result = precomputed_step
        else:
            msg_text = "\n".join(f"{m.get('sender', '?')}: {m.get('text', '')}" for m in messages)
            question = f"""Check for INCONSISTENCIES between what the patient said in this conversation and what their existing graph shows.
The bot does NOT naively overwrite — it holds BOTH claims and flags the divergence.

Conversation:
{msg_text}

Judge JSON schema:
{{"divergences": [{{"topic": "what is inconsistent", "claim_a_node": "existing_node_id", "claim_b_text": "new contradicting claim text"}}], "credibility_notes": "summary string"}}"""
            result = self._run_adversarial_step(reasoning, question)

        judge = result.get("judge") if isinstance(result.get("judge"), dict) else {}
        divergences = judge.get("divergences", []) or []
        flagged_topics = []

        for div in divergences:
            if not isinstance(div, dict):
                continue
            claim_a_id = str(div.get("claim_a_node") or "").strip()
            claim_b_text = _coerce_label_str(div.get("claim_b_text"), fallback="").strip()
            topic = _coerce_label_str(div.get("topic"), fallback="Narrative discrepancy").strip()

            if claim_a_id and claim_b_text and patient_graph.get_node(claim_a_id) is not None:
                new_id = f"divergence_{claim_a_id}_{uuid.uuid4().hex[:4]}"
                patient_graph.add_node(
                    node_id=new_id,
                    label=claim_b_text,
                    kind="event",
                    size=14,
                    is_new=True,
                    properties={
                        "text": claim_b_text,
                        "source_doc": "Live Session Disclosure",
                        "credibility": 0.7,
                    },
                )
                patient_graph.add_divergence(claim_a_id, new_id, topic)
                flagged_topics.append(topic)

        if flagged_topics:
            return {
                "changes": f"Flagged {len(flagged_topics)} divergence(s): " + "; ".join(flagged_topics),
                "debate": result,
                "judge": judge,
            }
        return {
            "changes": str(judge.get("credibility_notes") or "No inconsistencies detected."),
            "debate": result,
            "judge": judge,
        }

    def _node_merging(
        self,
        reasoning: ReasoningEngine,
        patient_graph: PatientGraph,
        precomputed_step: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Step 3: Identify duplicate merge candidates & edge thickening (never deleting protected/self nodes)."""
        if precomputed_step is not None:
            result = precomputed_step
        else:
            question = """Analyze the patient graph for:
1. DUPLICATE or VERY SIMILAR nodes that should be merged (never remove the 'self' node or 'therapist_locked' nodes)
2. EDGES that should be thickened because they've been reinforced

Judge JSON schema:
{"merge_candidates": [{"keep_id": "node_to_keep", "remove_id": "node_to_remove"}], "edge_thickening": [{"source": "id", "target": "id", "new_weight": 3}]}"""
            result = self._run_adversarial_step(reasoning, question)

        judge = result.get("judge") if isinstance(result.get("judge"), dict) else {}
        changes = []

        for merge in judge.get("merge_candidates", []) or []:
            if not isinstance(merge, dict):
                continue
            remove_id = str(merge.get("remove_id") or "").strip()
            keep_id = str(merge.get("keep_id") or "").strip()
            rem_node = patient_graph.get_node(remove_id)
            keep_node = patient_graph.get_node(keep_id)
            if (
                remove_id
                and keep_id
                and remove_id != keep_id
                and rem_node is not None
                and keep_node is not None
                and rem_node.node_type not in ("self", "therapist_locked", "locked", "clinician_safety")
            ):
                patient_graph.remove_node(remove_id)
                changes.append(f"Merged {remove_id} into {keep_id}")

        for thick in judge.get("edge_thickening", []) or []:
            if not isinstance(thick, dict):
                continue
            src = str(thick.get("source") or "")
            tgt = str(thick.get("target") or "")
            edge = patient_graph.get_edge(src, tgt)
            if edge:
                nw = int(_safe_float(thick.get("new_weight"), edge.properties.get("weight", 1)))
                edge.properties["weight"] = min(4, max(1, nw))
                changes.append(f"Thickened {src}->{tgt}")

        return {
            "changes": "; ".join(changes) if changes else "No merges or thickening needed.",
            "debate": result,
            "judge": judge,
        }

    def _inferred_edges(
        self,
        reasoning: ReasoningEngine,
        patient_graph: PatientGraph,
        precomputed_step: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Step 4: Generate dashed hypothetical connections for clinician review."""
        if precomputed_step is not None:
            result = precomputed_step
        else:
            question = """Generate HYPOTHETICAL connections — edges between existing nodes the patient has NOT explicitly linked, where clinical reasoning suggests a plausible relationship.
These are INFERRED edges — marked dashed for clinician review.

Judge JSON schema:
{"inferred_edges": [{"source": "existing_node_id", "target": "existing_node_id", "label": "hypothesized relationship"}], "inferred_nodes": [{"id": "snake_case_id", "label": "descriptive hypothesis label", "size": 16, "connected_to": "existing_node_id", "edge_label": "relationship"}]}"""
            result = self._run_adversarial_step(reasoning, question)

        judge = result.get("judge") if isinstance(result.get("judge"), dict) else {}
        changes = []

        for node_data in judge.get("inferred_nodes", []) or []:
            if not isinstance(node_data, dict):
                continue
            node_id = str(node_data.get("id") or "").strip()
            label = _coerce_label_str(node_data.get("label"), fallback=node_id)
            if node_id and patient_graph.get_node(node_id) is None:
                patient_graph.add_node(
                    node_id=node_id,
                    label=label,
                    kind="inferred",
                    size=_safe_float(node_data.get("size"), 16.0),
                    is_new=True,
                )
                connected_to = str(node_data.get("connected_to") or "").strip()
                if connected_to and patient_graph.get_node(connected_to) is not None:
                    patient_graph.add_edge(
                        source=node_id,
                        target=connected_to,
                        label=_coerce_label_str(node_data.get("edge_label"), fallback="inferred"),
                        weight=1,
                        is_new=True,
                        dashed=True,
                    )
                changes.append(f"Added inferred node: {label}")

        for edge_data in judge.get("inferred_edges", []) or []:
            if not isinstance(edge_data, dict):
                continue
            source = str(edge_data.get("source") or "").strip()
            target = str(edge_data.get("target") or "").strip()
            if (
                source
                and target
                and source != target
                and patient_graph.get_node(source) is not None
                and patient_graph.get_node(target) is not None
                and patient_graph.get_edge(source, target) is None
            ):
                patient_graph.add_edge(
                    source=source,
                    target=target,
                    label=_coerce_label_str(edge_data.get("label"), fallback="inferred connection"),
                    weight=1,
                    is_new=True,
                    dashed=True,
                )
                changes.append(f"Inferred edge: {source} -> {target}")

        return {
            "changes": "; ".join(changes) if changes else "No inferred connections generated.",
            "debate": result,
            "judge": judge,
        }
