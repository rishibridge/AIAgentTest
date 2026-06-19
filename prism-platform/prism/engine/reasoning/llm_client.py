import json
import os
import re
from typing import Dict, Any, Optional

try:
    from dotenv import load_dotenv
    # Load from the root Agent Test directory where the API key is stored
    load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))), ".env"))
    # fallback to current dir
    load_dotenv()
except ImportError:
    pass

try:
    from google import genai
    from google.genai import types
except ImportError:
    genai = None

class LLMClient:
    """
    A generic LLM Client for interacting with language models.
    Supports JSON mode for structured outputs.
    """
    def __init__(self, api_key: Optional[str] = None, mock: bool = False):
        self.api_key = api_key or os.environ.get("GOOGLE_API_KEY")
        self.mock = mock
        
        if self.api_key and genai is not None:
            self.client = genai.Client(api_key=self.api_key)
        else:
            self.client = None
            
    def generate(self, prompt: str, system_instruction: str = "", file_path: Optional[str] = None) -> str:
        if self.mock or not self.client:
            return self._mock_generate(prompt)
            
        try:
            contents = [prompt]
            if file_path:
                print(f"Uploading file to Gemini: {file_path}")
                uploaded_file = self.client.files.upload(file=file_path)
                contents = [uploaded_file, prompt]
                
            response = self.client.models.generate_content(
                model='gemini-2.5-flash',
                contents=contents,
                config=types.GenerateContentConfig(
                    system_instruction=system_instruction,
                    temperature=0.2,
                ),
            )
            return response.text
        except Exception as e:
            print(f"LLM Generation Error: {e}")
            return self._mock_generate(prompt)
        
    def generate_json(self, prompt: str, system_instruction: str = "", file_path: Optional[str] = None) -> Dict[str, Any]:
        """Forces the LLM to return valid JSON and parses it."""
        
        json_prompt = prompt + "\n\nCRITICAL INSTRUCTION: Output ONLY a valid JSON object. Do not include markdown codeblocks or any other text before or after the JSON."
        
        response_text = self.generate(json_prompt, system_instruction, file_path=file_path)
        
        # Clean up potential markdown codeblocks from the LLM
        response_text = response_text.strip()
        if response_text.startswith("```json"):
            response_text = response_text[7:]
        elif response_text.startswith("```"):
            response_text = response_text[3:]
        if response_text.endswith("```"):
            response_text = response_text[:-3]
            
        try:
            return json.loads(response_text)
        except json.JSONDecodeError as e:
            print(f"Failed to decode JSON: {response_text}")
            # Fallback for E2E robustness if parsing fails
            return self._fallback_json_for_prompt(prompt)
            
    def _fallback_json_for_prompt(self, prompt: str) -> Dict[str, Any]:
        if "judge" in prompt.lower() or "adjudicate" in prompt.lower():
            return {
                "verdict": "Fallback: Could not parse LLM output.",
                "score": 0,
                "confidence": 0,
                "bias_flags": []
            }
        return {}

    def _mock_generate(self, prompt: str) -> str:
        # Simple mock logic based on prompt keywords to support our tests
        if "advocate" in prompt.lower() or "argue" in prompt.lower():
            return json.dumps({
                "argument": "The documentation clearly shows a failure to act.",
                "evidence_chips": [{"node_id": "mock_1", "text": "radiology", "page": 847}]
            })
        elif "skeptic" in prompt.lower() or "challenge" in prompt.lower():
            return json.dumps({
                "argument": "Standard of care was met based on the patient's presentation.",
                "evidence_chips": [{"node_id": "mock_2", "text": "pcp note", "page": 112}]
            })
        elif "judge" in prompt.lower() or "adjudicate" in prompt.lower():
            return json.dumps({
                "verdict": "The advocate establishes a clear breach of standard of care.",
                "score": 8,
                "confidence": 0.90,
                "bias_flags": ["Hindsight bias"],
                "claims": [
                    {"claim": "PCP failed to act", "status": "LIVE", "strength": 0.95}
                ]
            })
        elif "extract" in prompt.lower() or "claims" in prompt.lower():
            return json.dumps([
                {"text": "2.1 cm heterogeneous mass", "source_type": "DOC", "credibility": 0.85}
            ])
        else:
            return json.dumps({"result": "mock_response"})
