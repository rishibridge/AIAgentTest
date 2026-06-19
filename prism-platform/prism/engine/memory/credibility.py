from typing import Dict

# Default credibility rules (can be overridden by config)
DEFAULT_CREDIBILITY_RULES: Dict[str, float] = {
    "lab_result": 0.95,
    "system_log": 0.95,
    "physician_note": 0.85,
    "deposition": 0.85,
    "user_stated": 0.80,
    "expert_report": 0.80,
    "web_search": 0.70,
    "inferred": 0.50
}

def get_base_credibility(source_type: str, rules: Dict[str, float] = None) -> float:
    """
    Returns the base credibility score for a given source type.
    """
    active_rules = rules if rules is not None else DEFAULT_CREDIBILITY_RULES
    return active_rules.get(source_type, 0.50)
