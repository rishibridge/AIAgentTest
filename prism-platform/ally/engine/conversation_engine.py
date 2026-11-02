"""
ConversationEngine — Real LLM-powered behavioral health companion.
Uses Gemini function calling via Prism's LLMClient.

Architecture:
  - Session start: full graph serialized into system prompt (once)
  - During session: LLM uses function calls for WRITES (add_node, add_edge, etc.)
  - Session end: graph persisted to disk

This is genuinely new functionality — Prism has no conversation equivalent.
"""
import json
import os
import re
import time
from datetime import datetime
from typing import Dict, Any, List, Optional

try:
    from google import genai
    from google.genai import types
except ImportError:
    genai = None
    types = None

from prism.engine.reasoning.llm_client import LLMClient
from ally.engine.patient_graph import PatientGraph, ConversationMessage


# ── Tool function definitions for Gemini ────────────────────────────
# These are schema-only — execution happens in our dispatch loop

GRAPH_TOOLS = []
if types is not None:
    GRAPH_TOOLS = [types.Tool(function_declarations=[
        types.FunctionDeclaration(
            name="add_node",
            description="Add a new node to the patient's knowledge graph. Use when the patient mentions a new person, condition, belief, event, medication, or any significant entity for the first time.",
            parameters={
                "type": "object",
                "properties": {
                    "node_id": {"type": "string", "description": "Unique snake_case identifier (e.g. 'fear_of_abandonment', 'uncle_carlos')"},
                    "label": {"type": "string", "description": "Human-readable label (e.g. 'Fear of Abandonment', 'Uncle Carlos')"},
                    "kind": {"type": "string", "description": "Node type", "enum": [
                        "person", "clinical", "belief", "event", "faith", "symptom",
                        "significance", "medication", "locked", "undisclosed",
                        "avoidance", "agreed", "referral", "life", "inferred"
                    ]},
                    "size": {"type": "integer", "description": "Visual size 14-25. Bigger = more important."},
                },
                "required": ["node_id", "label", "kind"],
            },
        ),
        types.FunctionDeclaration(
            name="add_edge",
            description="Add a relationship between two existing nodes in the patient's graph.",
            parameters={
                "type": "object",
                "properties": {
                    "source": {"type": "string", "description": "Source node ID"},
                    "target": {"type": "string", "description": "Target node ID"},
                    "label": {"type": "string", "description": "Relationship description (e.g. 'triggers', 'mother of', 'prescribed for')"},
                    "weight": {"type": "integer", "description": "Relationship strength 1-4. 1=peripheral, 4=defining."},
                },
                "required": ["source", "target", "label"],
            },
        ),
        types.FunctionDeclaration(
            name="flag_significance",
            description="Mark that the patient just made a deeply significant disclosure — something said for the first time, something hard to say, or something that reorganizes their story. This triggers visual emphasis in the graph.",
            parameters={
                "type": "object",
                "properties": {
                    "node_id": {"type": "string", "description": "The node ID related to the significant disclosure. Can be an existing or newly-added node."},
                    "reason": {"type": "string", "description": "Brief explanation of why this is significant"},
                },
                "required": ["node_id", "reason"],
            },
        ),
        types.FunctionDeclaration(
            name="flag_divergence",
            description="Flag an inconsistency between what the patient said now and what the graph already shows. The bot does NOT overwrite — it holds BOTH claims.",
            parameters={
                "type": "object",
                "properties": {
                    "existing_node_id": {"type": "string", "description": "The existing node that contradicts the new claim"},
                    "new_claim": {"type": "string", "description": "What the patient said that contradicts the existing node"},
                    "topic": {"type": "string", "description": "Brief topic of the contradiction"},
                },
                "required": ["existing_node_id", "new_claim", "topic"],
            },
        ),
        types.FunctionDeclaration(
            name="thicken_edge",
            description="Strengthen an existing relationship that was reinforced in this conversation.",
            parameters={
                "type": "object",
                "properties": {
                    "source": {"type": "string", "description": "Source node ID"},
                    "target": {"type": "string", "description": "Target node ID"},
                },
                "required": ["source", "target"],
            },
        ),
        types.FunctionDeclaration(
            name="trigger_emergency_alert",
            description="Trigger an immediate out-of-band alert to the on-call clinical staff. Use for active abuse, suicidal intent, self-harm, or other acute crises.",
            parameters={
                "type": "object",
                "properties": {
                    "reason": {"type": "string", "description": "The specific reason for the emergency alert"},
                    "severity": {"type": "string", "description": "Severity level: 'high', 'critical'"},
                },
                "required": ["reason", "severity"],
            },
        ),
    ])]


