"""
GraphBuilder — Extends Prism's DocumentExtractor for conversation-based extraction.
Uses the same LLM extraction pattern but tuned for patient conversations
instead of documents.
"""
import json
import math
import random
from typing import Dict, Any, List, Optional, Tuple

from prism.engine.memory.extractor import DocumentExtractor
from prism.engine.memory.graph import TemporalGraph
from prism.engine.reasoning.llm_client import LLMClient


CONVERSATION_EXTRACTION_PROMPT = """Analyze the following conversation messages and extract any NEW entities, relationships, or significant content that should be added to the patient's knowledge graph.

Current graph has these existing nodes:
{existing_nodes}

New messages to process:
{messages}

Extract ONLY genuinely new content — do NOT re-extract things already in the graph.

Return a JSON object with:
{{
  "claims": [
    {{"text": "extracted entity or relationship", "entity_type": "person|clinical|belief|event|faith|symptom|significance|medication|locked|undisclosed|avoidance|agreed|referral|life", "id": "snake_case_id", "label": "Human Readable Label", "size": 14-25, "credibility": 0.8}}
  ],
  "edges": [
    {{"source": "node_id", "target": "node_id", "label": "relationship description", "weight": 1-4}}
  ]
}}

Node kind / entity_type guidelines:
- person: Named people (family, friends, partners) — size 18-22
- clinical: Medical conditions, diagnoses — size 16-20
- medication: Drugs, treatments — size 14-16
- belief: Core beliefs, often in quotes — size 16-18
- event: Life events, incidents — size 14-18
- faith: Religious/spiritual elements — size 16-18
- symptom: Active symptoms — size 14-16
- significance: High-significance disclosures — size 16-22
- locked: Content patient explicitly locked — size 14-16
- undisclosed: Content patient hasn't told clinicians — size 14-16
- avoidance: Avoidance patterns — size 14-16
- agreed: Patient agreements/commitments — size 16
- referral: Clinical referrals — size 16
- life: Life context items — size 14

Edge weight guidelines:
- 1: mentioned once, peripheral
- 2: mentioned multiple times, moderate significance
- 3: recurring theme, strong connection
- 4: defining relationship, maximum significance

CRITICAL: Return ONLY the JSON object."""


class GraphBuilder(DocumentExtractor):
    """
    Extends Prism's DocumentExtractor for conversation-based extraction.
    Inherits the LLM + graph pattern; overrides ingestion for message streams.
    """

    def __init__(self, graph: TemporalGraph, llm_client: LLMClient = None):
        super().__init__(graph, llm_client)

    def ingest_conversation(
        self,
        messages: List[Dict[str, Any]],
        source_name: str = "conversation",
    ) -> Dict[str, Any]:
        """
        Extract entities and relationships from conversation messages.
        Extends DocumentExtractor.ingest_text with conversation-aware extraction.
        """
        # Build context of existing nodes using inherited graph
        existing_nodes = self.graph.get_all_nodes()
        existing = "\n".join(
            f"- {n.id}: {n.properties.get('label', n.id)} (kind: {n.node_type})"
            for n in existing_nodes
        )
        if not existing:
            existing = "(empty graph)"

        # Format messages
        msg_text = "\n".join(
            f"{m.get('sender', 'unknown').upper()}: {m.get('text', '')}"
            for m in messages
        )

        prompt = CONVERSATION_EXTRACTION_PROMPT.format(
            existing_nodes=existing,
            messages=msg_text,
        )

        try:
            result = self.llm.generate_json(
                prompt,
                system_instruction="You are a clinical graph builder. Extract entities and relationships from patient conversations."
            )
        except Exception as e:
            print(f"GraphBuilder extraction error: {e}")
            return {"nodes_added": 0, "edges_added": 0}

        nodes_added = 0
        edges_added = 0

        # Add new nodes using inherited graph
        for claim in result.get("claims", []):
            node_id = claim.get("id", "")
            if not node_id:
                continue
            # Check if node already exists
            if self.graph.get_node(node_id) is not None:
                continue
            # Use the graph's add_node (which goes through TemporalGraph → PatientGraph)
            self.graph.add_node(
                node_id=node_id,
                label=claim.get("label", claim.get("text", node_id)),
                kind=claim.get("entity_type", "event"),
                size=claim.get("size", 14),
                is_new=True,
            )
            nodes_added += 1

        # Add new edges
        for edge_data in result.get("edges", []):
            source = edge_data.get("source", "")
            target = edge_data.get("target", "")
            if source and target:
                existing_edge = self.graph.get_edge(source, target) if hasattr(self.graph, 'get_edge') else None
                if not existing_edge:
                    self.graph.add_edge(
                        source=source,
                        target=target,
                        label=edge_data.get("label", ""),
                        weight=edge_data.get("weight", 1),
                        is_new=True,
                    )
                    edges_added += 1

        return {
            "status": "success",
            "nodes_added": nodes_added,
            "edges_added": edges_added,
            "source": source_name,
            "details": result,
        }

    def apply_bot_updates(
        self,
        bot_response: Dict[str, Any],
    ) -> Dict[str, Any]:
        """
        Apply the node/edge updates from a bot's structured response.
        Uses the inherited graph reference.
        """
        nodes_added = 0
        edges_added = 0

        for node_data in bot_response.get("node_updates", []):
            node_id = node_data.get("id", "")
            if node_id and self.graph.get_node(node_id) is None:
                self.graph.add_node(
                    node_id=node_id,
                    label=node_data.get("label", node_id),
                    kind=node_data.get("kind", "event"),
                    size=node_data.get("size", 14),
                    is_new=True,
                )
                nodes_added += 1

        for edge_data in bot_response.get("edge_updates", []):
            source = edge_data.get("source", "")
            target = edge_data.get("target", "")
            if source and target:
                existing_edge = self.graph.get_edge(source, target) if hasattr(self.graph, 'get_edge') else None
                if not existing_edge:
                    self.graph.add_edge(
                        source=source,
                        target=target,
                        label=edge_data.get("label", ""),
                        weight=edge_data.get("weight", 1),
                        is_new=True,
                    )
                    edges_added += 1

        return {"nodes_added": nodes_added, "edges_added": edges_added}
