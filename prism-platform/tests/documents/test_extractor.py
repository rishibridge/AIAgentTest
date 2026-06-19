def test_extract_claims():
    from prism.engine.documents.extractor import extract_claims
    
    doc_text = "Patient presents with 2.1 cm cecal mass on CT scan."
    claims = extract_claims(doc_text)
    
    assert len(claims) > 0
    assert claims[0]["text"] == "Patient presents with 2.1 cm cecal mass on CT scan."
    assert claims[0]["source_type"] == "DOC"
