"""
Remy Hippocampus — Embeddings
Gemini text-embedding-004 for semantic vectors + cosine similarity.
"""
import numpy as np
from google import genai

_client = None

def _get_client(api_key: str = None):
    global _client
    if _client is None:
        _client = genai.Client(api_key=api_key)
    return _client


def init_embedding_client(api_key: str):
    """Initialize the embedding client with API key."""
    global _client
    _client = genai.Client(api_key=api_key)


def embed_text(text: str) -> list[float]:
    """
    Generate a 768-dim embedding vector for the given text.
    Uses Gemini text-embedding-004.
    """
    client = _get_client()
    result = client.models.embed_content(
        model="gemini-embedding-001",
        contents=text
    )
    return result.embeddings[0].values


def cosine_similarity(a: list[float], b: list[float]) -> float:
    """Compute cosine similarity between two vectors."""
    a_np = np.array(a)
    b_np = np.array(b)
    dot = np.dot(a_np, b_np)
    norm = np.linalg.norm(a_np) * np.linalg.norm(b_np)
    if norm == 0:
        return 0.0
    return float(dot / norm)


def find_similar(query_embedding: list[float], 
                 memories: list[dict], 
                 top_k: int = 5,
                 significance_weight: float = 0.3,
                 recency_weight: float = 0.2) -> list[dict]:
    """
    Find the most similar memories to the query, weighted by
    similarity × significance × recency.

    Each memory dict must have 'embedding', 'significance', and 'timestamp'.
    Returns memories sorted by combined score, with 'similarity' and 'combined_score' added.
    """
    from datetime import datetime, timezone

    now = datetime.now(timezone.utc)
    scored = []

    for mem in memories:
        if not mem.get("embedding"):
            continue

        # Cosine similarity (0 to 1)
        sim = cosine_similarity(query_embedding, mem["embedding"])

        # Recency factor: exponential decay over days
        ts = mem.get("timestamp")
        if isinstance(ts, str):
            ts = datetime.fromisoformat(ts.replace("Z", "+00:00"))
        if ts:
            days_ago = max((now - ts).total_seconds() / 86400, 0)
            recency = 1.0 / (1.0 + days_ago * 0.05)  # slow decay
        else:
            recency = 0.5

        sig = mem.get("significance", 0.5)

        # Combined score
        sim_w = 1.0 - significance_weight - recency_weight
        combined = sim * sim_w + sig * significance_weight + recency * recency_weight

        scored.append({
            **mem,
            "similarity": round(sim, 4),
            "recency": round(recency, 4),
            "combined_score": round(combined, 4),
        })

    scored.sort(key=lambda x: -x["combined_score"])
    return scored[:top_k]
