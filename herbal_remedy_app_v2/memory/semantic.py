"""
Remy Hippocampus — Semantic Memory
The consolidated patient profile — facts extracted, verified, and organized.
This is what survives across sessions. Updated via reconsolidation.
"""
from datetime import datetime, timezone
import json
import copy


# Default empty profile template
_EMPTY_PROFILE = {
    "identity": {
        "name": None,
        "age": None,
        "sex": None,
        "location": None,
    },
    "health": {
        "conditions": [],       # [{name, severity, since, medications, notes, status}]
        "medications": [],      # [{name, dose, started, purpose, status, ended, end_reason}]
        "supplements": [],      # [{name, dose, started, reason_prescribed}]
        "allergies": [],        # [str]
        "lab_results": [],      # [{test, value, date, trend}]
    },
    "lifestyle": {
        "sleep": {"pattern": None, "quality_trend": None, "interventions_tried": []},
        "movement": {"level": None, "barriers": [], "interventions_tried": []},
        "nutrition": {"pattern": None, "restrictions": [], "interventions_tried": []},
        "digital": {"phone_relationship": None, "screen_time": None, "interventions_tried": []},
        "social": {"connection_level": None, "tribe_status": None},
        "stressors": [],        # [{source, severity, duration}]
    },
    "goals": [],                # [{description, set_date, progress, status}]
    "coaching_log": [],         # [{date, session_id, topic, insight, intervention, follow_up}]
    "emotional_baseline": {
        "current_mood_trend": None,
        "energy_trend": None,
        "anxiety_trend": None,
    },
    "breakthroughs": [],        # ["description (date)"]
    "open_loops": [],           # ["description"]
    "corrections": [],          # [{date, field, old_value, new_value, reason, source_session}]
    "meta": {
        "created_at": None,
        "last_updated": None,
        "total_sessions": 0,
    },
}


