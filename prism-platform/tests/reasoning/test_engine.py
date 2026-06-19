import pytest
from unittest.mock import patch, MagicMock
from prism.engine.memory.graph import TemporalGraph
from prism.engine.reasoning.engine import ReasoningEngine

def test_adversarial_engine():
    # 1. Mock a populated case graph
    graph = TemporalGraph()
    patient_id = graph.add_node("entity_patient", {"name": "Rosa Gutierrez"})
    
    claim_a = graph.add_node("claim", {
        "text": "Incidental finding: 2.1 cm heterogeneous mass in the cecum",
        "source_doc": "radiology_report.pdf",
        "page": 847,
    })
    graph.add_edge(claim_a, patient_id, "about")
    
    claim_b = graph.add_node("claim", {
        "text": "imaging otherwise unremarkable",
        "source_doc": "pcp_note.pdf",
        "page": 112,
    })
    graph.add_edge(claim_b, patient_id, "about")
    graph.add_divergence(claim_a, claim_b, "imaging_results")
    
    # 2. Run the adversarial engine with patched LLM
    engine = ReasoningEngine(graph)
    
    # Mock LLM Client responses specifically for this test
    engine.llm = MagicMock()
    engine.llm.generate_json.side_effect = [
        {"argument": "Advocate case", "evidence_chips": [{"node_id": claim_a}]},
        {"argument": "Skeptic case", "evidence_chips": [{"node_id": claim_b}]},
        {"verdict": "Breach", "bias_flags": ["Hindsight bias"], "claims": [{"status": "LIVE"}]}
    ]
    
    result = engine.analyze(
        question="Did the PCP meet the standard of care regarding the radiology finding?",
        persona_pack="legal",
        rounds=1,
        adjudication_mode="force_winner"
    )
    
    # 3. Assert evidence chips correctly link back
    assert result is not None
    assert "advocate" in result
    assert "skeptic" in result
    assert "judge" in result
    
    advocate_chips = result["advocate"]["evidence_chips"]
    # Check if advocate cites the divergence/radiology report
    assert any(chip["node_id"] == claim_a for chip in advocate_chips)
    
    # 4. Verify Judge output structural elements
    judge = result["judge"]
    assert "verdict" in judge
    assert "bias_flags" in judge
    assert "claims" in judge
    
    assert len(judge["claims"]) > 0
    # Claims should have a status like LIVE or DROPPED
    assert judge["claims"][0]["status"] in ["LIVE", "DROPPED", "CONTESTED"]
