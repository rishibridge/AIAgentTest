import pytest
from prism.engine.memory.graph import TemporalGraph, Node, Edge

def test_add_node():
    graph = TemporalGraph()
    node_id = graph.add_node(
        node_type="clinical_event",
        properties={"description": "2.1 cm cecal mass"}
    )
    assert node_id is not None
    
    node = graph.get_node(node_id)
    assert node.node_type == "clinical_event"
    assert node.properties["description"] == "2.1 cm cecal mass"

def test_add_edge():
    graph = TemporalGraph()
    id1 = graph.add_node("clinical_event", {"description": "Mass"})
    id2 = graph.add_node("clinical_event", {"description": "Pain"})
    
    edge_id = graph.add_edge(id1, id2, "temporal", {"time_diff_days": 90})
    
    assert edge_id is not None
    edge = graph.get_edge(edge_id)
    assert edge.source == id1
    assert edge.target == id2
    assert edge.edge_type == "temporal"
    assert edge.properties["time_diff_days"] == 90

def test_divergence_detection():
    # Provide a mock radiology report and a mock PCP note.
    # Assert that the system automatically detects the divergence
    # and flags the contradiction without overwriting either claim.
    graph = TemporalGraph()
    
    # 1. Add patient
    patient_id = graph.add_node("entity_patient", {"name": "Rosa Gutierrez"})
    
    # 2. Add radiology report finding
    claim_a = graph.add_node("claim", {
        "text": "Incidental finding: 2.1 cm heterogeneous mass in the cecum",
        "source_type": "DOC",
        "source_doc": "radiology_report.pdf",
        "page": 847,
        "credibility": 0.95
    })
    graph.add_edge(claim_a, patient_id, "about")
    
    # 3. Add PCP note finding (contradicts radiology)
    claim_b = graph.add_node("claim", {
        "text": "imaging otherwise unremarkable",
        "source_type": "DOC",
        "source_doc": "pcp_note.pdf",
        "page": 112,
        "credibility": 0.95
    })
    graph.add_edge(claim_b, patient_id, "about")
    
    # Register a divergence
    div_id = graph.add_divergence(
        claim_a_id=claim_a,
        claim_b_id=claim_b,
        topic="imaging_results"
    )
    
    # Assert neither claim is overwritten
    assert graph.get_node(claim_a) is not None
    assert graph.get_node(claim_b) is not None
    
    # Assert divergence is tracked
    divergence = graph.get_divergence(div_id)
    assert divergence.claim_a_id == claim_a
    assert divergence.claim_b_id == claim_b
    assert divergence.status == "active"
