"""
Remedy matching engine — scores and filters remedies based on user input.
"""

def get_matching_remedies(remedies, symptom_categories, symptoms, answers):
    symptom_set = set(s.lower().strip() for s in symptoms)

    # Find relevant categories
    active_categories = set()
    for cat, cat_symptoms in symptom_categories.items():
        if symptom_set & set(cat_symptoms):
            active_categories.add(cat)

    # Preference filter
    preference = answers.get("preference", "No preference")
    pref_map = {"Ayurvedic": "ayurvedic", "Herbal": "herbal", "Supplements": "supplement"}
    preferred_category = None
    for key, val in pref_map.items():
        if key.lower() in preference.lower():
            preferred_category = val
            break

    # Safety filters
    is_pregnant = "pregnant" in answers.get("pregnancy", "").lower() or "nursing" in answers.get("pregnancy", "").lower()
    user_age = answers.get("age", "")
    is_child = "under 18" in user_age.lower() if user_age else False
    medications = answers.get("medications", "").lower()

    scored = []
    for remedy in remedies:
        score = 0

        # Safety: skip unsafe remedies
        if is_pregnant and remedy.get("unsafe_pregnancy", False):
            continue
        if is_child and remedy.get("unsafe_children", False):
            continue

        # Direct symptom match
        remedy_symptoms = set(s.lower() for s in remedy["symptoms"])
        matches = symptom_set & remedy_symptoms
        score += len(matches) * 3

        # Category match
        remedy_tags = set(remedy.get("tags", []))
        cat_matches = active_categories & remedy_tags
        score += len(cat_matches) * 1

        if score == 0:
            continue

        # Preference boost
        if preferred_category and remedy["category"] == preferred_category:
            score += 2
        elif preferred_category and remedy["category"] != preferred_category:
            score -= 1

        # Severity boost for well-studied remedies
        severity = answers.get("severity", "")
        if "severe" in severity.lower():
            ev = remedy.get("evidence_level", "")
            if ev in ("strong", "moderate"):
                score += 1

        # Evidence boost
        ev = remedy.get("evidence_level", "traditional")
        if ev == "strong":
            score += 1

        remedy_copy = {**remedy}
        remedy_copy["score"] = score
        remedy_copy["matched_symptoms"] = list(matches)
        remedy_copy["amazon_url"] = f"https://www.amazon.com/s?k={remedy['amazon_query'].replace(' ', '+')}"

        # Flag medication interactions
        interactions = remedy.get("interactions", [])
        warnings = []
        for inter in interactions:
            if inter["med"].lower() in medications:
                warnings.append(inter["warning"])
        if warnings:
            remedy_copy["_interaction_warnings"] = warnings

        scored.append(remedy_copy)

    scored.sort(key=lambda x: x["score"], reverse=True)
    return scored[:15]