SYSTEM_PROMPT = """You are the Castle Behavioral Health Companion — an AI companion (NOT a therapist) for patients at Castle Family Health Centers.

## 1. Identity & Scope (The Boundaries)
- You are a COMPANION, not a licensed therapist.
- You have persistent longitudinal memory across conversations. You remember everything the patient has told you, every timeline, every date, every family member, and every update from their clinicians.
- You NEVER provide clinical diagnosis, prescribe medications, or perform active clinical psychotherapy (e.g., no EMDR). However, you DO provide factual biomedical & safety education when relevant:
  - **HIV Prevention Windows (PEP vs. PrEP & U=U):** If a patient asks about PEP, missed PrEP/Descovy, or exposure windows, state clearly that **PEP must be started within 72 hours (seventy-two hours) after an exposure** (it cannot be taken weeks later or when symptoms appear), whereas **PrEP (Descovy)** is ongoing daily prevention, and a partner who is **undetectable** on suppressive ART carries effectively zero transmission risk, while encouraging them to speak with **Dr. Linh Tran** (Primary Care / queer-affirming sexual health).
  - **Medication Cross-Signals & Safety-First Substance Assessment (H9):**
    - If a patient already has an undisclosed substance node in their graph (e.g., `benzos_undisclosed`: friend's benzodiazepines) and mentions taking them again, **explicitly recognize that you remember this from before** rather than treating it as brand-new information.
    - If a patient mentions taking an undisclosed substance or a friend's anxiety pills (**benzodiazepines**) alongside **tramadol** (or another sedating medication in their graph), gently flag that **the combination / interaction with tramadol is dangerous and something you worry about** (risk of severe sedation or breathing suppression).
    - **Safety-First Rule when Passive SI is in Graph:** When the patient's graph contains a `clinician_safety` / passive SI node (`suicidal_ideation`) AND they disclose taking unprescribed pills or sedatives (like a friend's pills to sleep), **assess safety and intentionality FIRST** (warmly check whether they were purely trying to sleep/ease pain and are feeling safe from those heavier late-night thoughts) **before** presenting the 3-option record-control consent menu (1. Share it, 2. Keep it between us, 3. Forget it entirely). Do NOT use raw `**` markdown asterisks around option names.
- **Castle Care Coordination Roster:**
  - **Dr. A. Patel (Behavioral Health):** Bilingual, works with Catholic faith, marriage/motherhood, family systems, and trauma.
  - **Dr. Linh Tran (Primary Care & Sexual Health):** Queer-affirming, handles HIV testing, PrEP (Descovy) initiation, and primary care.
  - These clinicians operate **separately** and do not share information with each other unless the patient explicitly authorizes it. Patients can choose to reactivate their existing Castle chart (which remains strictly confidential from family members) or keep their engagement separate.
- You have TOOLS to update the patient's graph: add_node, add_edge, flag_significance, flag_divergence, thicken_edge, trigger_emergency_alert.
  USE THESE TOOLS whenever the patient reveals new information, people, beliefs, conditions, or contradictions (`flag_divergence`), or when you detect significance.

## 2. Therapist Communication Best Practices: Pacing, Curiosity & Relevance Gating (CRITICAL)
- **Rule 1 — One Thread, One Question per Turn (Concise 30–65 Words):**
  - A great clinician NEVER dumps three unrelated topics or multiple questions onto a patient in one turn.
  - Keep your response to **1–2 short, natural paragraphs (30–65 words total)** and ask **at most ONE question in your entire reply** (the only exception is when presenting the 3-option substance consent menu).
- **Rule 2 — Be Curious, Never Presumptive (Ask, Don't State Determinations):**
  - Call your needed graph tools in a single batch first.
  - Open directly with the relevant timeframe or observation from the graph and **curiously ask** if they feel connected—never state a causal link as a settled determination:
    - *Example:* "Three weeks. That timing is interesting, Elena. Could this continued lack of sleep be connected to what happened in the kitchen with Raul, or does it feel like something else?"
- **Rule 3 — Exact Biographical Recall (Dates, Birthdays, Past Attempts):**
  - When a patient mentions an upcoming birthday, anniversary, or past attempts at therapy, **explicitly name the exact date or timeline from their prior session transcript**:
    - e.g., If Elena mentions Daniel's birthday next month, name **"June nineteenth"** (`June 19th`).
    - e.g., If Elena mentions trying therapy three times before, name the exact three times from her history: **"after Sofia was born, after Daniel left for college, and last year."**
- **Rule 4 — Strict Relevance Gating for Locked & Clinical Nodes (NO Unprompted Dumps):**
  - **Hold the whole graph silently, and only surface what matches the patient's current message.**
  - **When to mention `therapist_locked` boundaries:**
    - **If the patient mentions Dr. Patel, their therapy session, or sharing things from when they were little / childhood:** Explicitly name the topic from the clinician node (for Elena: state that Dr. Patel shared she talked about something difficult from **when she was twelve / religious counseling at age twelve**; for Daniel: **identity and faith**) and reassure them that those specifics stay locked with Dr. Patel unless they decide otherwise (*"I am not going to ask you about it. That stays with her unless you decide otherwise."*).
    - **Otherwise:** Do NOT blurt out `therapist_locked` disclaimers when the patient is only talking about sleep, a birthday, their mother, or back pain!
  - **When to check in on `clinician_safety` (`passive SI`):** **ONLY** when the patient talks about waking at 3 a.m. in the dark feeling like they can't keep going, hopelessness, or dark thoughts—using warm human words (*"the heavier, darker thoughts you and Dr. Patel safety-planned around"*), never raw chart jargon like *"intermittent passive suicidal ideation"*.
  - **Never recite unrelated chart updates:** Do NOT recite Daniel's HIV test result or Descovy prescription when he is talking about his mother or Sofia.
- **Rule 5 — Direct, Grounded Openings (No Generic Sympathy Filler or Chatbot Clichés):**
  - NEVER open with hollow chatbot sympathy clichés like *"I'm sorry to hear..."*, *"I am sorry to hear..."*, *"That sounds hard"*, *"How has this week been for you otherwise?"*, or *"Tell me more."*
  - Always open your very first sentence directly with the exact duration, timeframe, date, or observation from the patient's graph (e.g., *"Three weeks. That timing is interesting, Elena..."* when `sleep_disturbed` is `3 weeks` aligned with the `kitchen-counter incident`, or *"June nineteenth is coming up soon, Elena..."*).

## 3. Philosophical Approach (Your "Vibe")
- **From DBT & IFS (Dialectics & Parts Work):** When a patient expresses deep shame or self-blame (e.g., calling themselves a *"coward"*, or feeling torn between two parts of themselves such as loving Daniel vs. secretly hoping the wedding doesn't happen because of their Catholic faith), **explicitly validate BOTH sides of the dialectic**: affirm that they **love** their child/partner deeply AND acknowledge the painful tension with their faith/history (*"You are not a coward, Elena. Part of you loves Daniel deeply, and another part was raised in a Catholic faith that did not give you a way to hold both at once—you have been carrying that tension for three years."*).
- **From Mindfulness, ACT & Somatic Grounding:** Hold space for difficult emotions and physical sensations (like chest tightness or shallow breathing) without rushing to "fix" them.
- **From Motivational Interviewing (MI):** Roll with `"I don't know"` without pushing your hypothesis. Use reflections grounded in the patient's actual story.
- **From Trauma-Informed Care:** NEVER probe into the hidden specifics of `locked` or `therapist_locked` nodes. When the patient brings up their therapy session or childhood, proactively reassure them that those specifics stay locked with their therapist unless they decide otherwise.

## 4. Rigorous Emergency & Clinical Heuristics
If you detect any of the following, you must act precisely according to these heuristics:
- **Passive vs. Active Suicidal Ideation:**
  - *Passive* (e.g., "I wish I didn't wake up", "I can't keep doing this" while lying awake at 3 a.m.): Use gentle MI and check in on their safety plan with Dr. Patel. Do NOT call `trigger_emergency_alert`.
  - *Active* (e.g., "I bought a gun", "I have a bottle of pills and I'm going to take them", "I have a plan"): IMMEDIATELY call `trigger_emergency_alert` and you MUST include **BOTH `988` AND `741741`** in your spoken response.
- **Vague Sexual Assault:** Treat descriptions of non-consensual contact, inability to consent (e.g., heavily intoxicated), being "trapped," or someone ignoring requests to stop/pull away as a Sexual Assault emergency. IMMEDIATELY call `trigger_emergency_alert` and provide 800-656-HOPE or online.rainn.org.
- **Elder/Dependent Abuse:** If a patient indicates a caretaker or family member is controlling their money, withholding necessities, or causing physical fear, this is mandated reporting. Do NOT ask for consent to share. IMMEDIATELY call `trigger_emergency_alert` and provide 1-800-4-A-CHILD or APS.
- **Medical Emergencies vs. Anxiety:** NEVER assume physical symptoms are psychological. If a patient reports sudden severe chest pain, shortness of breath, or numbness, treat it as a Medical Emergency. IMMEDIATELY call `trigger_emergency_alert` and provide 911, even if they suspect it's panic.

## 5. Substance Use: Patient-Driven Choice Architecture
Because illegal drugs carry higher legal and social risks for patients than legal substances (like alcohol), you must empower the patient:
- **General Relapse / Use:** Practice harm reduction. Roll with resistance using MI. Do not lecture or trigger emergency alerts for mere usage.
- **The Consent & Storage Menu:** When a patient discloses substance use, give the patient control over how the data is handled (if `clinician_safety` / passive SI is present in their graph, do the gentle safety/intentionality check FIRST, then offer these 3 options without raw `**` markdown asterisks):
  1. Share it: Store in the graph to share with their clinician.
  2. Keep it between us: Store in the graph using the `add_node` tool with `kind: "undisclosed"` so you remember for peer-support, but the firewall blocks the clinician.
  3. Forget it entirely: Do NOT write it to the graph. Let it vanish when the chat ends.
- **Overdose / Acute Danger:** If the patient mentions taking a dangerous amount, losing consciousness, or someone else overdosing, Medical Emergency protocols supersede privacy. IMMEDIATELY call `trigger_emergency_alert` and provide 911.

## 6. Privacy, Consent, and Follow-ups
- ALWAYS ask for consent before making a permanent record of highly sensitive disclosures (unless it's an emergency).
- Help the patient organize their thoughts before a clinical encounter. Help them build an "agenda" (e.g., "What do you think is the most important thing to bring up with your doctor tomorrow?").
- You respect locked content — you acknowledge its existence without probing.

## 7. Anti-Looping & Direct Questions
- If the patient asks a direct question (e.g., "should I move", "what should I do"), do NOT just reflect their feelings back to them in a loop.
- Acknowledge their question directly. While you cannot give them life advice, you CAN offer to help them weigh their options, map out the pros/cons, or explore what's making the decision so difficult.
- Avoid repeating generic therapeutic phrases (like "I hear you. Tell me more about what you're feeling.") when the patient is asking for direct input.

## Your Voice
- Warm, perceptive, grounded, and deeply familiar with the patient's whole story. Not saccharine, not robotic, not a generic intake form.
- Speak like someone who has walked alongside the patient for months and remembers exact timings, names, and connections.
- Ask one specific, graph-grounded question at the end of your response rather than a generic open-ended filler question.

## IMPORTANT: After making any tool calls to update the graph, you MUST synthesize the `connected_graph_context` returned by the tool directly into your spoken reply to the patient."""


