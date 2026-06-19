from fastapi.testclient import TestClient
from prism.api.app import app

client = TestClient(app)

def test_create_session():
    response = client.post("/api/v1/sessions/create")
    assert response.status_code == 200
    assert "session_id" in response.json()

def test_analyze():
    response = client.post(
        "/api/v1/reasoning/analyze",
        json={
            "session_id": "test-session",
            "question": "Did the PCP breach standard of care?",
            "persona_pack": "legal"
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert "advocate" in data
    assert "skeptic" in data
    assert "judge" in data