class SemanticMemory:
    """
    The patient profile — consolidated facts that persist across sessions.
    Updated through reconsolidation at session end.
    """

    def __init__(self, profile: dict = None):
        if profile:
            self.profile = profile
        else:
            self.profile = copy.deepcopy(_EMPTY_PROFILE)
            self.profile["meta"]["created_at"] = datetime.now(timezone.utc).isoformat()

    def get_summary(self) -> str:
        """
        Format the profile as a readable text summary for prompt injection.
        Only includes fields that have actual data.
        """
        p = self.profile
        parts = []

        # Identity
        identity_parts = []
        if p["identity"]["age"]:
            identity_parts.append(f"{p['identity']['age']}-year-old")
        if p["identity"]["sex"]:
            identity_parts.append(p["identity"]["sex"])
        if p["identity"]["name"]:
            identity_parts.append(f"(name: {p['identity']['name']})")
        if identity_parts:
            parts.append("Patient: " + " ".join(identity_parts))

        # Conditions
        conditions = p["health"]["conditions"]
        active = [c for c in conditions if c.get("status", "active") == "active"]
        if active:
            cond_str = ", ".join(c["name"] for c in active)
            parts.append(f"Active conditions: {cond_str}")

        # Medications
        meds = p["health"]["medications"]
        active_meds = [m for m in meds if m.get("status", "active") == "active"]
        discontinued = [m for m in meds if m.get("status") == "DISCONTINUED"]
        if active_meds:
            med_str = ", ".join(f"{m['name']} ({m.get('dose', '?')})" for m in active_meds)
            parts.append(f"Current medications: {med_str}")
        if discontinued:
            disc_str = ", ".join(f"{m['name']} (stopped: {m.get('end_reason', '?')})" for m in discontinued)
            parts.append(f"Discontinued medications: {disc_str}")

        # Supplements
        supps = p["health"]["supplements"]
        if supps:
            supp_str = ", ".join(s["name"] for s in supps)
            parts.append(f"Supplements: {supp_str}")

        # Allergies
        if p["health"]["allergies"]:
            parts.append(f"⚠️ Allergies: {', '.join(p['health']['allergies'])}")

        # Lifestyle
        ls = p["lifestyle"]
        if ls["sleep"]["pattern"]:
            parts.append(f"Sleep: {ls['sleep']['pattern']}")
        if ls["movement"]["level"]:
            parts.append(f"Movement: {ls['movement']['level']}")
        if ls["stressors"]:
            stress_str = ", ".join(s["source"] for s in ls["stressors"])
            parts.append(f"Stressors: {stress_str}")

        # Goals
        active_goals = [g for g in p["goals"] if g.get("status") != "completed"]
        if active_goals:
            goal_str = "; ".join(g["description"] for g in active_goals)
            parts.append(f"Goals: {goal_str}")

        # Open loops
        if p["open_loops"]:
            parts.append(f"Open follow-ups: {'; '.join(p['open_loops'])}")

        # Breakthroughs
        if p["breakthroughs"]:
            parts.append(f"Breakthroughs: {'; '.join(p['breakthroughs'][-3:])}")

        # Emotional baseline
        eb = p["emotional_baseline"]
        mood_parts = []
        if eb["current_mood_trend"]:
            mood_parts.append(f"mood: {eb['current_mood_trend']}")
        if eb["energy_trend"]:
            mood_parts.append(f"energy: {eb['energy_trend']}")
        if eb["anxiety_trend"]:
            mood_parts.append(f"anxiety: {eb['anxiety_trend']}")
        if mood_parts:
            parts.append(f"Emotional baseline: {', '.join(mood_parts)}")

        # Recent coaching
        recent_logs = p["coaching_log"][-3:]
        if recent_logs:
            log_parts = []
            for log in recent_logs:
                log_parts.append(f"  - {log.get('date', '?')}: {log.get('topic', '?')}")
            parts.append("Recent sessions:\n" + "\n".join(log_parts))

        # Session count
        if p["meta"]["total_sessions"] > 0:
            parts.append(f"Total sessions: {p['meta']['total_sessions']}")

        if not parts:
            return "No patient information recorded yet."

        return "\n".join(f"• {part}" for part in parts)

    def update_from_json(self, updated_profile: dict):
        """
        Replace current profile with reconsolidated version.
        Preserves meta and corrections history.
        """
        # Preserve existing corrections — append new ones
        existing_corrections = self.profile.get("corrections", [])
        new_corrections = updated_profile.get("corrections", [])

        # Merge corrections (avoid duplicates by date+field)
        existing_keys = {(c["date"], c["field"]) for c in existing_corrections}
        for nc in new_corrections:
            key = (nc.get("date"), nc.get("field"))
            if key not in existing_keys:
                existing_corrections.append(nc)

        # Update profile
        self.profile = updated_profile
        self.profile["corrections"] = existing_corrections
        self.profile["meta"]["last_updated"] = datetime.now(timezone.utc).isoformat()

    def increment_session_count(self):
        """Bump the total session counter."""
        self.profile["meta"]["total_sessions"] += 1

    def add_coaching_log(self, session_id: str, topic: str, 
                         insight: str = None, intervention: str = None,
                         follow_up: str = None):
        """Log a coaching session summary."""
        self.profile["coaching_log"].append({
            "date": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
            "session_id": session_id,
            "topic": topic,
            "insight": insight,
            "intervention": intervention,
            "follow_up_needed": follow_up,
        })
        # Keep last 50 sessions
        if len(self.profile["coaching_log"]) > 50:
            self.profile["coaching_log"] = self.profile["coaching_log"][-50:]

    def to_dict(self) -> dict:
        """Serialize for Firestore."""
        return copy.deepcopy(self.profile)

    @classmethod
    def from_dict(cls, data: dict) -> "SemanticMemory":
        """Hydrate from Firestore."""
        return cls(profile=data)

    def to_json(self) -> str:
        """JSON string for LLM prompts."""
        return json.dumps(self.profile, indent=2, default=str)
