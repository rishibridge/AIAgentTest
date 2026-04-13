"""
Remy Hippocampus — Significance Scorer
Amygdala analog: determines how strongly a memory is encoded and how slowly it decays.
Domain-pluggable — health-specific heuristics are the first plugin.
"""
import re

# ── Lexical Signal Dictionaries ──────────────────────────────────

DISTRESS_MARKERS = {
    "high": ["want to die", "can't take this", "hopeless", "life is over",
             "breaking point", "give up", "falling apart", "suicidal", "end it all"],
    "medium": ["scared", "terrified", "furious", "devastated", "fraud",
               "worthless", "empty", "trapped", "failing", "drowning",
               "helpless", "defeated", "hate myself", "can't cope"],
    "low": ["worried", "stressed", "anxious", "frustrated", "tired",
            "sad", "lonely", "confused", "overwhelmed", "annoyed",
            "discouraged", "uneasy"]
}

POSITIVE_MARKERS = {
    "high": ["breakthrough", "finally understand", "changed my life",
             "first time in years", "never felt better", "turning point",
             "everything clicked", "life-changing"],
    "medium": ["feeling good", "making progress", "slept well",
               "proud of myself", "turned a corner", "getting better",
               "feel hopeful", "real improvement"],
    "low": ["okay", "fine", "not bad", "a little better", "decent"]
}

INTENSIFIERS = ["fucking", "so much", "extremely", "absolutely", "never",
                "always", "worst", "best", "completely", "totally",
                "incredibly", "god", "jesus", "holy shit"]

# ── Health-Specific Patterns ─────────────────────────────────────

MEDICATION_PATTERNS = [
    r"\b(start|stop|switch|change|prescri|discontinu|taper|increas|decreas)\w*\s+\w*\s*(medication|med|drug|pill|tablet|dose|dosage)",
    r"\b(metformin|insulin|warfarin|aspirin|statin|beta.?blocker|ace.?inhibitor|biologic|humira|enbrel|cosentyx)\b",
    r"\b(stopped? taking|started? taking|doctor.*(put|took).*(on|off))\b",
]

DIAGNOSIS_PATTERNS = [
    r"\b(diagnos|told i have|found out i have|test.*(came back|show|positive|negative))\b",
    r"\b(a1c|blood sugar|blood pressure|cholesterol|esr|crp|mri|x-ray|ct scan)\b",
    r"\b(lab result|test result|biopsy|scan showed)\b",
]

ALLERGY_PATTERNS = [
    r"\b(allerg|anaphyla|react.*(to|badly)|can't tolerate|intoleran)\b",
]

CORRECTION_PATTERNS = [
    r"\b(actually|correction|no,? i meant|i was wrong|that's changed|not anymore|used to but)\b",
    r"\b(stopped|quit|no longer|don't.*anymore|switched from)\b",
]

GOAL_PATTERNS = [
    r"\b(my goal|i want to|i need to|i'm going to|plan to|decided to|committed to)\b",
    r"\b(dream|aspir|vision|aim|objective|target|milestone)\b",
]


def lexical_valence(message: str) -> float:
    """Detect emotional valence from keywords. Returns -1.0 to +1.0."""
    text = message.lower()
    score = 0.0

    for word in DISTRESS_MARKERS["high"]:
        if word in text:
            score = min(score, -0.9)
    for word in DISTRESS_MARKERS["medium"]:
        if word in text:
            score = min(score, -0.6)
    for word in DISTRESS_MARKERS["low"]:
        if word in text:
            score = min(score, -0.3)

    for word in POSITIVE_MARKERS["high"]:
        if word in text:
            score = max(score, 0.9)
    for word in POSITIVE_MARKERS["medium"]:
        if word in text:
            score = max(score, 0.6)
    for word in POSITIVE_MARKERS["low"]:
        if word in text:
            score = max(score, 0.2)

    # Intensifiers amplify direction
    for word in INTENSIFIERS:
        if word in text:
            score *= 1.3
            break  # only apply once

    return max(-1.0, min(1.0, score))


def structural_valence(message: str) -> float:
    """
    Detect emotional intensity from HOW the message is written.
    Returns 0.0 to 0.5 (always positive — this measures intensity, not direction).
    """
    signals = 0.0

    # Long messages = elaboration = something matters
    if len(message) > 200:
        signals += 0.1
    if len(message) > 500:
        signals += 0.15

    # ALL CAPS
    if len(message) > 10:
        caps_ratio = sum(1 for c in message if c.isupper()) / len(message)
        if caps_ratio > 0.3:
            signals += 0.2

    # Exclamation marks
    if message.count("!") >= 3:
        signals += 0.15

    # Profanity
    profanity = ["fuck", "shit", "damn", "hell", "crap", "bullshit", "ass"]
    if any(w in message.lower() for w in profanity):
        signals += 0.2

    # Ellipsis — hesitation, trailing off, processing
    if "..." in message:
        signals += 0.05

    # Repeated punctuation (?? or !!)
    if re.search(r'[?!]{2,}', message):
        signals += 0.1

    return min(signals, 0.5)


def compute_realtime_valence(message: str) -> float:
    """
    Fast emotional valence for real-time use (no API call).
    Combines lexical direction with structural intensity.
    """
    lex = lexical_valence(message)
    struct = structural_valence(message)

    if lex == 0.0:
        return 0.0  # no emotional signal detected

    direction = -1.0 if lex < 0 else 1.0
    return max(-1.0, min(1.0, lex + struct * direction))


def _matches_any(text: str, patterns: list[str]) -> bool:
    """Check if text matches any regex pattern."""
    text_lower = text.lower()
    for pat in patterns:
        if re.search(pat, text_lower):
            return True
    return False


def score_significance(message: str, emotional_valence: float,
                       prior_mention_count: int = 0) -> tuple[float, float]:
    """
    Score the significance of a message. Returns (significance, decay_rate).

    significance: 0.0-1.0 — how important this is to remember
    decay_rate: 0.001-0.1 — how fast this memory fades per day
    """
    base_score = 0.1  # default: low significance

    # ── Health-specific amplifiers (domain plugin) ──
    text = message.lower()

    if _matches_any(message, ALLERGY_PATTERNS):
        base_score = max(base_score, 0.99)

    if _matches_any(message, MEDICATION_PATTERNS):
        base_score = max(base_score, 0.95)

    if _matches_any(message, DIAGNOSIS_PATTERNS):
        base_score = max(base_score, 0.90)

    if _matches_any(message, CORRECTION_PATTERNS):
        base_score = max(base_score, 0.90)

    if _matches_any(message, GOAL_PATTERNS):
        base_score = max(base_score, 0.80)

    # Intervention outcomes (positive or negative)
    if any(w in text for w in ["worked", "helped", "made it worse",
                                "didn't help", "improvement", "side effect"]):
        base_score = max(base_score, 0.75)

    # ── Emotional amplification (amygdala analog) ──
    emotion_boost = abs(emotional_valence) * 0.3  # max +0.3

    # ── Reinforcement (Hebbian) ──
    reinforcement = min(prior_mention_count * 0.05, 0.2)  # max +0.2

    final_score = min(base_score + emotion_boost + reinforcement, 1.0)

    # ── Decay rate is INVERSE of significance + emotion ──
    # High significance + high emotion = almost no decay
    decay_rate = max(0.001, 0.1 * (1.0 - final_score) * (1.0 - abs(emotional_valence)))

    return round(final_score, 4), round(decay_rate, 5)
