"""
Remy Hippocampus — Consolidator
The 'sleep' process: runs at session end to score, encode, associate,
reconsolidate, and decay. Migrates important moments from working memory
to long-term episodic + semantic memory.
"""
import json
import logging
from datetime import datetime, timezone

from google import genai
from google.genai import types

from memory.working import WorkingMemory
from memory.semantic import SemanticMemory
from memory.episodic import EpisodicMemory
from memory.associations import AssociationGraph
from memory.significance import score_significance
from memory.embeddings import embed_text

log = logging.getLogger("remy.consolidator")


class Consolidator:
    """
    End-of-session processing — the hippocampal 'sleep' analog.
    Takes working memory and updates episodic, semantic, and associations.
    """

    def __init__(self, gemini_client: genai.Client):
        self.client = gemini_client

    def consolidate(self, working: WorkingMemory,
                    semantic: SemanticMemory,
                    episodic: EpisodicMemory,
                    associations: AssociationGraph) -> dict:
        """
        Full consolidation pipeline. Returns a summary dict of what happened.
        """
        transcript = working.get_full_transcript()
        if not transcript.strip():
            return {"status": "empty_session", "encoded": 0}

        summary = {
            "session_id": working.session_id,
            "turns": working.turn_count,
            "encoded": 0,
            "associations_created": 0,
            "associations_strengthened": 0,
            "memories_decayed": 0,
            "edges_decayed": 0,
        }

        # ── STEP 1: Score significance + extract entities ──
        scored = self._score_and_extract(transcript, working)

        # ── STEP 2: Encode significant moments into episodic memory ──
        for moment in scored:
            if moment.get("significance", 0) < 0.3:
                continue  # let this dissolve

            sig = moment["significance"]
            valence = moment.get("emotional_valence", 0.0)
            _, decay_rate = score_significance(
                moment["summary"], valence,
                prior_mention_count=0
            )

            trace = episodic.store(
                text=moment["summary"],
                significance=sig,
                emotional_valence=valence,
                decay_rate=decay_rate,
                entities=moment.get("entities", []),
                session_id=working.session_id,
            )
            summary["encoded"] += 1

            # Link to similar past memories
            similar = episodic.retrieve_by_embedding(
                trace["embedding"], top_k=3
            )
            linked = [m["id"] for m in similar
                      if m["id"] != trace["id"] and m.get("similarity", 0) > 0.5]
            trace["linked_to"] = linked

        # ── STEP 3: Update association graph ──
        assoc_result = self._extract_associations(
            scored, associations, working.session_id
        )
        summary["associations_created"] = assoc_result.get("created", 0)
        summary["associations_strengthened"] = assoc_result.get("strengthened", 0)

        # ── STEP 4: Reconsolidate semantic memory ──
        self._reconsolidate_profile(transcript, semantic, working.session_id)

        # ── STEP 5: Log the session ──
        topic = self._extract_session_topic(scored)
        semantic.add_coaching_log(
            session_id=working.session_id,
            topic=topic,
            insight=None,
            intervention=None,
            follow_up=None,
        )
        semantic.increment_session_count()

        # ── STEP 6: Decay old memories and weak associations ──
        summary["memories_decayed"] = episodic.decay_memories()
        summary["edges_decayed"] = associations.decay_associations()

        log.info(f"Consolidation complete: {summary}")
        return summary

    def _score_and_extract(self, transcript: str,
                           working: WorkingMemory) -> list[dict]:
        """
        Step 1: Score each exchange for significance and extract entities.
        Single Gemini call.
        """
        prompt = f"""Analyze this therapy/coaching session transcript.
For each patient message, provide:
1. significance: 0.0-1.0 (how important to remember long-term)
2. emotional_valence: -1.0 to +1.0 (-1 = distress, +1 = elation)
3. summary: one-sentence summary of the key information
4. entities: health-relevant entities mentioned (conditions, symptoms, behaviors, emotions, medications, interventions)

Scoring guide:
- 0.9-1.0: Medication changes, new diagnoses, allergies, corrections to known facts
- 0.7-0.9: Breakthroughs, goal changes, strong emotions, intervention outcomes
- 0.4-0.7: Lifestyle details, symptom updates, moderate emotional content
- 0.1-0.3: Context, preferences, minor observations
- 0.0-0.1: Greetings, small talk, filler

Session transcript:
{transcript}

Output ONLY valid JSON array, one entry per patient message:
[{{"turn": 1, "significance": 0.7, "emotional_valence": -0.5, "summary": "...", "entities": ["entity1", "entity2"]}}]
"""
        try:
            response = self.client.models.generate_content(
                model="gemini-2.0-flash",
                contents=prompt,
                config=types.GenerateContentConfig(
                    temperature=0.2,
                    max_output_tokens=2048,
                ),
            )
            text = response.text.strip()
            # Extract JSON from potential markdown wrapper
            if "```" in text:
                text = text.split("```")[1]
                if text.startswith("json"):
                    text = text[4:]
                text = text.strip()
            scored = json.loads(text)
            return scored if isinstance(scored, list) else []
        except Exception as e:
            log.error(f"Scoring failed: {e}")
            # Fallback: create basic entries from working memory
            fallback = []
            for ex in working.exchanges:
                sig, _ = score_significance(ex["user_msg"], ex["emotional_valence"])
                fallback.append({
                    "turn": ex["turn"],
                    "significance": sig,
                    "emotional_valence": ex["emotional_valence"],
                    "summary": ex["user_msg"][:200],
                    "entities": [],
                })
            return fallback

    def _extract_associations(self, scored: list[dict],
                              graph: AssociationGraph,
                              session_id: str) -> dict:
        """
        Step 3: Extract causal relationships between entities and
        add/strengthen edges in the association graph.
        """
        # Collect all entities from significant moments
        all_entities = set()
        for moment in scored:
            if moment.get("significance", 0) >= 0.3:
                for e in moment.get("entities", []):
                    all_entities.add(e)

        if len(all_entities) < 2:
            return {"created": 0, "strengthened": 0}

        entity_list = list(all_entities)
        existing_summary = graph.get_summary()

        prompt = f"""Given these health entities from a patient conversation:
{json.dumps(entity_list)}

And the existing association graph:
{existing_summary}

Identify causal or meaningful relationships between pairs.
Use these edge types ONLY: causes, worsens, treats, triggers, correlates, contradicts, replaces

Rules:
- Only link entities with genuine causal/clinical relationships
- Do NOT link entities that just happened to appear together
- Include directionality (upstream cause → downstream effect)
- Include confidence (0.0-1.0)

For each entity, also specify type: condition, symptom, behavior, emotion, intervention, medication, substance

Output ONLY valid JSON:
{{
  "entities": [{{"id": "entity_name", "type": "condition"}}],
  "edges": [{{"from": "entity_a", "to": "entity_b", "type": "causes", "confidence": 0.8}}]
}}
"""
        created = 0
        strengthened = 0

        try:
            response = self.client.models.generate_content(
                model="gemini-2.0-flash",
                contents=prompt,
                config=types.GenerateContentConfig(
                    temperature=0.2,
                    max_output_tokens=1024,
                ),
            )
            text = response.text.strip()
            if "```" in text:
                text = text.split("```")[1]
                if text.startswith("json"):
                    text = text[4:]
                text = text.strip()

            data = json.loads(text)

            # Register entities as nodes
            for ent in data.get("entities", []):
                graph.ensure_node(
                    ent["id"],
                    entity_type=ent.get("type", "unknown"),
                    label=ent["id"]
                )

            # Add/strengthen edges
            for edge_data in data.get("edges", []):
                existing = graph.find_edge(edge_data["from"], edge_data["to"])

                # Get average emotional charge from this session
                avg_emotion = 0.0
                for m in scored:
                    if m.get("significance", 0) >= 0.3:
                        avg_emotion += m.get("emotional_valence", 0)
                if scored:
                    avg_emotion /= len(scored)

                graph.add_or_strengthen(
                    from_entity=edge_data["from"],
                    to_entity=edge_data["to"],
                    edge_type=edge_data.get("type", "correlates"),
                    emotional_charge=avg_emotion,
                    evidence_id=session_id,
                )

                if existing is None:
                    created += 1
                else:
                    strengthened += 1

        except Exception as e:
            log.error(f"Association extraction failed: {e}")

        return {"created": created, "strengthened": strengthened}

    def _reconsolidate_profile(self, transcript: str,
                               semantic: SemanticMemory,
                               session_id: str):
        """
        Step 4: Update the patient profile with new information.
        Handles corrections — marks old facts as superseded.
        """
        current_profile = semantic.to_json()

        prompt = f"""You are updating a patient profile after a coaching session.

CURRENT PROFILE:
{current_profile}

TODAY'S SESSION TRANSCRIPT:
{transcript}

RULES:
1. Add any NEW information discovered.
2. If something CHANGED (medication stopped, condition improved, etc.),
   update the field AND add to corrections[].
3. Update open_loops[] — add new ones, remove resolved ones.
4. Update emotional_baseline if today revealed shifts.
5. Add any breakthroughs to breakthroughs[].
6. Do NOT delete information — mark corrections with date and reason.
7. Set meta.last_updated to current timestamp.
8. Keep all existing coaching_log entries unchanged.

Output the COMPLETE updated profile as valid JSON. Must match the existing structure exactly.
"""
        try:
            response = self.client.models.generate_content(
                model="gemini-2.0-flash",
                contents=prompt,
                config=types.GenerateContentConfig(
                    temperature=0.2,
                    max_output_tokens=4096,
                ),
            )
            text = response.text.strip()
            if "```" in text:
                text = text.split("```")[1]
                if text.startswith("json"):
                    text = text[4:]
                text = text.strip()

            updated = json.loads(text)
            semantic.update_from_json(updated)

        except Exception as e:
            log.error(f"Reconsolidation failed: {e}")
            # Don't corrupt profile on failure — leave it unchanged

    def _extract_session_topic(self, scored: list[dict]) -> str:
        """Extract the main topic of the session from scored moments."""
        if not scored:
            return "General check-in"

        # Find the most significant moment
        top = max(scored, key=lambda m: m.get("significance", 0))
        return top.get("summary", "General check-in")[:100]
