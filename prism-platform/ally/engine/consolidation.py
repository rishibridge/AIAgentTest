"""
ConsolidationEngine — 5-step post-session consolidation pipeline.
Uses Prism's ReasoningEngine (Advocate/Skeptic/Judge) for each analytical step.
"""
import json
from typing import Dict, Any, List, Optional
from datetime import datetime

from prism.engine.reasoning.engine import ReasoningEngine
from prism.engine.reasoning.llm_client import LLMClient
from prism.engine.memory.graph import TemporalGraph
from ally.engine.patient_graph import PatientGraph


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


class ConsolidationEngine:
    """
    5-step post-session consolidation pipeline.
    Uses Prism's ReasoningEngine for adversarial analysis at each step.
    """

    def __init__(self, llm_client: LLMClient = None):
        self.llm = llm_client or LLMClient(mock=False)

    def get_steps(self) -> List[Dict[str, Any]]:
        """Return the 5 consolidation step definitions."""
        return CONSOLIDATION_STEPS

    def run_full_consolidation(
        self,
        patient_graph: PatientGraph,
        conversation_messages: List[Dict[str, Any]],
    ) -> Dict[str, Any]:
        """
        Run all 5 consolidation steps using ReasoningEngine per step.
        """
        # Create a ReasoningEngine that operates on the patient's graph
        reasoning = ReasoningEngine(graph=patient_graph, llm_client=self.llm)
        results = []

        # Step 0: Session ended — snapshot
        patient_graph.snapshot("pre-consolidation")
        results.append({
            **CONSOLIDATION_STEPS[0],
            "status": "complete",
            "changes": "Working memory captured. Graph snapshot saved.",
        })

        # Step 1: Significance filtering (Advocate/Skeptic/Judge)
        step1 = self._significance_filtering(reasoning, patient_graph, conversation_messages)
        results.append({**CONSOLIDATION_STEPS[1], "status": "complete", **step1})

        # Step 2: Credibility weighting — uses TemporalGraph.add_divergence
        step2 = self._credibility_weighting(reasoning, patient_graph, conversation_messages)
        results.append({**CONSOLIDATION_STEPS[2], "status": "complete", **step2})

        # Step 3: Node merging & edge thickening
        step3 = self._node_merging(reasoning, patient_graph)
        results.append({**CONSOLIDATION_STEPS[3], "status": "complete", **step3})

        # Step 4: Inferred edges
        step4 = self._inferred_edges(reasoning, patient_graph)
        results.append({**CONSOLIDATION_STEPS[4], "status": "complete", **step4})

        # Clear "is_new" flags from all nodes and edges since they are now consolidated
        for node_id in patient_graph._graph.nodes:
            data = patient_graph._graph.nodes[node_id].get('data')
            if data:
                data.properties['is_new'] = False
        for u, v, k, d in patient_graph._graph.edges(keys=True, data=True):
            data = d.get('data')
            if data:
                data.properties['is_new'] = False

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
    ) -> Dict[str, Any]:
        """Step 1: Use ReasoningEngine to identify high-significance disclosures."""
        msg_text = "\n".join(f"{m.get('sender', '?')}: {m.get('text', '')}" for m in messages)

        question = f"""Analyze this conversation for HIGH-SIGNIFICANCE disclosures — things said for the first time, things hard to say, things that reorganize the patient's story.

Conversation:
{msg_text}

Advocate: Identify all significant disclosures and argue they should become weighted nodes.
Skeptic: Challenge — which of these are genuinely significant vs surface-level?
Judge: Decide which disclosures warrant new nodes and what size/weight.

Judge output must include:
{{"significant_disclosures": [{{"node_id": "id", "label": "label", "kind": "significance|belief|event", "size": 16-24}}], "size_adjustments": [{{"node_id": "existing_id", "new_size": 18-28}}]}}"""

        try:
            result = reasoning.analyze(question)
            judge = result.get("judge", {})
            changes = []

            for disc in judge.get("significant_disclosures", []):
                node_id = disc.get("node_id", "")
                if node_id and patient_graph.get_node(node_id) is None:
                    patient_graph.add_node(
                        node_id=node_id,
                        label=disc.get("label", node_id),
                        kind=disc.get("kind", "significance"),
                        size=disc.get("size", 18),
                        is_new=True,
                    )
                    changes.append(f"Added significance node: {disc.get('label')}")

            for adj in judge.get("size_adjustments", []):
                node = patient_graph.get_node(adj.get("node_id", ""))
                if node:
                    node.properties["size"] = adj.get("new_size", node.properties.get("size", 14))
                    changes.append(f"Resized {node.properties.get('label')} to {adj.get('new_size')}")

            return {
                "changes": "; ".join(changes) if changes else "No significant new disclosures identified.",
                "debate": {"advocate": result.get("advocate", {}), "skeptic": result.get("skeptic", {}), "judge": judge},
            }
        except Exception as e:
            return {"changes": f"Significance filtering error: {e}", "debate": {}}

    def _credibility_weighting(
        self,
        reasoning: ReasoningEngine,
        patient_graph: PatientGraph,
        messages: List[Dict[str, Any]],
    ) -> Dict[str, Any]:
        """Step 2: Use ReasoningEngine + TemporalGraph.add_divergence for inconsistencies."""
        msg_text = "\n".join(f"{m.get('sender', '?')}: {m.get('text', '')}" for m in messages)

        question = f"""Check for INCONSISTENCIES between what the patient said in this conversation and what their existing graph shows.

The bot does NOT naively overwrite — it holds BOTH claims and flags the divergence.

Conversation:
{msg_text}

Advocate: Identify potential inconsistencies between new disclosures and existing graph data.
Skeptic: Challenge — are these genuine inconsistencies or just different framings of the same thing?
Judge: Decide which are true divergences that should be flagged.

Judge output must include:
{{"divergences": [{{"topic": "what's inconsistent", "claim_a_node": "existing_node_id", "claim_b_text": "new claim text"}}]}}"""

        try:
            result = reasoning.analyze(question)
            judge = result.get("judge", {})
            divergences = judge.get("divergences", [])

            for div in divergences:
                claim_a_id = div.get("claim_a_node", "")
                claim_b_text = div.get("claim_b_text", "")
                topic = div.get("topic", "")

                if claim_a_id and patient_graph.get_node(claim_a_id) is not None:
                    # Create a new node for the new claim
                    new_id = f"divergence_{claim_a_id}"
                    patient_graph.add_node(
                        node_id=new_id,
                        label=claim_b_text[:50],
                        kind="event",
                        size=14,
                        is_new=True,
                    )
                    # Use TemporalGraph.add_divergence to register the contradiction
                    patient_graph.add_divergence(claim_a_id, new_id, topic)

            if divergences:
                return {
                    "changes": f"Flagged {len(divergences)} divergence(s): " + "; ".join(d.get("topic", "") for d in divergences),
                    "debate": {"advocate": result.get("advocate", {}), "skeptic": result.get("skeptic", {}), "judge": judge},
                }
            return {
                "changes": result.get("credibility_notes", "No inconsistencies detected."),
                "debate": {"advocate": result.get("advocate", {}), "skeptic": result.get("skeptic", {}), "judge": judge},
            }
        except Exception as e:
            return {"changes": f"Credibility weighting error: {e}", "debate": {}}

    def _node_merging(self, reasoning: ReasoningEngine, patient_graph: PatientGraph) -> Dict[str, Any]:
        """Step 3: Use ReasoningEngine to identify merge candidates."""
        question = """Analyze the patient graph for:
1. DUPLICATE or VERY SIMILAR nodes that should be merged
2. EDGES that should be thickened because they've been reinforced

Advocate: Propose merges and thickening.
Skeptic: Challenge — would merging lose important distinctions?
Judge: Decide which merges to execute.

Judge output must include:
{"merge_candidates": [{"keep_id": "node_to_keep", "remove_id": "node_to_remove"}], "edge_thickening": [{"source": "id", "target": "id", "new_weight": 2-4}]}"""

        try:
            result = reasoning.analyze(question)
            judge = result.get("judge", {})
            changes = []

            for merge in judge.get("merge_candidates", []):
                remove_id = merge.get("remove_id", "")
                keep_id = merge.get("keep_id", "")
                if remove_id and keep_id and patient_graph.get_node(remove_id) is not None and patient_graph.get_node(keep_id) is not None:
                    patient_graph.remove_node(remove_id)
                    changes.append(f"Merged {remove_id} into {keep_id}")

            for thick in judge.get("edge_thickening", []):
                edge = patient_graph.get_edge(thick.get("source", ""), thick.get("target", ""))
                if edge:
                    edge.properties["weight"] = min(4, thick.get("new_weight", edge.properties.get("weight", 1)))
                    changes.append(f"Thickened {thick['source']}->{thick['target']}")

            return {
                "changes": "; ".join(changes) if changes else "No merges or thickening needed.",
                "debate": {"advocate": result.get("advocate", {}), "skeptic": result.get("skeptic", {}), "judge": judge},
            }
        except Exception as e:
            return {"changes": f"Node merging error: {e}", "debate": {}}

    def _inferred_edges(self, reasoning: ReasoningEngine, patient_graph: PatientGraph) -> Dict[str, Any]:
        """Step 4: Use ReasoningEngine to generate hypothetical connections."""
        question = """Generate HYPOTHETICAL connections — edges between nodes the patient has NOT explicitly linked but clinical reasoning suggests may be connected.

These are INFERRED edges — marked dashed for clinician review.

Advocate: Propose inferred connections with clinical reasoning.
Skeptic: Challenge — are these genuinely plausible or speculative?
Judge: Approve only clinically plausible inferences.

Judge output must include:
{"inferred_edges": [{"source": "node_id", "target": "node_id", "label": "hypothesized relationship"}], "inferred_nodes": [{"id": "id", "label": "label", "kind": "inferred", "size": 16, "connected_to": "existing_node_id", "edge_label": "relationship"}]}"""

        try:
            result = reasoning.analyze(question)
            judge = result.get("judge", {})
            changes = []

            for node_data in judge.get("inferred_nodes", []):
                node_id = node_data.get("id", "")
                if node_id and patient_graph.get_node(node_id) is None:
                    patient_graph.add_node(
                        node_id=node_id,
                        label=node_data.get("label", node_id),
                        kind="inferred",
                        size=node_data.get("size", 16),
                        is_new=True,
                    )
                    connected_to = node_data.get("connected_to", "")
                    if connected_to and patient_graph.get_node(connected_to) is not None:
                        patient_graph.add_edge(
                            source=node_id,
                            target=connected_to,
                            label=node_data.get("edge_label", "inferred"),
                            weight=1,
                            is_new=True,
                            dashed=True,
                        )
                    changes.append(f"Added inferred node: {node_data.get('label')}")

            for edge_data in judge.get("inferred_edges", []):
                source = edge_data.get("source", "")
                target = edge_data.get("target", "")
                if (source and target
                        and patient_graph.get_node(source) is not None
                        and patient_graph.get_node(target) is not None
                        and patient_graph.get_edge(source, target) is None):
                    patient_graph.add_edge(
                        source=source,
                        target=target,
                        label=edge_data.get("label", "inferred connection"),
                        weight=1,
                        is_new=True,
                        dashed=True,
                    )
                    changes.append(f"Inferred edge: {source} -> {target}")

            return {
                "changes": "; ".join(changes) if changes else "No inferred connections generated.",
                "debate": {"advocate": result.get("advocate", {}), "skeptic": result.get("skeptic", {}), "judge": judge},
            }
        except Exception as e:
            return {"changes": f"Inferred edges error: {e}", "debate": {}}
