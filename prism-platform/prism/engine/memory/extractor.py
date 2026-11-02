import json
import re
import uuid
from typing import Dict, Any, List, Optional

from prism.engine.memory.graph import TemporalGraph
from prism.engine.reasoning.llm_client import LLMClient


_ENTITY_KIND_MAP = {
    "medication": "medication",
    "drug": "medication",
    "prescription": "medication",
    "regimen": "medication",
    "symptom": "symptom",
    "complaint": "symptom",
    "diagnosis": "clinical",
    "condition": "clinical",
    "finding": "clinical",
    "clinical": "clinical",
    "lab": "clinical",
    "vital": "clinical",
    "person": "person",
    "family": "person",
    "provider": "clinician",
    "clinician": "clinician",
    "safety": "clinician_safety",
    "risk": "clinician_safety",
    "belief": "belief",
    "referral": "referral",
    "recommendation": "agreed",
}


def _slugify_claim(text: str) -> str:
    words = re.findall(r"[a-z0-9]+", text.lower())[:4]
    return "_".join(words) if words else "claim"


def _format_display_label(text: str, max_len: int = 56) -> str:
    cleaned = " ".join(str(text).split())
    if len(cleaned) <= max_len:
        return cleaned
    return cleaned[: max_len - 3].rstrip() + "..."


class DocumentExtractor:
    """
    Parses raw documents and extracts claims, entities, and relationships
    to populate the TemporalGraph (or Ally PatientGraph) memory substrate.
    """

    def __init__(self, graph: TemporalGraph, llm_client: LLMClient = None):
        self.graph = graph
        self.llm = llm_client or LLMClient(mock=True)

    def _find_self_node_id(self) -> Optional[str]:
        if hasattr(self.graph, "nodes") and isinstance(self.graph.nodes, dict):
            for nid, nv in self.graph.nodes.items():
                if getattr(nv, "kind", None) == "self":
                    return nid
        return None

    def _store_claims(self, claims: List[Dict[str, Any]], source_name: str) -> Dict[str, Any]:
        is_patient_graph = hasattr(self.graph, "patient") and hasattr(self.graph, "_positions")
        self_node_id = self._find_self_node_id() if is_patient_graph else None

        nodes_added = 0
        edges_added = 0
        added_node_ids: List[str] = []

        for claim in claims:
            if not isinstance(claim, dict):
                continue
            claim_text = str(claim.get("text") or "").strip()
            if not claim_text:
                continue
            raw_type = str(claim.get("entity_type") or claim.get("source_type") or "event").strip().lower()
            credibility = claim.get("credibility", 0.85)
            try:
                credibility_val = float(credibility)
            except (TypeError, ValueError):
                credibility_val = 0.85

            if is_patient_graph:
                mapped_kind = _ENTITY_KIND_MAP.get(raw_type, "event")
                node_id = f"doc_{_slugify_claim(claim_text)}_{uuid.uuid4().hex[:6]}"
                display_label = _format_display_label(claim_text)
                self.graph.add_node(
                    node_id=node_id,
                    label=display_label,
                    kind=mapped_kind,
                    size=14,
                    is_new=True,
                    properties={
                        "text": claim_text,
                        "source_doc": source_name,
                        "entity_type": raw_type,
                        "credibility": credibility_val,
                    },
                )
                added_node_ids.append(node_id)
                nodes_added += 1

                if self_node_id and self_node_id != node_id:
                    edge_label = f"doc: {source_name[:22]}"
                    self.graph.add_edge(
                        source=self_node_id,
                        target=node_id,
                        label=edge_label,
                        weight=1,
                        is_new=True,
                    )
                    edges_added += 1
            else:
                # Standard Prism TemporalGraph signature: add_node(node_type, properties)
                nid = self.graph.add_node("claim", {
                    "text": claim_text,
                    "source_doc": source_name,
                    "entity_type": raw_type,
                    "credibility": credibility_val,
                })
                added_node_ids.append(nid)
                nodes_added += 1

        return {
            "status": "success",
            "nodes_added": nodes_added,
            "edges_added": edges_added,
            "node_ids": added_node_ids,
            "source": source_name,
        }

    def ingest_text(self, text: str, source_name: str) -> Dict[str, Any]:
        """
        Extracts structured claims from raw text and adds them to the graph.
        Returns extraction statistics.
        """
        prompt = f"""
        Extract all key claims, clinical facts, medications, symptoms, diagnoses, and entities from the following text.
        Source Document: {source_name}

        TEXT:
        {text}

        Format your response as a JSON object with a single key 'claims' containing a list of objects.
        Each claim object must have:
        - text: the extracted discrete claim or clinical fact (concise, self-contained string)
        - entity_type: one of [medication, symptom, diagnosis, finding, lab, person, safety, recommendation, event]
        - credibility: float between 0.0 and 1.0 representing confidence/definitiveness
        """

        system_instruction = "You are a clinical memory extractor. Your job is to extract discrete, accurate clinical facts."

        result = self.llm.generate_json(prompt, system_instruction=system_instruction)
        if not isinstance(result, dict):
            raise RuntimeError("LLM clinical extraction returned invalid structure")
        claims = result.get("claims", [])
        if not isinstance(claims, list):
            claims = []

        return self._store_claims(claims, source_name)

    def ingest_file(self, file_path: str, source_name: str) -> Dict[str, Any]:
        """
        Parses a multimodal file (PDF/Image/Docx) via LLM File API to extract claims and entities.
        """
        prompt = f"""
        Extract the core claims and factual assertions from the attached file.
        The file is from the source document: "{source_name}".

        Return a JSON array of objects. Each object MUST have:
        - "text": The literal claim or finding.
        - "entity_type": One of [medication, symptom, diagnosis, finding, lab, person, safety, recommendation, event].
        - "source_type": The type of source (e.g. "RADIOLOGY_REPORT", "CLINICAL_NOTE").
        - "credibility": A float between 0.0 and 1.0 representing how definitive the statement is.
        """

        wrapped_prompt = prompt + "\n\nCRITICAL: Output a JSON object with a single key 'claims' containing the array."
        result = self.llm.generate_json(
            wrapped_prompt,
            system_instruction="You are a meticulous clinical data extractor.",
            file_path=file_path,
        )
        if not isinstance(result, dict):
            raise RuntimeError("LLM multimodal extraction returned invalid structure")
        claims = result.get("claims", [])
        if not isinstance(claims, list):
            claims = []

        return self._store_claims(claims, source_name)
