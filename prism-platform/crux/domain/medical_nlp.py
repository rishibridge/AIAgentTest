import json
from typing import List, Dict, Any
from prism.engine.reasoning.llm_client import LLMClient

class MedicalNLP:
    def __init__(self, llm_client: LLMClient = None):
        self.llm = llm_client or LLMClient(mock=False)

    def extract_events(self, text: str) -> List[Dict[str, Any]]:
        """
        Extracts specialized medical causation events and findings using LLM.
        """
        prompt = f"""
        Analyze the following clinical text and extract key medical events.
        Focus on:
        - medical_condition
        - treatment
        - standard_of_care_reference
        - deviation_event
        
        TEXT:
        {text}
        
        Return a JSON array of objects. Each object MUST have:
        - "type": the event type (e.g. "medical_condition")
        - "concept": the exact text or description
        - "provider": the provider involved, if mentioned
        """
        
        try:
            # We wrap the output in a dict under 'events' for the generic generate_json
            wrapped_prompt = prompt + "\n\nCRITICAL: Output a JSON object with a single key 'events' containing the array."
            result = self.llm.generate_json(wrapped_prompt, system_instruction="You are a clinical NLP extractor.")
            return result.get("events", [])
        except Exception as e:
            print(f"Medical NLP Error: {e}")
            return []

    def extract_events_from_file(self, file_path: str) -> List[Dict[str, Any]]:
        """
        Extracts specialized medical causation events directly from a multimodal file.
        """
        prompt = f"""
        Analyze the attached clinical document and extract key medical events.
        Focus on:
        - medical_condition
        - treatment
        - standard_of_care_reference
        - deviation_event
        
        Return a JSON array of objects. Each object MUST have:
        - "type": the event type (e.g. "medical_condition")
        - "concept": the exact text or description
        - "provider": the provider involved, if mentioned
        """
        
        try:
            wrapped_prompt = prompt + "\n\nCRITICAL: Output a JSON object with a single key 'events' containing the array."
            result = self.llm.generate_json(
                wrapped_prompt, 
                system_instruction="You are a clinical NLP extractor.",
                file_path=file_path
            )
            return result.get("events", [])
        except Exception as e:
            print(f"Medical NLP File Error: {e}")
            return []
