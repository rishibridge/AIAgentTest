def test_credibility_defaults():
    from prism.engine.memory.credibility import get_base_credibility
    
    assert get_base_credibility("lab_result") == 0.95
    assert get_base_credibility("physician_note") == 0.85
    assert get_base_credibility("user_stated") == 0.80
    assert get_base_credibility("inferred") == 0.50
    assert get_base_credibility("unknown_type") == 0.50  # Default
