from typing import List, Dict, Any

def extract_claims(text: str) -> List[Dict[str, Any]]:
    """
    Extracts individual claims from a document text.
    For the MVP, we just treat the whole text as a single claim,
    but in a real system this would use an LLM or NLP to segment it.
    """
    if not text.strip():
        return []
        
    return [{
        "text": text.strip(),
        "source_type": "DOC",
        "credibility": 0.85 # Default for docs
    }]
