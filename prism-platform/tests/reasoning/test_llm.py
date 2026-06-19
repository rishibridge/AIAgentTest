from unittest.mock import patch, MagicMock
from prism.engine.reasoning.llm_client import LLMClient

def test_llm_client():
    client = LLMClient(api_key="test_key")
    
    # Mock the internal generate call
    with patch.object(client, 'generate', return_value='{"verdict": "Breach", "score": 8}') as mock_gen:
        result = client.generate_json(
            prompt="Analyze this...",
            system_instruction="You are a Judge."
        )
        
        mock_gen.assert_called_once()
        assert result["verdict"] == "Breach"
        assert result["score"] == 8
