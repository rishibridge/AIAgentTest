"""
Remy Hippocampus — Memory Manager
Orchestrates all memory subsystems. Single entry point for the application.
Handles load, save, context assembly, and consolidation.
"""
import logging
from datetime import datetime, timezone

from google import genai
from google.genai import types as genai_types

from memory.working import WorkingMemory
from memory.semantic import SemanticMemory
from memory.episodic import EpisodicMemory
from memory.associations import AssociationGraph
from memory.consolidator import Consolidator
from memory.firestore_store import FirestoreStore
from memory.embeddings import embed_text, init_embedding_client

log = logging.getLogger("remy.memory")


class MemoryManager:
    """
    Orchestrates the full hippocampal memory system.
    One instance per active user session.
    """

    def __init__(self, user_id: str, session_id: str,
                 gemini_client: genai.Client,
                 store: FirestoreStore):
        self.user_id = user_id
        self.session_id = session_id
        self.client = gemini_client
        self.store = store

        # Initialize memory layers
        self.working = WorkingMemory(session_id)
        self.semantic = SemanticMemory()
        self.episodic = EpisodicMemory()
        self.associations = AssociationGraph()

        self.consolidator = Consolidator(gemini_client)
        self._loaded = False

    # ── Lifecycle ──────────────────────────────────────────

    def load(self):
        """
        Hydrate all memory from persistent storage.
        Called at session start.
        """
        if self._loaded:
            return

        data = self.store.load_user_memory(self.user_id)

        if data.get("semantic"):
            self.semantic = SemanticMemory.from_dict(data["semantic"])
            log.info(f"Loaded semantic memory: {self.semantic.profile['meta'].get('total_sessions', 0)} sessions")

        if data.get("episodic"):
            self.episodic = EpisodicMemory.from_dict(data["episodic"])
            log.info(f"Loaded episodic memory: {self.episodic.count()} memories")

        if data.get("associations"):
            self.associations = AssociationGraph.from_dict(data["associations"])
            log.info(f"Loaded associations: {self.associations.node_count()} nodes, {self.associations.edge_count()} edges")

        self.store.update_user_last_seen(self.user_id)
        self._loaded = True

    def save(self):
        """
        Persist all memory to storage.
        Called at session end after consolidation.
        """
        memory_data = {
            "semantic": self.semantic.to_dict(),
            "episodic": self.episodic.to_dict(),
            "associations": self.associations.to_dict(),
        }
        self.store.save_user_memory(self.user_id, memory_data)
        log.info(f"Saved memory for user {self.user_id}")

    # ── Turn Processing ────────────────────────────────────

    def add_exchange(self, user_msg: str, assistant_msg: str):
        """Process a conversational turn. Stores in working memory."""
        self.working.add_exchange(user_msg, assistant_msg)

    def get_history_for_gemini(self) -> list[dict]:
        """Get conversation history in Gemini-compatible format."""
        return self.working.get_history_for_gemini()

    # ── Context Assembly (the magic) ───────────────────────

    def get_context_for_prompt(self, current_message: str = None) -> str:
        """
        Assemble full hippocampal context for Gemini injection.
        Combines: semantic profile + episodic retrieval + association
        activation + temporal awareness.

        This is injected as a system-level context block before the
        conversation history, ensuring Remy never forgets.
        """
        parts = []

        # ── 1. Semantic Memory (always injected) ──
        profile_summary = self.semantic.get_summary()
        if profile_summary and "No patient information" not in profile_summary:
            parts.append(f"[PATIENT PROFILE — DO NOT RE-ASK]\n{profile_summary}")

        # ── 2. Temporal Context ──
        temporal = self._build_temporal_context()
        if temporal:
            parts.append(f"[TEMPORAL CONTEXT]\n{temporal}")

        # ── 3. Episodic Retrieval (if we have a current message) ──
        if current_message and self.episodic.count() > 0:
            try:
                similar = self.episodic.retrieve(current_message, top_k=3)
                if similar:
                    ep_parts = []
                    for mem in similar:
                        if mem.get("combined_score", 0) > 0.3:
                            days_ago = self._days_since(mem.get("timestamp"))
                            time_label = self._time_label(days_ago)
                            ep_parts.append(
                                f"  • ({time_label}, sig: {mem['significance']:.1f}) "
                                f"{mem['text']}"
                            )
                    if ep_parts:
                        parts.append(
                            "[RELATED PAST MOMENTS — use naturally, don't list]\n"
                            + "\n".join(ep_parts)
                        )
            except Exception as e:
                log.warning(f"Episodic retrieval failed: {e}")

        # ── 4. Association Activation ──
        if current_message and self.associations.edge_count() > 0:
            try:
                activated = self._activate_associations(current_message)
                if activated:
                    parts.append(
                        "[ACTIVE ASSOCIATIONS — known connections for this patient]\n"
                        + activated
                    )
            except Exception as e:
                log.warning(f"Association activation failed: {e}")

        # ── 5. Open Loops ──
        open_loops = self.semantic.profile.get("open_loops", [])
        if open_loops:
            parts.append(
                "[OPEN FOLLOW-UPS — check in on these naturally]\n"
                + "\n".join(f"  • {loop}" for loop in open_loops[:5])
            )

        if not parts:
            return ""

        header = (
            "[SYSTEM CONTEXT — DO NOT REPEAT THIS TO THE USER]\n"
            "The following is your complete memory of this patient. "
            "DO NOT re-ask any information listed here. "
            "Use it naturally in conversation.\n\n"
        )
        return header + "\n\n".join(parts)

    # ── Consolidation (Session End) ────────────────────────

    def consolidate_and_save(self) -> dict:
        """
        Full end-of-session processing: consolidate + save.
        The hippocampal 'sleep' — encode, associate, reconsolidate, decay.
        """
        if self.working.turn_count == 0:
            return {"status": "empty_session"}

        result = self.consolidator.consolidate(
            self.working, self.semantic, self.episodic, self.associations
        )

        self.save()
        return result

    # ── Greeting Builder ───────────────────────────────────

    def get_greeting_context(self) -> str:
        """
        Build context for Remy's opening greeting.
        This is used instead of the regular context on session start.
        """
        profile_summary = self.semantic.get_summary()
        temporal = self._build_temporal_context()
        total_sessions = self.semantic.profile["meta"].get("total_sessions", 0)

        if total_sessions == 0:
            return ""  # New user — use default greeting

        parts = [
            "[RETURNING PATIENT — greet with memory, don't re-introduce yourself]",
            f"This is session #{total_sessions + 1} with this patient.",
        ]

        if temporal:
            parts.append(f"Temporal context: {temporal}")

        if profile_summary and "No patient information" not in profile_summary:
            parts.append(f"Known patient info:\n{profile_summary}")

        # Recent breakthroughs
        breakthroughs = self.semantic.profile.get("breakthroughs", [])
        if breakthroughs:
            parts.append(f"Recent breakthroughs: {'; '.join(breakthroughs[-2:])}")

        # Open loops (things to follow up on)
        open_loops = self.semantic.profile.get("open_loops", [])
        if open_loops:
            parts.append(f"Open follow-ups to check on: {'; '.join(open_loops[:3])}")

        parts.append(
            "\nGreet them warmly with temporal awareness. Reference what you "
            "know from last session. Ask about open loops. Do NOT re-ask "
            "basic info (age, conditions, etc.) — you already have all of that."
        )

        return "\n".join(parts)

    # ── Internal Helpers ───────────────────────────────────

    def _build_temporal_context(self) -> str:
        """Build temporal awareness string."""
        coaching_log = self.semantic.profile.get("coaching_log", [])
        if not coaching_log:
            return ""

        last_session = coaching_log[-1]
        last_date_str = last_session.get("date", "")
        topic = last_session.get("topic", "general check-in")

        try:
            last_date = datetime.strptime(last_date_str, "%Y-%m-%d").replace(
                tzinfo=timezone.utc
            )
            days_ago = (datetime.now(timezone.utc) - last_date).days
            time_label = self._time_label(days_ago)
        except (ValueError, TypeError):
            time_label = "recently"

        return f"Last session was {time_label}. Topic: {topic}"

    def _time_label(self, days_ago: float) -> str:
        """Convert days-ago to human-readable label."""
        if days_ago is None or days_ago < 0:
            return "recently"
        days_ago = int(days_ago)
        if days_ago == 0:
            return "earlier today"
        elif days_ago == 1:
            return "yesterday"
        elif days_ago < 7:
            return f"{days_ago} days ago"
        elif days_ago < 14:
            return "about a week ago"
        elif days_ago < 30:
            return f"about {days_ago // 7} weeks ago"
        elif days_ago < 60:
            return "about a month ago"
        else:
            return f"about {days_ago // 30} months ago"

    def _days_since(self, timestamp_str: str) -> float:
        """Calculate days since a timestamp string."""
        if not timestamp_str:
            return 999
        try:
            ts = datetime.fromisoformat(timestamp_str.replace("Z", "+00:00"))
            return (datetime.now(timezone.utc) - ts).total_seconds() / 86400
        except (ValueError, TypeError):
            return 999

    def _activate_associations(self, message: str) -> str:
        """
        Find entities in the message that exist in the graph,
        then spread activation to get associated concepts.
        """
        text = message.lower()
        activated_all = []

        # Check which graph nodes are mentioned in the message
        for entity_id, node in self.associations.nodes.items():
            if entity_id.lower() in text or node.get("label", "").lower() in text:
                results = self.associations.activate(entity_id, depth=2)
                for ent, level, via in results:
                    if level > 0.15:
                        activated_all.append((ent, level, via, entity_id))

        if not activated_all:
            return ""

        # Deduplicate and sort by activation level
        seen = set()
        unique = []
        for ent, level, via, source in activated_all:
            if ent not in seen:
                seen.add(ent)
                unique.append((ent, level, via, source))
        unique.sort(key=lambda x: -x[1])

        lines = []
        for ent, level, via, source in unique[:8]:
            lines.append(f"  {source} ──{via}──→ {ent} (strength: {level:.2f})")

        return "\n".join(lines)

    def is_returning_user(self) -> bool:
        """Check if this user has had previous sessions."""
        return self.semantic.profile["meta"].get("total_sessions", 0) > 0
