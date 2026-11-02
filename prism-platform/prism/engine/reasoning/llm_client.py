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


def _extract_json_object(raw: str) -> Optional[Any]:
    """Attempt strict JSON decode, then balanced brace/bracket substring decode."""
    cleaned = raw.strip()
    if cleaned.startswith("```json"):
        cleaned = cleaned[7:]
    elif cleaned.startswith("```"):
        cleaned = cleaned[3:]
    if cleaned.endswith("```"):
        cleaned = cleaned[:-3]
    cleaned = cleaned.strip()

    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        pass

    # Try extracting outermost JSON object {...}
    first_brace = cleaned.find("{")
    last_brace = cleaned.rfind("}")
    if first_brace != -1 and last_brace > first_brace:
        try:
            return json.loads(cleaned[first_brace : last_brace + 1])
        except json.JSONDecodeError:
            pass
    return None


class LLMClient:
    """
    A generic LLM Client for interacting with language models.
    Supports native JSON mode for structured outputs.
    """
    def __init__(self, api_key: Optional[str] = None, mock: bool = False):
        self.api_key = api_key or os.environ.get("GOOGLE_API_KEY")
        self.mock = mock

        if self.api_key and genai is not None:
            self.client = genai.Client(api_key=self.api_key)
        else:
            self.client = None

    def generate(
        self,
        prompt: str,
        system_instruction: str = "",
        file_path: Optional[str] = None,
        model: str = "gemini-2.5-flash",
        response_mime_type: Optional[str] = None,
    ) -> str:
        if self.mock or not self.client:
            return self._mock_generate(prompt)

        try:
            contents = [prompt]
            if file_path:
                print(f"Uploading file to Gemini: {file_path}")
                uploaded_file = self.client.files.upload(file=file_path)
                contents = [uploaded_file, prompt]

            cfg_kwargs: Dict[str, Any] = {
                "system_instruction": system_instruction,
                "temperature": 0.2,
            }
            if response_mime_type:
                cfg_kwargs["response_mime_type"] = response_mime_type

            response = self.client.models.generate_content(
                model=model,
                contents=contents,
                config=types.GenerateContentConfig(**cfg_kwargs),
            )
            return response.text or ""
        except Exception as e:
            print(f"[LLMClient] Generation Error for model={model}: {type(e).__name__}: {e}")
            if self.mock:
                return self._mock_generate(prompt)
            return json.dumps({
                "_llm_error": True,
                "error_type": type(e).__name__,
                "error_detail": str(e),
                "text": f"LLM generation failed ({type(e).__name__}). The model '{model}' may be unavailable. Please try again.",
                "flags": [],
                "node_updates": [],
                "edge_updates": [],
                "referenced_nodes": [],
                "recommendations": [],
            })

    def generate_json(
        self,
        prompt: str,
        system_instruction: str = "",
        file_path: Optional[str] = None,
        model: str = "gemini-2.5-flash",
        strict: bool = False,
    ) -> Dict[str, Any]:
        """Forces the LLM to return valid JSON using native response_mime_type and parses it."""
        json_prompt = (
            prompt
            + "\n\nCRITICAL INSTRUCTION: Output ONLY a valid JSON object. Do not include markdown codeblocks or any other text before or after the JSON."
        )

        response_text = self.generate(
            json_prompt,
            system_instruction,
            file_path=file_path,
            model=model,
            response_mime_type="application/json",
        )

        parsed = _extract_json_object(response_text)
        if isinstance(parsed, dict):
            if strict and parsed.get("_llm_error"):
                raise RuntimeError(parsed.get("error_detail") or parsed.get("text") or "LLM generation failed")
            return parsed
        if isinstance(parsed, list):
            return {"claims": parsed}

        print(f"Failed to decode JSON: {response_text[:300]}")
        if strict:
            raise RuntimeError("Failed to parse valid JSON from model output")
        return self._fallback_json_for_prompt(prompt)

    def _fallback_json_for_prompt(self, prompt: str) -> Dict[str, Any]:
        if "judge" in prompt.lower() or "adjudicate" in prompt.lower():
            return {
                "_llm_error": True,
                "verdict": "Fallback: Could not parse LLM output.",
                "score": 0,
                "confidence": 0,
                "bias_flags": [],
            }
        if "clinician" in prompt.lower() or "clinical" in prompt.lower():
            return {
                "_llm_error": True,
                "text": "I encountered a parsing error processing the clinical data. Please rephrase your question or try again.",
                "flags": [],
                "node_updates": [],
                "edge_updates": [],
                "referenced_nodes": [],
                "recommendations": [],
            }
        return {"_llm_error": True}

    def _mock_generate(self, prompt: str) -> str:
        # Simple mock logic based on prompt keywords to support our tests
        if "advocate" in prompt.lower() or "argue" in prompt.lower():
            return json.dumps({
                "argument": "The documentation clearly shows a failure to act.",
                "evidence_chips": [{"node_id": "mock_1", "text": "radiology", "page": 847}],
            })
        elif "skeptic" in prompt.lower() or "challenge" in prompt.lower():
            return json.dumps({
                "argument": "Standard of care was met based on the patient's presentation.",
                "evidence_chips": [{"node_id": "mock_2", "text": "pcp note", "page": 112}],
            })
        elif "judge" in prompt.lower() or "adjudicate" in prompt.lower():
            return json.dumps({
                "verdict": "The advocate establishes a clear breach of standard of care.",
                "score": 8,
                "confidence": 0.90,
                "bias_flags": ["Hindsight bias"],
                "claims": [
                    {"claim": "PCP failed to act", "status": "LIVE", "strength": 0.95}
                ],
            })
        elif "extract" in prompt.lower() or "claims" in prompt.lower():
            return json.dumps([
                {"text": "2.1 cm heterogeneous mass", "source_type": "DOC", "credibility": 0.85}
            ])
        else:
            return json.dumps({"result": "mock_response"})