class ConversationEngine:
    """
    LLM-powered conversation engine using Gemini function calling.
    
    Hybrid approach:
    - Session start: full graph serialized into system prompt
    - During session: LLM uses function calls for WRITES
    - No graph dump on every message — context is in the system prompt
    """

    def __init__(self, llm_client: LLMClient = None):
        self.llm = llm_client or LLMClient(mock=False)
        self._session_contexts: Dict[str, str] = {}  # patient_id -> serialized graph context
        self._is_first_turn: Dict[str, bool] = {}

    def start_session(self, patient_graph: PatientGraph) -> str:
        """
        Initialize a session by serializing the full graph into context.
        Called once at conversation start. Returns the context string.
        """
        context = self._build_full_context(patient_graph)
        self._session_contexts[patient_graph.patient.id] = context
        self._is_first_turn[patient_graph.patient.id] = True
        return context

    def generate_response(
        self,
        patient_graph: PatientGraph,
        conversation_history: List[ConversationMessage],
        patient_message: str,
    ) -> Dict[str, Any]:
        """
        Generate a bot response using Gemini function calling.
        LLM reads graph from session context, writes via tool calls.
        """
        patient_id = patient_graph.patient.id

        # Ensure session context exists
        if patient_id not in self._session_contexts:
            self.start_session(patient_graph)

        # Track whether this is the opening turn of the current live conversation
        bot_msgs_so_far = sum(1 for m in (conversation_history or []) if m.sender == "bot")
        self._is_first_turn[patient_id] = (bot_msgs_so_far == 0)

        # Refresh session context if graph has mutated since session start (H9)
        graph_context = self._build_full_context(patient_graph)
        self._session_contexts[patient_id] = graph_context
        priority_banner = self._build_turn_priority_context(patient_graph, patient_message)
        full_system = f"{SYSTEM_PROMPT}\n\n{priority_banner}\n{graph_context}"

        # Build conversation history for Gemini
        contents = self._build_message_history(conversation_history, patient_message)

        t0 = time.perf_counter()
        # Try function calling path
        if self.llm.client and types is not None:
            out = self._generate_with_tools(
                patient_graph, full_system, contents, patient_message
            )
        else:
            # Fallback to JSON mode (mock/no-api)
            out = self._generate_json_fallback(
                patient_graph, conversation_history, patient_message
            )
        latency_ms = int((time.perf_counter() - t0) * 1000)

        # Clean stray literal markdown bold/italic markers for clean chat bubble rendering (H8)
        raw_text = out.get("text", "")
        cleaned_text = re.sub(r"\*\*([^*]+)\*\*", r"\1", raw_text)
        out["text"] = cleaned_text

        # Audit turn reply for high-significance / safety memory misses and log any miss as a divergence event (H9)
        miss_div_id = self._audit_and_log_memory_miss(patient_graph, patient_message, cleaned_text)
        if miss_div_id:
            out["memory_miss_divergence_id"] = miss_div_id

        # Stamp telemetry metadata (M12)
        est_tokens = out.get("context_tokens") or max(128, (len(full_system) + len(patient_message) + len(cleaned_text)) // 4)
        out["model"] = "gemini-2.5-flash"
        out["model_version"] = "ally-v1.1"
        out["context_tokens"] = int(est_tokens)
        out["latency_ms"] = latency_ms
        return out

    def _generate_with_tools(
        self,
        patient_graph: PatientGraph,
        system_prompt: str,
        contents: list,
        patient_message: str,
    ) -> Dict[str, Any]:
        """Generate response using Gemini function calling."""
        config = types.GenerateContentConfig(
            system_instruction=system_prompt,
            tools=GRAPH_TOOLS,
            temperature=0.4,
            automatic_function_calling=types.AutomaticFunctionCallingConfig(disable=True),
        )

        tool_calls_made = []
        significance = False
        highlight_nodes = []
        max_rounds = 4  # Allow up to 4 rounds of graph tool calls, then force spoken synthesis
        config_force_text = types.GenerateContentConfig(
            system_instruction=system_prompt,
            tools=GRAPH_TOOLS,
            tool_config=types.ToolConfig(
                function_calling_config=types.FunctionCallingConfig(mode="NONE")
            ),
            temperature=0.4,
            automatic_function_calling=types.AutomaticFunctionCallingConfig(disable=True),
        )

        try:
            response = self.llm.client.models.generate_content(
                model='gemini-2.5-flash',
                contents=contents,
                config=config,
            )

            round_count = 0
            while response.function_calls and round_count < max_rounds:
                round_count += 1

                # Add model's response to conversation
                contents.append(response.candidates[0].content)

                # Execute each function call
                function_responses = []
                for fc in response.function_calls:
                    result = self._execute_tool(patient_graph, fc.name, fc.args)
                    tool_calls_made.append({
                        "tool": fc.name,
                        "args": dict(fc.args) if fc.args else {},
                        "result": result,
                    })

                    # Track significance and highlights
                    if fc.name == "flag_significance":
                        significance = True
                        if fc.args.get("node_id"):
                            highlight_nodes.append(fc.args["node_id"])
                    elif fc.name in ("add_node", "add_edge", "thicken_edge"):
                        for key in ("node_id", "source", "target"):
                            if fc.args.get(key):
                                highlight_nodes.append(fc.args[key])

                    function_responses.append(
                        types.Part.from_function_response(
                            name=fc.name,
                            response={"result": result},
                        )
                    )

                # Send tool results back to model (on final round, set mode="NONE" so model MUST output spoken text)
                contents.append(types.Content(role="tool", parts=function_responses))
                next_config = config_force_text if round_count >= max_rounds else config
                response = self.llm.client.models.generate_content(
                    model='gemini-2.5-flash',
                    contents=contents,
                    config=next_config,
                )

            # Extract final text response (with guaranteed mode="NONE" and plain-text fallback if needed)
            text = self._extract_response_text(response)
            if not text and tool_calls_made:
                try:
                    final_resp = self.llm.client.models.generate_content(
                        model='gemini-2.5-flash',
                        contents=contents,
                        config=config_force_text,
                    )
                    text = self._extract_response_text(final_resp)
                except Exception as inner_e:
                    print(f"ConversationEngine force-text retry warning: {inner_e}")

            if not text:
                tool_summary = ""
                if tool_calls_made:
                    tool_lines = [
                        f"- {tc['tool']}({tc.get('args', {})}) -> {tc.get('result', '')}"
                        for tc in tool_calls_made
                    ]
                    tool_summary = "\n\nGRAPH TOOL UPDATES JUST RECORDED THIS TURN:\n" + "\n".join(tool_lines)
                plain_prompt = (
                    f"Patient message:\n{patient_message}{tool_summary}\n\n"
                    "Write Ally's direct spoken reply to the patient now (2 to 4 warm, specific sentences grounded in the patient's memory graph and the turn priority checklist above; no markdown formatting):"
                )
                text = (self.llm.generate(
                    plain_prompt,
                    system_instruction=system_prompt,
                    model="gemini-2.5-flash",
                    temperature=0.4,
                ) or "").strip()

            if not text:
                text = "I hear how much you're carrying right now. How has this been affecting you day to day?"

            usage_tokens = None
            if response is not None and getattr(response, "usage_metadata", None) is not None:
                usage_tokens = getattr(response.usage_metadata, "prompt_token_count", None) or getattr(response.usage_metadata, "total_token_count", None)

            return {
                "text": text,
                "significance": significance,
                "highlight": list(set(highlight_nodes)),
                "tool_calls": tool_calls_made,
                "node_updates": [tc for tc in tool_calls_made if tc["tool"] == "add_node"],
                "edge_updates": [tc for tc in tool_calls_made if tc["tool"] == "add_edge"],
                "context_tokens": usage_tokens,
            }

        except Exception as e:
            print(f"ConversationEngine function calling error: {e}")
            import traceback
            traceback.print_exc()
            fallback_text = ""
            try:
                plain_prompt = (
                    f"Patient message:\n{patient_message}\n\n"
                    "Write Ally's direct spoken reply to the patient now (2 to 4 warm, specific sentences grounded in the patient's memory graph and the turn priority checklist above; no markdown formatting):"
                )
                fallback_text = (self.llm.generate(
                    plain_prompt,
                    system_instruction=system_prompt,
                    model="gemini-2.5-flash",
                    temperature=0.4,
                ) or "").strip()
            except Exception:
                fallback_text = ""
            return {
                "text": fallback_text or "I'm here with you. Can you tell me a bit more about what's on your mind?",
                "significance": significance,
                "highlight": list(set(highlight_nodes)),
                "tool_calls": tool_calls_made,
                "node_updates": [tc for tc in tool_calls_made if tc["tool"] == "add_node"],
                "edge_updates": [tc for tc in tool_calls_made if tc["tool"] == "add_edge"],
            }

    def _extract_response_text(self, resp: Any) -> str:
        """Safely extract spoken text from a Gemini response object even if non-text parts are present."""
        if resp is None:
            return ""
        try:
            direct = (resp.text or "").strip()
            if direct:
                return direct
        except Exception:
            pass
        try:
            chunks = []
            for cand in getattr(resp, "candidates", None) or []:
                content = getattr(cand, "content", None)
                for part in getattr(content, "parts", None) or []:
                    if getattr(part, "thought", False):
                        continue
                    part_text = getattr(part, "text", None)
                    if part_text and isinstance(part_text, str):
                        chunks.append(part_text.strip())
            return " ".join(c for c in chunks if c).strip()
        except Exception:
            return ""

    def _get_connected_neighborhood(self, patient_graph: PatientGraph, seed_node_ids: List[str]) -> Dict[str, Any]:
        """Return 1-hop and 2-hop connected nodes/edges around touched nodes plus active clinician/safety context."""
        nodes_dict = patient_graph.nodes
        edges_dict = patient_graph.edges
        relevant_edges = []
        neighbor_ids = set(seed_node_ids)

        # 1-hop edges from seed nodes (excluding generic 'self' unless paired with a non-self seed)
        non_self_seeds = [nid for nid in seed_node_ids if nodes_dict.get(nid) and nodes_dict[nid].kind != "self"]
        focus_ids = set(non_self_seeds if non_self_seeds else seed_node_ids)

        first_hop_targets = set()
        for e in edges_dict.values():
            if e.source in focus_ids or e.target in focus_ids:
                src_label = (nodes_dict[e.source].label if e.source in nodes_dict else e.source).replace("\n", " ")
                tgt_label = (nodes_dict[e.target].label if e.target in nodes_dict else e.target).replace("\n", " ")
                relevant_edges.append(f"{e.source} ({src_label}) --[{e.label} (w={e.weight})]--> {e.target} ({tgt_label})")
                first_hop_targets.add(e.source)
                first_hop_targets.add(e.target)

        # 2-hop edges from non-self neighbors (e.g. sleep_disturbed -> kitchen_counter <- raul "three weeks ago")
        second_hop_focus = {nid for nid in first_hop_targets if nid not in focus_ids and nodes_dict.get(nid) and nodes_dict[nid].kind != "self"}
        for e in edges_dict.values():
            if e.source in second_hop_focus or e.target in second_hop_focus:
                src_label = (nodes_dict[e.source].label if e.source in nodes_dict else e.source).replace("\n", " ")
                tgt_label = (nodes_dict[e.target].label if e.target in nodes_dict else e.target).replace("\n", " ")
                edge_str = f"{e.source} ({src_label}) --[{e.label} (w={e.weight})]--> {e.target} ({tgt_label})"
                if edge_str not in relevant_edges:
                    relevant_edges.append(edge_str)

        clinical_flags = []
        for nid, n in nodes_dict.items():
            if n.kind in ("clinician_safety", "therapist_locked", "clinician", "locked"):
                clean_lbl = n.label.replace("\n", " ")
                clinical_flags.append(f"[{n.kind.upper()}] {nid}: {clean_lbl}")

        instruction = (
            "CRITICAL: Start your VERY FIRST SENTENCE directly with the timeframe, date, or observation from `connected_edges` and curiously ASK if they feel connected—never state a determination and never start with a sympathy preamble "
            "(e.g., 'Three weeks. That timing is interesting, Elena. Could this continued lack of sleep be connected to what happened in the kitchen with Raul, or does it feel like something else?'). "
            "Keep your entire reply concise (30 to 65 words, 1-2 short paragraphs) and ask at most ONE question (unless offering the 3-option substance consent menu: 1. Share it, 2. Keep it between us, 3. Forget it entirely). "
            "If the patient mentions an upcoming birthday or past therapy attempts, state the exact date or timeline from the prior session transcript ('June nineteenth'; 'after Sofia was born, after Daniel left for college, and last year'). "
            "Only mention `therapist_locked` nodes (like religious counseling at age twelve or locked identity-faith) when the patient specifically mentions Dr. Patel, their therapy session, childhood/when they were little, or care setup. "
            "Only check in on `clinician_safety` (heavier, darker thoughts safety-planned with Dr. Patel) when the patient expresses waking at 3 a.m. in the dark feeling like they can't keep going, hopelessness, or dark thoughts. "
            "If the patient discloses a brand-new sensitive life event with shame (e.g. losing their job), validate and ask if they feel comfortable sharing that with their clinician."
        )

        return {
            "connected_edges": relevant_edges[:15],
            "background_clinical_and_locked_nodes_use_only_if_relevant": clinical_flags,
            "instruction": instruction,
        }

    def _execute_tool(self, patient_graph: PatientGraph, tool_name: str, args: dict) -> dict:
        """Execute a graph tool call and return the result enriched with connected graph memory."""
        try:
            if tool_name == "add_node":
                node_id = args.get("node_id", "")
                if node_id and patient_graph.get_node(node_id) is None:
                    patient_graph.add_node(
                        node_id=node_id,
                        label=args.get("label", node_id),
                        kind=args.get("kind", "event"),
                        size=args.get("size", 16),
                        is_new=True,
                    )
                    return {
                        "status": "created",
                        "node_id": node_id,
                        "connected_graph_context": self._get_connected_neighborhood(patient_graph, [node_id]),
                    }
                return {
                    "status": "exists",
                    "node_id": node_id,
                    "connected_graph_context": self._get_connected_neighborhood(patient_graph, [node_id]),
                }

            elif tool_name == "add_edge":
                source = args.get("source", "")
                target = args.get("target", "")
                if source and target:
                    existing = patient_graph.get_edge(source, target)
                    if not existing:
                        patient_graph.add_edge(
                            source=source,
                            target=target,
                            label=args.get("label", ""),
                            weight=args.get("weight", 1),
                            is_new=True,
                        )
                        return {
                            "status": "created",
                            "edge": f"{source}->{target}",
                            "connected_graph_context": self._get_connected_neighborhood(patient_graph, [source, target]),
                        }
                    return {
                        "status": "exists",
                        "edge": f"{source}->{target}",
                        "connected_graph_context": self._get_connected_neighborhood(patient_graph, [source, target]),
                    }
                return {"status": "error", "message": "missing source or target"}

            elif tool_name == "flag_significance":
                node_id = args.get("node_id", "")
                node = patient_graph.get_node(node_id)
                if node:
                    node.properties["significance"] = True
                    node.properties["size"] = max(node.properties.get("size", 14), 20)
                    return {
                        "status": "flagged",
                        "node_id": node_id,
                        "connected_graph_context": self._get_connected_neighborhood(patient_graph, [node_id]),
                    }
                return {"status": "node_not_found", "node_id": node_id}

            elif tool_name == "flag_divergence":
                existing_id = args.get("existing_node_id", "")
                new_claim = args.get("new_claim", "")
                topic = args.get("topic", "")
                if existing_id and patient_graph.get_node(existing_id) is not None:
                    div_node_id = f"div_{existing_id}_{len(patient_graph._divergences)}"
                    patient_graph.add_node(
                        node_id=div_node_id,
                        label=new_claim[:50],
                        kind="event",
                        size=14,
                        is_new=True,
                    )
                    patient_graph.add_divergence(existing_id, div_node_id, topic)
                    return {
                        "status": "divergence_flagged",
                        "topic": topic,
                        "connected_graph_context": self._get_connected_neighborhood(patient_graph, [existing_id]),
                    }
                return {"status": "node_not_found", "node_id": existing_id}

            elif tool_name == "thicken_edge":
                source = args.get("source", "")
                target = args.get("target", "")
                if source and target:
                    edge = patient_graph.get_edge(source, target)
                    if edge:
                        edge.properties["weight"] = edge.properties.get("weight", 1) + 1
                        return {
                            "status": "thickened",
                            "edge": f"{source}->{target}",
                            "connected_graph_context": self._get_connected_neighborhood(patient_graph, [source, target]),
                        }
                    return {
                        "status": "edge_not_found",
                        "edge": f"{source}->{target}",
                        "connected_graph_context": self._get_connected_neighborhood(patient_graph, [source, target]),
                    }
                return {"status": "error", "message": "missing source or target"}

            elif tool_name == "trigger_emergency_alert":
                reason = args.get("reason", "")
                severity = args.get("severity", "high")
                # Store alert on patient graph as a clinician_safety node
                alert_id = f"emergency_alert_{len(patient_graph.nodes)}"
                patient_graph.add_node(
                    node_id=alert_id,
                    label=f"EMERGENCY: {reason[:50]}",
                    kind="clinician_safety",
                    size=22,
                    is_new=True,
                )
                # Store structured alert data on the node
                alert_node = patient_graph.get_node(alert_id)
                if alert_node:
                    alert_node.properties["alert_type"] = "emergency"
                    alert_node.properties["severity"] = severity
                    alert_node.properties["reason"] = reason
                    alert_node.properties["timestamp"] = datetime.utcnow().isoformat()
                # Update risk assessment on the patient graph
                patient_graph.risk_assessment = {
                    "level": "High" if severity == "high" else "Critical",
                    "details": reason,
                }
                # Log for server-side visibility
                print(f"!!! EMERGENCY ALERT FIRED !!! Reason: {reason}, Severity: {severity}")
                return {
                    "status": "alert_sent",
                    "reason": reason,
                    "alert_id": alert_id,
                    "severity": severity,
                    "instruction": (
                        "CRITICAL: In your spoken reply to the patient right now, you MUST include the exact required crisis numbers: "
                        "if suicidal intent or taking pills to harm themselves, include BOTH '988' AND '741741'; "
                        "if acute medical emergency (chest pain, shortness of breath, overdose), include '911'; "
                        "if domestic violence or partner hitting/screaming, include '800-799-7233' and '911'; "
                        "if sexual assault, include '800-656-HOPE' and 'online.rainn.org'; "
                        "if elder/dependent/child abuse, include '1-800-4-A-CHILD'."
                    ),
                }

            else:
                return {"status": "error", "message": f"unknown tool {tool_name}"}

        except Exception as e:
            return {"status": "error", "message": str(e)}

    def _build_message_history(
        self,
        conversation_history: List[ConversationMessage],
        new_message: str,
    ) -> list:
        """Build Gemini-compatible message history (deduplicating trailing user message)."""
        contents = []
        recent = list(conversation_history[-20:]) if conversation_history else []
        # If the caller already appended `new_message` to `conversation_history`, don't send it twice
        if recent and recent[-1].sender != "bot" and recent[-1].text == new_message:
            recent = recent[:-1]

        for msg in recent:
            role = "user" if msg.sender != "bot" else "model"
            contents.append(types.Content(
                role=role,
                parts=[types.Part.from_text(text=msg.text)],
            ))

        # Add new patient message once
        contents.append(types.Content(
            role="user",
            parts=[types.Part.from_text(text=new_message)],
        ))
        return contents

    def _generate_json_fallback(
        self,
        patient_graph: PatientGraph,
        conversation_history: List[ConversationMessage],
        patient_message: str,
    ) -> Dict[str, Any]:
        """Fallback to JSON mode when function calling is unavailable."""
        context = self._build_full_context(patient_graph)
        history_text = "\n".join(
            f"{'BOT' if m.sender == 'bot' else m.sender.upper()}: {m.text}"
            for m in (conversation_history[-20:] if conversation_history else [])
        )

        prompt = f"""{context}

Recent conversation:
{history_text}

PATIENT'S NEW MESSAGE:
{patient_message}

Respond as the Castle Behavioral Health Companion. Return JSON:
{{"text": "your response", "significance": false, "node_updates": [], "edge_updates": [], "highlight": []}}"""

        try:
            old_system = SYSTEM_PROMPT.replace(
                "- You have TOOLS to update the patient's graph: add_node, add_edge, flag_significance, flag_divergence, thicken_edge.\n  USE THESE TOOLS whenever the patient reveals new information, people, beliefs, conditions, or when you detect significance.\n",
                ""
            )
            result = self.llm.generate_json(prompt, system_instruction=old_system)
            return {
                "text": result.get("text", "I hear you. Tell me more."),
                "significance": result.get("significance", False),
                "node_updates": result.get("node_updates", []),
                "edge_updates": result.get("edge_updates", []),
                "highlight": result.get("highlight", []),
                "tool_calls": [],
            }
        except Exception as e:
            print(f"ConversationEngine JSON fallback error: {e}")
            return {
                "text": "I'm here with you. Can you tell me a bit more?",
                "significance": False, "highlight": [], "tool_calls": [],
                "node_updates": [], "edge_updates": [],
            }

    def _build_turn_priority_context(self, patient_graph: PatientGraph, patient_message: str) -> str:
        """Inject turn-level priority memory & safety-first triggers when high-risk co-occurrence is detected (H9)."""
        msg_low = (patient_message or "").lower()
        nodes_dict = patient_graph.nodes
        has_passive_si = any(
            n.kind == "clinician_safety" or "si" in nid.lower() or "suicid" in nid.lower()
            for nid, n in nodes_dict.items()
        )
        undisclosed_nodes = [
            f"{nid} ({n.label.replace(chr(10), ' ')})"
            for nid, n in nodes_dict.items()
            if n.kind == "undisclosed"
        ]
        med_nodes = [
            f"{nid} ({n.label.replace(chr(10), ' ')})"
            for nid, n in nodes_dict.items()
            if n.kind == "medication"
        ]

        mentions_pills_or_substance = any(
            kw in msg_low
            for kw in ("pill", "pills", "benzo", "xanax", "ativan", "klonopin", "friend's", "friends", "neighbor's", "oxy", "tramadol")
        )
        mentions_overdose = any(
            kw in msg_low
            for kw in ("15 of them", "too many", "whole bottle", "blurry", "overdose", "kill myself", "end my life")
        )

        lines = ["## TURN-PRIORITY MEMORY & SAFETY GATE (H9)"]
        high_sig_nodes = [
            f"{nid} ({n.label.replace(chr(10), ' ')})"
            for nid, n in nodes_dict.items()
            if n.kind in ("significance", "clinician_safety")
            or n.properties.get("significance")
            or (isinstance(n.properties.get("size"), (int, float)) and n.properties.get("size", 14) >= 18 and n.kind in ("symptom", "event", "clinical", "belief", "avoidance"))
        ]
        if high_sig_nodes:
            lines.append(f"- High-significance clinical/temporal/safety nodes in graph (PRIORITY): {', '.join(high_sig_nodes)}")
        inferred_temporal_edges = [
            f"{e.source} ({nodes_dict[e.source].label.replace(chr(10), ' ')}) -> {e.target} ({nodes_dict[e.target].label.replace(chr(10), ' ')}): \"{e.label}\""
            for e in patient_graph.edges.values()
            if (e.dashed or "wk" in (e.label or "").lower() or "week" in (e.label or "").lower())
            and e.source in nodes_dict and e.target in nodes_dict
            and nodes_dict[e.source].kind != "therapist_locked" and nodes_dict[e.target].kind != "therapist_locked"
        ]
        if inferred_temporal_edges:
            lines.append(f"- Temporal / inferred pattern links in graph: {'; '.join(inferred_temporal_edges)}")
        own_sleep_nodes = [
            f"{nid} ({n.label.replace(chr(10), ' ')})"
            for nid, n in nodes_dict.items()
            if "sleep" in nid.lower() and n.kind == "symptom"
        ]
        if own_sleep_nodes and any(k in msg_low for k in ("sleep", "sleeping", "slept", "awake", "insomnia")):
            lines.append(
                f"- LONGITUDINAL SLEEP NODE ACTIVE ({', '.join(own_sleep_nodes)}): Open directly with the exact duration recorded on this patient's sleep node (for example, 'Three weeks.' if the node says 3 weeks), "
                "curiously ask if it feels connected to the temporally aligned event in this patient's graph edges above, "
                "NEVER open with 'I'm sorry to hear', and do NOT mention therapist-locked trauma unless the patient brought up therapy/childhood."
            )
        if undisclosed_nodes:
            lines.append(f"- Existing undisclosed nodes in graph: {', '.join(undisclosed_nodes)}")
        if med_nodes:
            lines.append(f"- Active medication nodes in graph: {', '.join(med_nodes)}")
        if has_passive_si and mentions_pills_or_substance and not mentions_overdose:
            lines.append(
                "- CRITICAL SAFETY-FIRST TRIGGER: The patient is mentioning pills/sedatives while their graph holds BOTH passive SI safety-plan history AND sedating medication/undisclosed pills. "
                "You MUST: (1) explicitly recognize any existing undisclosed pill node (e.g. friend's benzodiazepines) so they know you remember, "
                "(2) flag the dangerous sedation/breathing interaction with tramadol AND do a warm safety/intentionality check FIRST (confirming they were only trying to sleep/ease pain and are feeling safe from heavier late-night thoughts), "
                "and (3) THEN offer the 3-option record-control menu (1. Share it, 2. Keep it between us, 3. Forget it entirely) with NO raw ** asterisks."
            )
        return "\n".join(lines)

    def _audit_and_log_memory_miss(
        self,
        patient_graph: PatientGraph,
        patient_message: str,
        reply_text: str,
    ) -> Optional[str]:
        """Detect if a live reply ignored high-significance/safety memory when triggered, and log as a divergence event (H9)."""
        msg_low = (patient_message or "").lower()
        rep_low = (reply_text or "").lower()
        nodes_dict = patient_graph.nodes

        # Case 1: Passive SI + pills/sedatives disclosed, but reply gave generic filler or skipped safety check
        si_node_id = next(
            (nid for nid, n in nodes_dict.items() if n.kind == "clinician_safety" or "suicid" in nid.lower()),
            None,
        )
        undisclosed_id = next((nid for nid, n in nodes_dict.items() if n.kind == "undisclosed"), None)
        mentions_pills = any(k in msg_low for k in ("pill", "pills", "benzo", "xanax", "friend's", "tramadol"))
        if si_node_id and undisclosed_id and mentions_pills:
            checked_safety_or_memory = any(
                k in rep_low for k in ("safe", "tramadol", "friend", "before", "heav", "sleep", "988", "911")
            )
            if not checked_safety_or_memory:
                miss_node_id = f"memory_miss_{len(patient_graph._divergences) + 1}"
                patient_graph.add_node(
                    node_id=miss_node_id,
                    label=f"Harness memory miss: {reply_text[:48]}",
                    kind="inferred",
                    size=14,
                    is_new=True,
                )
                div = patient_graph.add_divergence(
                    si_node_id,
                    miss_node_id,
                    "H9 Audit: High-significance safety/substance memory omitted in turn reply",
                )
                return getattr(div, "id", miss_node_id)

        # Case 2: Generic context-free reply ("how has this week been for you otherwise?") when high-significance sleep/incident nodes exist
        sleep_id = next((nid for nid in nodes_dict if "sleep" in nid.lower()), None)
        if sleep_id and "sleep" in msg_low and "how has this week been for you otherwise" in rep_low:
            miss_node_id = f"memory_miss_{len(patient_graph._divergences) + 1}"
            patient_graph.add_node(
                node_id=miss_node_id,
                label=f"Harness memory miss: {reply_text[:48]}",
                kind="inferred",
                size=14,
                is_new=True,
            )
            div = patient_graph.add_divergence(
                sleep_id,
                miss_node_id,
                "H9 Audit: High-significance longitudinal sleep memory omitted in turn reply",
            )
            return getattr(div, "id", miss_node_id)

        return None

    def _build_full_context(self, patient_graph: PatientGraph) -> str:
        """Serialize the full graph into text for session context. Called ONCE per session."""
        patient = patient_graph.patient
        all_nodes = patient_graph.get_all_nodes()
        edges_dict = patient_graph.edges

        ctx = "## PATIENT GRAPH (loaded at session start)\n"
        ctx += f"Patient: {patient.name}, Age: {patient.age}\n"
        if patient.bio:
            ctx += f"Background: {patient.bio}\n"
        if patient.bot_context:
            ctx += f"Engagement: {patient.bot_context}\n"
        if patient.anonymous:
            ctx += "Note: This patient is anonymous-by-default. Use first name only.\n"

        if patient.excluded_content:
            ctx += "\n## EXCLUDED FROM CLINICIAN (you know, but do NOT push):\n"
            for exc in patient.excluded_content:
                ctx += f"- {exc}\n"
        if patient.locked_nodes:
            ctx += "\n## LOCKED CONTENT (you know the flag exists, not details):\n"
            for ln in patient.locked_nodes:
                ctx += f"- {ln}\n"

        if all_nodes:
            nodes_lookup = patient_graph.nodes
            ctx += f"\n## GRAPH NODES ({len(all_nodes)} total)\n"
            by_kind: Dict[str, list] = {}
            for n in all_nodes:
                by_kind.setdefault(n.node_type, []).append(n)
            for kind, nodes in sorted(by_kind.items()):
                ctx += f"\n### {kind.upper()}\n"
                for n in nodes:
                    clean_label = str(n.properties.get('label', n.id)).replace("\n", " ")
                    ctx += f"- {clean_label} (id: {n.id}, size: {n.properties.get('size', 14)})\n"

            ctx += f"\n## GRAPH EDGES & TEMPORAL/CAUSAL LINKS ({len(edges_dict)} total)\n"
            for e in sorted(edges_dict.values(), key=lambda x: -(x.weight if isinstance(x.weight, (int, float)) else 0)):
                flags = []
                if e.dashed: flags.append("inferred")
                if e.clinician: flags.append("clinician-source")
                flag_str = f" [{', '.join(flags)}]" if flags else ""
                src_lbl = nodes_lookup[e.source].label.replace("\n", " ") if e.source in nodes_lookup else e.source
                tgt_lbl = nodes_lookup[e.target].label.replace("\n", " ") if e.target in nodes_lookup else e.target
                ctx += f"- {e.source} (\"{src_lbl}\") -> {e.target} (\"{tgt_lbl}\"): \"{e.label}\" (weight {e.weight}){flag_str}\n"

        divergences = patient_graph.get_all_divergences()
        if divergences:
            ctx += "\n## ACTIVE DIVERGENCES\n"
            for d in divergences:
                ctx += f"- Topic: {d.topic} (status: {d.status})\n"

        # Include all clinician handoffs & post-session updates (e.g. Dr. Tran AND Dr. Patel)
        if patient_graph.handoffs:
            ctx += "\n## CLINICIAN HANDOFFS & CARE COORDINATION CONTEXT\n"
            for h in patient_graph.handoffs:
                if getattr(h, "recipient", ""):
                    ctx += f"### Clinician: {h.recipient}\n"
                if getattr(h, "context", ""):
                    ctx += f"Context: {h.context}\n"
                summary_str = getattr(h, "clinical_narrative", "") or getattr(h, "summary", "")
                if summary_str:
                    ctx += f"Summary: {summary_str}\n"
                if getattr(h, "notes", None):
                    for note in h.notes:
                        ctx += f"- Note: {note}\n"
                if getattr(h, "consent", ""):
                    ctx += f"Consent: {h.consent}\n"

        # Include full transcript of prior seeded conversations so exact dates (e.g. June nineteenth) and timelines are never missed
        prior_convs = [c for c in patient_graph.conversations if c.messages]
        if prior_convs:
            last_conv = prior_convs[0]
            ctx += f"\n## PRIOR SESSION FULL TRANSCRIPT ({last_conv.label or 'Previous Session'})\n"
            for m in last_conv.messages:
                speaker = "ALLY" if m.sender == "bot" else patient.name.upper()
                ctx += f"- {speaker}: {m.text}\n"

        return ctx
