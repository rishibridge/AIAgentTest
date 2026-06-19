import json
import uuid
from typing import Dict, Any, List

from prism.engine.memory.graph import TemporalGraph
from prism.engine.reasoning.llm_client import LLMClient

class DocumentExtractor:
    """
    Parses raw documents and extracts claims, entities, and relationships 
    to populate the TemporalGraph memory substrate.
    """
    
    def __init__(self, graph: TemporalGraph, llm_client: LLMClient = None):
        self.graph = graph
        self.llm = llm_client or LLMClient(mock=True)
        
    def ingest_text(self, text: str, source_name: str) -> Dict[str, Any]:
        """
        Extracts structured claims from raw text and adds them to the graph.
        Returns extraction statistics.
        """
        
        prompt = f"""
        Extract all key claims, clinical facts, and entities from the following text.
        Source Document: {source_name}
        
        TEXT:
        {text}
        
        Format your response as a JSON object with a single key 'claims' containing a list of objects.
        Each claim object must have:
        - text: the extracted claim or fact
        - entity_type: the type of entity (e.g., patient, finding, recommendation)
        """
        
        system_instruction = "You are a clinical memory extractor. Your job is to extract discrete facts."
        
        try:
            result = self.llm.generate_json(prompt, system_instruction=system_instruction)
            claims = result.get("claims", [])
        except Exception as e:
            print(f"Extraction Error: {e}")
            return {"nodes_added": 0}
            
        nodes_added = 0
        for claim in claims:
            # Add each extracted claim to the graph
            self.graph.add_node("claim", {
                "text": claim.get("text", "Unknown claim"),
                "source_doc": source_name,
                "entity_type": claim.get("entity_type", "unknown")
            })
            nodes_added += 1
            
        return {
            "status": "success",
            "nodes_added": nodes_added,
            "source": source_name
        }
            
    def ingest_file(self, file_path: str, source_name: str) -> Dict[str, Any]:
        """
        Parses a multimodal file (PDF/Image/Docx) via LLM File API to extract claims and entities.
        """
        prompt = f"""
        Extract the core claims and factual assertions from the attached file.
        The file is from the source document: "{source_name}".
        
        Return a JSON array of objects. Each object MUST have:
        - "text": The literal claim or finding.
        - "source_type": The type of source (e.g. "RADIOLOGY_REPORT", "CLINICAL_NOTE").
        - "credibility": A float between 0.0 and 1.0 representing how definitive the statement is.
        """
        
        try:
            # We wrap the output in a dict under 'claims' to ensure reliable JSON parsing
            wrapped_prompt = prompt + "\n\nCRITICAL: Output a JSON object with a single key 'claims' containing the array."
            result = self.llm.generate_json(
                wrapped_prompt, 
                system_instruction="You are a meticulous clinical data extractor.",
                file_path=file_path
            )
            
            claims = result.get("claims", [])
            
            # Populate the Temporal Graph
            for claim in claims:
                self.graph.add_node("claim", {
                    "text": claim.get("text", ""),
                    "source_doc": source_name,
                    "source_type": claim.get("source_type", "UNKNOWN"),
                    "credibility": claim.get("credibility", 0.5)
                })
                
            return {"nodes_added": len(claims)}
        except Exception as e:
            print(f"Extraction Error: {e}")
            return {"nodes_added": 0}
