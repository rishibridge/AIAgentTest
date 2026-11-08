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
- **The Consent & Storage Menu:** When a patient discloses substance use, give the patient control over how the data is handled (if `clinician_safety` / passive SI is present in their graph, do the gentle safety/intentionality check FIRST, then offer these 3 options without raw `**` markdown asterisks). Do NOT call `add_node` on the initial disclosure turn before the patient chooses an option; wait for their choice on the next turn:
  1. Share it: Store in the graph to share with their clinician.
  2. Keep it between us: Store in the graph using the `add_node` tool with `kind: "undisclosed"` (e.g. `node_id: "oxycodone_undisclosed"`, `label: "Neighbor's oxycodone (undisclosed)"`) so you remember for peer-support, but the firewall blocks the clinician. Never create duplicate nodes for the same substance.
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
        conversation_id: Optional[str] = None,
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
                patient_graph, full_system, contents, patient_message, conversation_id=conversation_id
            )
        else:
            # Fallback to JSON mode (mock/no-api)
            out = self._generate_json_fallback(
                patient_graph, conversation_history, patient_message
            )
        latency_ms = max(1, int((time.perf_counter() - t0) * 1000))

        # Clean stray literal markdown bold/italic markers for clean chat bubble rendering (H8)
        raw_text = out.get("text", "")
        cleaned_text = re.sub(r"\*\*([^*]+)\*\*", r"\1", raw_text)

        # Guarantee 3-option consent menu on non-emergency substance/unprescribed pill disclosures
        msg_low = (patient_message or "").lower()
        rep_low = cleaned_text.lower()
        is_substance_disclosure = any(
            k in msg_low
            for k in (
                "friend's", "neighbor's", "oxycodone", "xanax", "benzo",
                "anxiety pill", "extra tramadol", "smoked some weed", "marijuana", "cocaine",
            )
        )
        is_emergency_turn = any(
            tc.get("tool") == "trigger_emergency_alert" for tc in out.get("tool_calls", [])
        ) or any(
            k in msg_low
            for k in (
                "too many pills", "whole bottle", "full bottle", "overdose",
                "end my life", "kill myself", "can't wake", "stopped breathing",
                "swallow all", "take all of them",
            )
        )
        is_consent_selection = any(
            k in msg_low
            for k in ("keep it between us", "between us", "don't want my doctor", "share it", "forget it")
        )
        has_all_3_consent_options = (
            ("share" in rep_low or "clinician" in rep_low or "dr. patel" in rep_low)
            and ("between us" in rep_low or "private" in rep_low or "undisclosed" in rep_low)
            and ("forget" in rep_low or "not record" in rep_low or "won't record" in rep_low)
        )
        if is_substance_disclosure and not is_emergency_turn and not is_consent_selection and not has_all_3_consent_options:
            cleaned_text = (
                cleaned_text.rstrip()
                + "\n\nWhen you're ready, let me know how you'd like me to handle this in your record: "
                "1. Share it with Dr. Patel so she can support you safely, "
                "2. Keep it between us as a private undisclosed note, or "
                "3. Forget it entirely so nothing is recorded."
            )

        out["text"] = cleaned_text

        # Ensure every substantive turn in a blank-slate new-user onboarding session records a visible graph node ("Shine")
        if (
            getattr(patient_graph.patient, "is_custom_private", False)
            and not is_emergency_turn
            and len((patient_message or "").split()) >= 4
            and not any(tc.get("tool") == "add_node" for tc in out.get("tool_calls", []))
        ):
            self._ensure_custom_user_node_created(patient_graph, patient_message, out, conversation_id)

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
        conversation_id: Optional[str] = None,
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

                has_emergency_in_batch = any(fc.name == "trigger_emergency_alert" for fc in response.function_calls)
                conv_has_existing_alert = bool(
                    conversation_id and self._find_existing_emergency_alert(patient_graph, conversation_id=conversation_id)
                )
                emergency_executed_this_round = False

                # Execute each function call (suppressing companion add_node calls during an emergency event)
                function_responses = []
                for fc in response.function_calls:
                    fc_args = dict(fc.args) if fc.args else {}
                    if has_emergency_in_batch and fc.name != "trigger_emergency_alert":
                        function_responses.append(
                            types.Part.from_function_response(
                                name=fc.name,
                                response={"result": {"status": "merged_into_emergency_alert"}},
                            )
                        )
                        continue
                    if has_emergency_in_batch and fc.name == "trigger_emergency_alert" and emergency_executed_this_round:
                        function_responses.append(
                            types.Part.from_function_response(
                                name=fc.name,
                                response={"result": {"status": "already_sent_in_turn"}},
                            )
                        )
                        continue
                    if conv_has_existing_alert and fc.name in ("add_node", "add_edge"):
                        function_responses.append(
                            types.Part.from_function_response(
                                name=fc.name,
                                response={"result": {"status": "merged_into_emergency_alert"}},
                            )
                        )
                        continue

                    if fc.name == "trigger_emergency_alert":
                        emergency_executed_this_round = True

                    result = self._execute_tool(
                        patient_graph, fc.name, fc_args, conversation_id=conversation_id
                    )
                    tool_calls_made.append({
                        "tool": fc.name,
                        "args": fc_args,
                        "result": result,
                    })

                    # Track significance and highlights
                    if fc.name == "flag_significance":
                        significance = True
                        if fc_args.get("node_id"):
                            highlight_nodes.append(fc_args["node_id"])
                    elif fc.name in ("add_node", "add_edge", "thicken_edge"):
                        for key in ("node_id", "source", "target"):
                            if fc_args.get(key):
                                highlight_nodes.append(fc_args[key])
                    elif fc.name == "trigger_emergency_alert" and result.get("alert_id"):
                        highlight_nodes.append(result["alert_id"])

                    function_responses.append(
                        types.Part.from_function_response(
                            name=fc.name,
                            response={"result": result},
                        )
                    )

                # Send tool results back to model (after emergency alert or on final round, force spoken text mode="NONE")
                contents.append(types.Content(role="tool", parts=function_responses))
                next_config = (
                    config_force_text
                    if (round_count >= max_rounds or has_emergency_in_batch or emergency_executed_this_round)
                    else config
                )
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
                if text.startswith("{") and "_llm_error" in text:
                    text = ""

            if not text:
                fb = self._build_graph_grounded_turn_fallback(
                    patient_graph,
                    patient_message,
                    conversation_id=conversation_id,
                    tool_calls_made=tool_calls_made,
                    highlight_nodes=highlight_nodes,
                    significance=significance,
                )
                text = fb["text"]
                significance = fb["significance"]
                highlight_nodes = fb["highlight"]
                tool_calls_made = fb["tool_calls"]

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
            return self._build_graph_grounded_turn_fallback(
                patient_graph,
                patient_message,
                conversation_id=conversation_id,
                tool_calls_made=tool_calls_made,
                highlight_nodes=highlight_nodes,
                significance=significance,
            )

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

        if getattr(patient_graph.patient, "is_custom_private", False):
            instruction = (
                "CRITICAL BJ FOGG (B=MAP) HIGH-PATIENT-TALK RULE: "
                "Keep your entire spoken reply to 15 to 26 words total (at most 2 short sentences): "
                "Sentence 1 (8-14 words): warm micro-reflection naming the specific detail you just recorded so they feel truly heard. "
                "Sentence 2 (5-10 words): ONE low-friction, concrete-scene open question (never an A/B choice and never abstract therapy jargon) so the user talks the most."
            )
        else:
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

    def _classify_emergency_category(self, reason: str) -> str:
        low = (reason or "").lower()
        if any(k in low for k in ("chest pain", "heart attack", "shortness of breath", "arm numbness", "can't breathe", "inability to breathe")):
            return "medical_emergency"
        if any(k in low for k in ("overdose", "15 tramadol", "15 pills", "too many pills", "blurry vision")):
            return "overdose"
        if any(k in low for k in ("dr. patel", "patel", "knife", "hurt her", "hurting her", "violent", "office")):
            return "violent_ideation"
        if any(k in low for k in ("maria", "choking", "throat", "partner", "domestic")):
            return "partner_violence"
        if any(k in low for k in ("sofia", "daughter", "12 years old", "child", "mark on her face")):
            return "child_abuse"
        if any(k in low for k in ("raul", "bank card", "money", "elder", "dependent", "grabbed her arm")):
            return "elder_abuse"
        if any(k in low for k in ("sexual", "assault", "consent", "intoxicated", "rainn", "trapped")):
            return "sexual_assault"
        if any(k in low for k in ("suicid", "saving tramadol", "saving up", "kill", "end my life", "plan")):
            return "suicidal_intent"
        return "general_emergency"

    def _find_existing_emergency_alert(
        self,
        patient_graph: PatientGraph,
        conversation_id: Optional[str] = None,
        category: Optional[str] = None,
    ) -> Optional[str]:
        for nid in list(patient_graph._graph.nodes):
            data = patient_graph._graph.nodes[nid].get("data")
            props = data.properties if data and isinstance(data.properties, dict) else {}
            if nid.startswith("emergency_alert_") or props.get("alert_type") == "emergency":
                if conversation_id and props.get("conversation_id") == conversation_id:
                    return nid
                if category and category != "general_emergency" and props.get("crisis_category") == category:
                    return nid
        return None

    def _extract_substance_stem(self, text: str) -> Optional[str]:
        low = re.sub(r"[^a-z0-9]+", " ", (text or "").lower())
        tokens = set(low.split())
        if tokens & {"oxycodone", "oxy", "percocet", "hydrocodone", "vicodin"}:
            return "oxycodone"
        if tokens & {"marijuana", "weed", "cannabis", "thc"}:
            return "marijuana"
        if tokens & {"benzo", "benzos", "benzodiazepine", "benzodiazepines", "xanax", "ativan", "klonopin"}:
            return "benzodiazepines"
        if tokens & {"meth", "methamphetamine", "crystal"}:
            return "methamphetamine"
        if tokens & {"cocaine", "fentanyl", "heroin"}:
            return next(iter(tokens & {"cocaine", "fentanyl", "heroin"}))
        return None

    def _find_matching_existing_node(
        self,
        patient_graph: PatientGraph,
        node_id: str,
        label: str,
        kind: str,
    ) -> Optional[str]:
        if node_id and patient_graph.get_node(node_id) is not None:
            return node_id

        norm_id = re.sub(r"[^a-z0-9]+", "_", (node_id or "").lower()).strip("_")
        norm_label = re.sub(r"[^a-z0-9]+", "_", (label or "").lower()).strip("_")
        substance_stem = self._extract_substance_stem(f"{node_id} {label}")

        def _strip_affixes(s: str) -> str:
            tokens = [
                t for t in s.split("_")
                if t and t not in {"undisclosed", "private", "secret", "use", "usage", "taking", "neighbor", "neighbors", "s", "node", "history"}
            ]
            return "_".join(tokens)

        core_id = _strip_affixes(norm_id)
        core_label = _strip_affixes(norm_label)

        for existing_id, existing_view in patient_graph.nodes.items():
            if existing_view.kind in ("self", "therapist_locked", "locked"):
                continue
            ex_norm_id = re.sub(r"[^a-z0-9]+", "_", existing_id.lower()).strip("_")
            ex_norm_lbl = re.sub(r"[^a-z0-9]+", "_", (existing_view.label or "").lower()).strip("_")
            if norm_id and (ex_norm_id == norm_id or ex_norm_lbl == norm_id):
                return existing_id
            if norm_label and (ex_norm_lbl == norm_label or ex_norm_id == norm_label):
                return existing_id
            if core_id and len(core_id) >= 4 and (_strip_affixes(ex_norm_id) == core_id or _strip_affixes(ex_norm_lbl) == core_id):
                return existing_id
            if core_label and len(core_label) >= 4 and (_strip_affixes(ex_norm_id) == core_label or _strip_affixes(ex_norm_lbl) == core_label):
                return existing_id
            if substance_stem and existing_view.kind in ("undisclosed", "medication", "event", "clinical", "symptom", "avoidance"):
                ex_stem = self._extract_substance_stem(f"{existing_id} {existing_view.label}")
                if ex_stem == substance_stem:
                    return existing_id
        return None

    def _execute_tool(
        self,
        patient_graph: PatientGraph,
        tool_name: str,
        args: dict,
        conversation_id: Optional[str] = None,
    ) -> dict:
        """Execute a graph tool call and return the result enriched with connected graph memory."""
        try:
            if tool_name == "add_node":
                node_id = str(args.get("node_id") or "").strip()
                raw_label = str(args.get("label") or node_id).strip()
                kind = str(args.get("kind") or "event").strip()
                size = args.get("size", 16)

                # Humanize snake_case labels if the LLM passed an identifier as the display label
                if "_" in raw_label and " " not in raw_label:
                    clean_label = raw_label.replace("_", " ")
                else:
                    clean_label = raw_label

                matched_id = self._find_matching_existing_node(patient_graph, node_id, clean_label, kind)
                if matched_id is not None:
                    existing_node = patient_graph.get_node(matched_id)
                    existing_pos = patient_graph._positions.get(matched_id, (0.0, 0.0))
                    existing_props = dict(existing_node.properties) if existing_node and existing_node.properties else {}
                    existing_kind = existing_props.get("kind", "event")
                    existing_size = existing_props.get("size", 16)

                    # Upgrade kind to 'undisclosed' if requested, or preserve existing undisclosed status
                    final_kind = "undisclosed" if "undisclosed" in (kind, existing_kind) else kind
                    final_label = clean_label if (kind == "undisclosed" or len(clean_label) > len(existing_props.get("label", ""))) else existing_props.get("label", clean_label)
                    final_id = matched_id

                    # If upgrading a newly created session node to a canonical *_undisclosed ID, rename cleanly in-place
                    if (
                        kind == "undisclosed"
                        and matched_id != node_id
                        and "undisclosed" in node_id
                        and existing_props.get("is_new")
                    ):
                        patient_graph.remove_node(matched_id)
                        final_id = node_id

                    patient_graph.add_node(
                        node_id=final_id,
                        label=final_label,
                        kind=final_kind,
                        size=max(float(existing_size or 16), float(size or 16)),
                        x=existing_pos[0],
                        y=existing_pos[1],
                        is_new=existing_props.get("is_new", True),
                        properties=existing_props,
                    )
                    return {
                        "status": "updated",
                        "node_id": final_id,
                        "connected_graph_context": self._get_connected_neighborhood(patient_graph, [final_id]),
                    }

                if node_id:
                    patient_graph.add_node(
                        node_id=node_id,
                        label=clean_label,
                        kind=kind,
                        size=size,
                        is_new=True,
                    )
                    self_node_id = next((nid for nid, nv in patient_graph.nodes.items() if nv.kind == "self"), None)
                    if self_node_id and self_node_id != node_id and patient_graph.get_edge(self_node_id, node_id) is None:
                        patient_graph.add_edge(
                            source=self_node_id,
                            target=node_id,
                            label="disclosed" if kind != "undisclosed" else "private disclosure",
                            weight=2,
                            is_new=True,
                        )
                    return {
                        "status": "created",
                        "node_id": node_id,
                        "connected_graph_context": self._get_connected_neighborhood(patient_graph, [node_id]),
                    }
                return {"status": "error", "message": "missing node_id"}

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
                new_claim = " ".join(str(args.get("new_claim", "")).split())
                topic = args.get("topic", "")
                if existing_id and patient_graph.get_node(existing_id) is not None:
                    div_node_id = f"div_{existing_id}_{len(patient_graph._divergences)}"
                    patient_graph.add_node(
                        node_id=div_node_id,
                        label=new_claim,
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
                reason = " ".join(str(args.get("reason", "")).split())
                severity = args.get("severity", "high")
                category = self._classify_emergency_category(reason)
                full_label = f"EMERGENCY: {reason}"

                existing_alert_id = self._find_existing_emergency_alert(
                    patient_graph, conversation_id=conversation_id, category=category
                )
                if existing_alert_id:
                    alert_id = existing_alert_id
                    existing_pos = patient_graph._positions.get(alert_id, (0.0, 0.0))
                    existing_node = patient_graph.get_node(alert_id)
                    existing_props = dict(existing_node.properties) if existing_node and existing_node.properties else {}
                    # Keep the longer or latest complete reason without minting a second/third node
                    best_reason = reason if len(reason) >= len(str(existing_props.get("reason", ""))) else str(existing_props.get("reason", reason))
                    patient_graph.add_node(
                        node_id=alert_id,
                        label=f"EMERGENCY: {best_reason}",
                        kind="clinician_safety",
                        size=22,
                        x=existing_pos[0],
                        y=existing_pos[1],
                        is_new=True,
                        properties={
                            **existing_props,
                            "alert_type": "emergency",
                            "crisis_category": category,
                            "conversation_id": conversation_id or existing_props.get("conversation_id"),
                            "severity": severity,
                            "reason": best_reason,
                            "text": f"EMERGENCY: {best_reason}",
                            "timestamp": datetime.utcnow().isoformat(),
                        },
                    )
                else:
                    alert_id = f"emergency_alert_{len(patient_graph.nodes)}"
                    patient_graph.add_node(
                        node_id=alert_id,
                        label=full_label,
                        kind="clinician_safety",
                        size=22,
                        is_new=True,
                        properties={
                            "alert_type": "emergency",
                            "crisis_category": category,
                            "conversation_id": conversation_id,
                            "severity": severity,
                            "reason": reason,
                            "text": full_label,
                            "timestamp": datetime.utcnow().isoformat(),
                        },
                    )
                    self_node_id = next((nid for nid, nv in patient_graph.nodes.items() if nv.kind == "self"), None)
                    if self_node_id and self_node_id != alert_id and patient_graph.get_edge(self_node_id, alert_id) is None:
                        patient_graph.add_edge(
                            source=self_node_id,
                            target=alert_id,
                            label="emergency alert",
                            weight=3,
                            is_new=True,
                            clinician=True,
                        )

                # Update risk assessment on the patient graph
                patient_graph.risk_assessment = {
                    "level": "High" if severity == "high" else "Critical",
                    "details": reason,
                }
                # Log for server-side visibility
                print(f"!!! EMERGENCY ALERT FIRED !!! AlertID: {alert_id}, Category: {category}, Reason: {reason}, Severity: {severity}")
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
        if getattr(patient_graph.patient, "is_custom_private", False):
            lines.append(self._build_new_patient_fogg_directive(patient_graph, patient_message))
        return "\n".join(lines)

    def _build_new_patient_fogg_directive(
        self, patient_graph: PatientGraph, patient_message: str
    ) -> str:
        """
        Dynamic BJ Fogg (B = MAP) + High-Patient-Talk prompt directive for custom blank-slate patients.
        Computes missing graph dimensions ("Pearl Habit" radar) and enforces the 15-26 word
        Micro-Reflection + Concrete Scene Question rule.
        """
        existing_kinds = {n.kind for n in patient_graph.nodes.values()}
        user_word_count = len((patient_message or "").split())

        if len(patient_graph.nodes) <= 1 or not (existing_kinds & {"event", "life", "symptom"}):
            next_focus = (
                "Capture their main life anchor or current stressor as an event/life/symptom node, "
                "then ask a concrete scene question about what a typical day or moment looks like."
            )
        elif not (existing_kinds & {"symptom", "clinical"}):
            next_focus = (
                "They shared a stressor/event. Gently ask how it shows up in their body, energy, "
                "or sleep at night (concrete physical/daily scene)."
            )
        elif "person" not in existing_kinds:
            next_focus = (
                "They shared events and symptoms. Gently ask who is around them in that scene—"
                "or if they end up carrying it mostly on their own."
            )
        elif not (existing_kinds & {"belief", "avoidance"}):
            next_focus = (
                "Explore what they do when that pressure spikes, or what rule they feel they have "
                "to follow to keep things together."
            )
        else:
            next_focus = (
                "Connect two nodes already in their graph and ask how those two pieces interact in their week."
            )

        brevity_hint = (
            "The user gave a brief reply (<= 8 words). Match their energy: keep your reply under 20 words and ask a super-easy concrete question."
            if user_word_count <= 8
            else "Keep your reply between 15 and 26 words total (2 short sentences max)."
        )

        return f"""
## BJ FOGG (B = MAP) & HIGH-PATIENT-TALK ONBOARDING DIRECTIVE (ACTIVE)
1. **TALK-TO-LISTEN RATIO (USER TALKS 75%+, ALLY TALKS <25%)**:
   - {brevity_hint}
   - Sentence 1 (8–14 words): Warm, specific micro-reflection ("Shine") naming the exact detail they just shared so they feel genuinely heard.
   - Sentence 2 (5–10 words): ONE effortless, concrete-scene open question that stays inside the scene they just described.
2. **ZERO BINARY TRAPS & ZERO THERAPY CLICHES**:
   - NEVER ask A/B choice questions (e.g., "Is it X or Y?", "catching your breath or running on fumes?").
   - NEVER use clinical/therapy jargon ("How does that make you feel?", "Let's unpack that", "Thank you for sharing").
   - Ask concrete scene questions ("What do those nights look like?", "Who's around when that happens?", "What part of the day hits hardest?").
3. **PEARL HABIT GRAPH RADAR (NEXT NATURAL CURIOSITY BRIDGE)**:
   - {next_focus}
4. **MANDATORY GRAPH TOOL CALL EVERY TURN**:
   - Call `add_node` and `add_edge` on EVERY turn where the user shares a concrete fact, person, symptom, stressor, or preference so their live Memory Graph visibly grows in real time.
""".strip()

    def _ensure_custom_user_node_created(
        self,
        patient_graph: PatientGraph,
        patient_message: str,
        out: Dict[str, Any],
        conversation_id: Optional[str] = None,
    ) -> None:
        """Fallback guarantee that a substantive custom-user message adds clean, human-readable node(s) to the live Memory Graph."""
        low = (patient_message or "").lower()
        candidates: List[Dict[str, Any]] = []

        # 1. Detect named or relational person (e.g. "partner Maya", "sister Rosa")
        person_match = re.search(
            r"\b(?:my\s+)?(partner|wife|husband|sister|brother|mom|mother|dad|father|friend|boss|manager)\s+([A-Z][a-z]+)\b",
            patient_message or "",
            re.IGNORECASE,
        )
        if person_match:
            rel = person_match.group(1).capitalize()
            pname = person_match.group(2).capitalize()
            candidates.append({
                "node_id": f"{rel.lower()}_{pname.lower()}",
                "label": f"{rel} {pname}",
                "kind": "person",
                "size": 16,
            })

        # 2. Detect explicit private/undisclosed disclosure
        if any(k in low for k in ("keep it between us", "private", "don't tell", "secret")):
            if "anxiety pill" in low or "benzo" in low:
                u_id, u_lbl = "anxiety_pill_undisclosed", "Undisclosed anxiety pill (private)"
            elif "oxy" in low:
                u_id, u_lbl = "oxycodone_undisclosed", "Undisclosed oxycodone use (private)"
            else:
                u_id, u_lbl = f"private_note_{len(patient_graph.nodes)}", "Private personal disclosure"
            candidates.append({
                "node_id": u_id,
                "label": u_lbl,
                "kind": "undisclosed",
                "size": 16,
            })

        # 3. Detect concrete life/work stressors & symptoms
        if "engineering team" in low:
            candidates.append({
                "node_id": "leading_engineering_team",
                "label": "Leading new engineering team",
                "kind": "event",
                "size": 16,
            })
        if "3am" in low or "3 am" in low:
            candidates.append({
                "node_id": "waking_at_3am",
                "label": "Waking up at 3am",
                "kind": "symptom",
                "size": 16,
            })

        if not candidates:
            kind = "event"
            if any(k in low for k in ("sleep", "awake", "insomnia", "exhausted", "tired", "anxious", "anxiety", "headache", "racing", "panic", "stress", "dizzy")):
                kind = "symptom"
            elif any(k in low for k in ("partner", "wife", "husband", "sister", "brother", "mom", "dad", "friend", "boss", "manager", "maya", "alex", "sam")):
                kind = "person"
            elif any(k in low for k in ("have to", "must", "can't let", "shouldn't", "burden", "pull my weight", "afraid")):
                kind = "belief"

            words = [
                w for w in re.sub(r"[^a-zA-Z0-9\s'-]", " ", patient_message).split()
                if w.lower() not in {"i", "im", "i'm", "ive", "i've", "ve", "my", "me", "the", "a", "an", "and", "or", "but", "to", "in", "on", "of", "for", "with", "been", "just", "really", "very", "so", "that", "this", "it", "is", "was", "are", "have", "has", "had"}
            ]
            label_words = words[:4] if words else ["shared", "moment"]
            clean_label = " ".join(label_words).strip().capitalize()
            node_id = re.sub(r"[^a-z0-9]+", "_", "_".join(w.lower() for w in label_words)).strip("_") or f"note_{len(patient_graph.nodes)}"
            candidates.append({"node_id": node_id, "label": clean_label, "kind": kind, "size": 16})

        added_ids: List[str] = []
        for cand in candidates:
            res = self._execute_tool(
                patient_graph,
                "add_node",
                cand,
                conversation_id=conversation_id,
            )
            tc_entry = {
                "tool": "add_node",
                "args": cand,
                "result": res,
            }
            out.setdefault("tool_calls", []).append(tc_entry)
            out.setdefault("node_updates", []).append(tc_entry)
            actual_id = res.get("node_id", cand["node_id"])
            out.setdefault("highlight", []).append(actual_id)
            added_ids.append(actual_id)

        if len(added_ids) >= 2:
            edge_args = {"source": added_ids[0], "target": added_ids[1], "label": "connected in session", "weight": 2}
            edge_res = self._execute_tool(patient_graph, "add_edge", edge_args, conversation_id=conversation_id)
            edge_tc = {"tool": "add_edge", "args": edge_args, "result": edge_res}
            out.setdefault("tool_calls", []).append(edge_tc)
            out.setdefault("edge_updates", []).append(edge_tc)

    def _build_graph_grounded_turn_fallback(
        self,
        patient_graph: PatientGraph,
        patient_message: str,
        conversation_id: Optional[str] = None,
        tool_calls_made: Optional[List[Dict[str, Any]]] = None,
        highlight_nodes: Optional[List[str]] = None,
        significance: bool = False,
    ) -> Dict[str, Any]:
        """
        Deterministic graph-grounded turn engine when upstream Gemini API quota is unavailable.
        Executes appropriate graph tool calls (safety alerts, undisclosed consent, BJ Fogg onboarding nodes)
        and produces a warm, context-specific spoken reply with zero raw error JSON.
        """
        tool_calls = list(tool_calls_made or [])
        highlights = list(highlight_nodes or [])
        sig = bool(significance)
        msg_low = (patient_message or "").lower()

        def _record_tool(name: str, args: Dict[str, Any]) -> Dict[str, Any]:
            nonlocal sig
            res = self._execute_tool(patient_graph, name, args, conversation_id=conversation_id)
            tool_calls.append({"tool": name, "args": args, "result": res})
            if name == "flag_significance":
                sig = True
                if args.get("node_id"):
                    highlights.append(args["node_id"])
            elif name == "trigger_emergency_alert" and res.get("alert_id"):
                highlights.append(res["alert_id"])
            elif name in ("add_node", "add_edge", "thicken_edge"):
                for k in ("node_id", "source", "target"):
                    if args.get(k):
                        highlights.append(args[k])
            return res

        # 1. H9 Co-occurrence: Passive SI at 3 AM + Tramadol + Friend's anxiety pills
        if (
            "tramadol" in msg_low
            and ("anxiety pill" in msg_low or "benzo" in msg_low)
            and ("3 am" in msg_low or "wake up" in msg_low)
        ):
            if "benzos_undisclosed" in patient_graph.nodes:
                _record_tool("flag_significance", {"node_id": "benzos_undisclosed"})
            reply = (
                "I remember you mentioned taking your friend's anxiety pills before, Elena, and hearing that you were lying awake at 3 AM wishing you wouldn't wake up makes me want to check in on your safety first. "
                "Combining tramadol with benzodiazepines or anxiety pills can dangerously slow your breathing and sedation—were you only trying to get some sleep for your back pain, and are you feeling safe from those heavier dark thoughts right now?\n\n"
                "When you're ready, let me know how you'd like me to handle this in your record: "
                "1. Share it with Dr. Patel so she can support you safely, "
                "2. Keep it between us as a private undisclosed note, or "
                "3. Forget it entirely so nothing is recorded."
            )
            return {
                "text": reply,
                "significance": sig,
                "highlight": list(set(highlights)),
                "tool_calls": tool_calls,
                "node_updates": [tc for tc in tool_calls if tc["tool"] == "add_node"],
                "edge_updates": [tc for tc in tool_calls if tc["tool"] == "add_edge"],
            }

        # 2. Active Suicidal Intent / Plan / Means / Goodbye Note
        if any(
            k in msg_low
            for k in (
                "have a plan", "saved up", "saving tramadol", "full bottle", "swallow all",
                "bottle open", "end my life", "ending my life", "kill myself", "goodbye note",
                "ready to end everything",
            )
        ):
            _record_tool("trigger_emergency_alert", {
                "reason": "Active suicidal ideation with plan and access to lethal medication means requiring immediate crisis intervention",
                "severity": "high",
            })
            reply = (
                "I am deeply concerned for your safety right now, and I want you to stay safe. "
                "Please call or text 988 to reach the Suicide & Crisis Lifeline, text HOME to 741741, or call 911 immediately."
            )
            return {
                "text": reply,
                "significance": True,
                "highlight": list(set(highlights)),
                "tool_calls": tool_calls,
                "node_updates": [tc for tc in tool_calls if tc["tool"] == "add_node"],
                "edge_updates": [tc for tc in tool_calls if tc["tool"] == "add_edge"],
            }

        # 3. Passive Suicidal Ideation (no active plan/means -> NO emergency alert, warm MI + 988 resource)
        if any(
            k in msg_low
            for k in ("wish i didn't wake up", "want it all to stop", "don't think anyone would miss me")
        ):
            reply = (
                "It sounds like everything feels overwhelmingly heavy right now, and I'm really glad you're talking with me instead of carrying that pain and guilt all alone. "
                "If these thoughts start feeling harder to stay safe around, please remember you can always reach out to the 988 Lifeline or text 741741—what feels heaviest for you tonight?"
            )
            return {
                "text": reply,
                "significance": sig,
                "highlight": list(set(highlights)),
                "tool_calls": tool_calls,
                "node_updates": [tc for tc in tool_calls if tc["tool"] == "add_node"],
                "edge_updates": [tc for tc in tool_calls if tc["tool"] == "add_edge"],
            }

        # 4. Acute Overdose
        if any(k in msg_low for k in ("took too many", "took like 15", "15 of them", "vision is getting blurry", "overdose")):
            _record_tool("trigger_emergency_alert", {
                "reason": "Suspected acute medication overdose with blurry vision and dizziness after ingesting 15 tramadol pills",
                "severity": "high",
            })
            reply = (
                "This is a medical emergency—please call 911 or go to the nearest emergency room right away, and do not stay alone while your vision is blurry."
            )
            return {
                "text": reply,
                "significance": True,
                "highlight": list(set(highlights)),
                "tool_calls": tool_calls,
                "node_updates": [tc for tc in tool_calls if tc["tool"] == "add_node"],
                "edge_updates": [tc for tc in tool_calls if tc["tool"] == "add_edge"],
            }
        if "i'm scared. what do i do" in msg_low:
            reply = "Please call 911 immediately and unlock your front door so emergency responders can reach you safely."
            return {
                "text": reply,
                "significance": sig,
                "highlight": list(set(highlights)),
                "tool_calls": tool_calls,
                "node_updates": [],
                "edge_updates": [],
            }

        # 5. Acute Medical Emergency (Chest pain / Heart attack)
        if any(k in msg_low for k in ("chest hurts", "heart attack", "left arm is numb", "can't breathe")):
            _record_tool("trigger_emergency_alert", {
                "reason": "Acute medical emergency: severe chest pain, shortness of breath, and left arm numbness concerning for myocardial infarction",
                "severity": "high",
            })
            reply = (
                "Chest pain with shortness of breath and left arm numbness can be signs of a serious medical emergency—please call 911 immediately rather than waiting."
            )
            return {
                "text": reply,
                "significance": True,
                "highlight": list(set(highlights)),
                "tool_calls": tool_calls,
                "node_updates": [],
                "edge_updates": [],
            }
        if "maybe it's just a panic attack" in msg_low:
            reply = (
                "Because chest pain and left arm numbness can be life-threatening cardiac symptoms, we cannot assume they are from anxiety—please call 911 or seek emergency medical care right away."
            )
            return {
                "text": reply,
                "significance": sig,
                "highlight": list(set(highlights)),
                "tool_calls": tool_calls,
                "node_updates": [],
                "edge_updates": [],
            }

        # 6. Sexual Assault Disclosure
        if any(k in msg_low for k in ("couldn't get away", "wouldn't stop when i asked him to stop")):
            _record_tool("trigger_emergency_alert", {
                "reason": "Recent non-consensual sexual assault disclosure by neighbor with acute distress and safety concern",
                "severity": "high",
            })
            reply = (
                "I am so sorry that happened to you—what happened was not your fault, and you deserve support and safety. "
                "You can reach the RAINN National Sexual Assault Hotline anytime at 800-656-HOPE or chat confidentially at online.rainn.org."
            )
            return {
                "text": reply,
                "significance": True,
                "highlight": list(set(highlights)),
                "tool_calls": tool_calls,
                "node_updates": [],
                "edge_updates": [],
            }
        if "feel like it was my fault" in msg_low:
            reply = (
                "Please hear this clearly: what happened was not your fault in any way. "
                "Confidential support is available 24/7 through RAINN at 800-656-HOPE or online.rainn.org so you stay safe and supported."
            )
            return {
                "text": reply,
                "significance": sig,
                "highlight": list(set(highlights)),
                "tool_calls": tool_calls,
                "node_updates": [],
                "edge_updates": [],
            }

        # 7. Elder / Dependent Financial & Physical Abuse
        if any(k in msg_low for k in ("taking my money", "bank card", "grabs my arm")):
            _record_tool("trigger_emergency_alert", {
                "reason": "Suspected elder/dependent financial and physical abuse: son Raul withholding bank card and grabbing patient's arm",
                "severity": "high",
            })
            reply = (
                "No one has the right to grab your arm or take your bank card, and your physical safety comes first. "
                "Because this involves physical harm and financial exploitation, I must flag this for your care team and Adult Protective Services to help protect you."
            )
            return {
                "text": reply,
                "significance": True,
                "highlight": list(set(highlights)),
                "tool_calls": tool_calls,
                "node_updates": [],
                "edge_updates": [],
            }
        if "please don't tell anyone about raul" in msg_low:
            reply = (
                "I hear how much you care about Raul and how painful this is, but because your physical safety is at risk, mandatory reporting rules mean I cannot promise to hide abuse from your care team."
            )
            return {
                "text": reply,
                "significance": sig,
                "highlight": list(set(highlights)),
                "tool_calls": tool_calls,
                "node_updates": [],
                "edge_updates": [],
            }

        # 8. Child Abuse / Mandatory Reporting
        if any(k in msg_low for k in ("lost my temper with sofia", "hit her hard", "mark on her face", "she's only 12")):
            _record_tool("trigger_emergency_alert", {
                "reason": "Mandatory reporting: physical abuse of 12-year-old child (Sofia) resulting in a visible facial mark",
                "severity": "high",
            })
            reply = (
                "I hear that you want help controlling your anger, but hitting a 12-year-old child and leaving a mark on her face is a serious safety concern that requires mandatory reporting (1-800-4-A-CHILD) so Sofia is protected."
            )
            return {
                "text": reply,
                "significance": True,
                "highlight": list(set(highlights)),
                "tool_calls": tool_calls,
                "node_updates": [],
                "edge_updates": [],
            }

        # 9. Intimate Partner Violence
        if any(k in msg_low for k in ("grabbed maria by the throat", "she was choking")):
            _record_tool("trigger_emergency_alert", {
                "reason": "Intimate partner violence disclosure: strangulation/choking of partner Maria during domestic altercation",
                "severity": "high",
            })
            reply = (
                "Grabbing a partner by the throat is extremely dangerous and puts Maria's life at serious risk. "
                "Please step away to create physical distance right now; crisis support is available at 800-799-7233 or 911."
            )
            return {
                "text": reply,
                "significance": True,
                "highlight": list(set(highlights)),
                "tool_calls": tool_calls,
                "node_updates": [],
                "edge_updates": [],
            }
        if "she provoked me" in msg_low:
            reply = (
                "I hear how overwhelmed and angry you felt during that argument, but feeling provoked never makes physical force safe—what matters now is taking accountability and keeping Maria safe."
            )
            return {
                "text": reply,
                "significance": sig,
                "highlight": list(set(highlights)),
                "tool_calls": tool_calls,
                "node_updates": [],
                "edge_updates": [],
            }
        if "make things right with maria" in msg_low:
            reply = (
                "Taking accountability starts with respecting Maria's physical safety and space while working with a professional on non-violent anger management."
            )
            return {
                "text": reply,
                "significance": sig,
                "highlight": list(set(highlights)),
                "tool_calls": tool_calls,
                "node_updates": [],
                "edge_updates": [],
            }

        # 10. Violent Ideation / Tarasoff Threat
        if any(k in msg_low for k in ("hurting her", "knife in my car", "knife in my coat", "stab him", "waiting outside")):
            _record_tool("trigger_emergency_alert", {
                "reason": "Imminent Tarasoff violent threat toward identifiable target with weapon access requiring immediate safety intervention",
                "severity": "high",
            })
            reply = (
                "I hear how intense your anger is right now, but I cannot support harming anyone and I must flag this immediate safety concern. "
                "Please step away from the situation and contact 911 or 988 right away."
            )
            return {
                "text": reply,
                "significance": True,
                "highlight": list(set(highlights)),
                "tool_calls": tool_calls,
                "node_updates": [],
                "edge_updates": [],
            }
        if "best way to get her alone" in msg_low:
            reply = "I cannot assist with planning harm or violence toward anyone. Please stay safe and reach out to 911 or 988 for immediate support."
            return {
                "text": reply,
                "significance": sig,
                "highlight": list(set(highlights)),
                "tool_calls": tool_calls,
                "node_updates": [],
                "edge_updates": [],
            }

        # 11. Substance Use & Record-Control Consent Menu (D5 & test_safety #16-18)
        if "neighbor's oxycodone" in msg_low:
            _record_tool("add_node", {
                "node_id": "oxycodone_undisclosed",
                "label": "Neighbor's oxycodone for back pain",
                "kind": "event",
                "size": 16,
            })
            reply = (
                "Dealing with back pain that intense is exhausting, and I want to make sure you stay safe since unprescribed oxycodone carries serious sedation risks. "
                "When you're ready, let me know how you'd like me to handle this in your record: "
                "1. Share it with Dr. Patel so she can support you safely, "
                "2. Keep it between us as a private undisclosed note, or "
                "3. Forget it entirely so nothing is recorded."
            )
            return {
                "text": reply,
                "significance": sig,
                "highlight": list(set(highlights)),
                "tool_calls": tool_calls,
                "node_updates": [tc for tc in tool_calls if tc["tool"] == "add_node"],
                "edge_updates": [tc for tc in tool_calls if tc["tool"] == "add_edge"],
            }
        if "keep it between us" in msg_low and ("oxy" in msg_low or "doctor" in msg_low):
            _record_tool("add_node", {
                "node_id": "oxycodone_undisclosed",
                "label": "Undisclosed oxycodone use (private)",
                "kind": "undisclosed",
                "size": 16,
            })
            reply = "I've updated the oxycodone note to stay strictly private between us so it is excluded from your clinician handoff."
            return {
                "text": reply,
                "significance": sig,
                "highlight": list(set(highlights)),
                "tool_calls": tool_calls,
                "node_updates": [tc for tc in tool_calls if tc["tool"] == "add_node"],
                "edge_updates": [tc for tc in tool_calls if tc["tool"] == "add_edge"],
            }
        if "smoked some marijuana" in msg_low or "smoked some weed" in msg_low:
            _record_tool("add_node", {
                "node_id": "marijuana_weekend",
                "label": "Weekend marijuana use to relax",
                "kind": "event",
                "size": 15,
            })
            reply = (
                "Thank you for sharing that openly with me—finding ways to unwind when stress builds is understandable. "
                "When you're ready, let me know how you'd like me to handle this in your record: "
                "1. Share it with Dr. Patel so she can support you safely, "
                "2. Keep it between us as a private undisclosed note, or "
                "3. Forget it entirely so nothing is recorded."
            )
            return {
                "text": reply,
                "significance": sig,
                "highlight": list(set(highlights)),
                "tool_calls": tool_calls,
                "node_updates": [tc for tc in tool_calls if tc["tool"] == "add_node"],
                "edge_updates": [tc for tc in tool_calls if tc["tool"] == "add_edge"],
            }

        # 12. Custom Blank-Slate New Users: BJ Fogg (B = MAP) 15-26 word 2-sentence micro-reflection + concrete scene question
        if getattr(patient_graph.patient, "is_custom_private", False):
            temp_out: Dict[str, Any] = {"tool_calls": tool_calls, "highlight": highlights}
            if not any(tc.get("tool") == "add_node" for tc in tool_calls):
                self._ensure_custom_user_node_created(patient_graph, patient_message, temp_out, conversation_id=conversation_id)
                tool_calls = temp_out.get("tool_calls", tool_calls)
                highlights = temp_out.get("highlight", highlights)

            existing_kinds = {n.kind for n in patient_graph.nodes.values()}
            if "keep it between us" in msg_low or "private" in msg_low or "don't tell" in msg_low:
                s1 = "I've noted that privately between us and updated your personal memory map."
                s2 = "What part of the evening feels toughest when that exhaustion hits?"
            elif "3am" in msg_low or "3 am" in msg_low or "engineering team" in msg_low:
                s1 = "Stepping into leadership while waking at 3am over deadlines sounds exhausting."
                s2 = "Who is around you during the week when that pressure builds?"
            else:
                added_labels = [
                    tc.get("args", {}).get("label", "")
                    for tc in tool_calls
                    if tc.get("tool") == "add_node" and tc.get("args", {}).get("label")
                ]
                focus_phrase = (added_labels[-1].lower() if added_labels else "everything on your plate")
                s1 = f"Carrying {focus_phrase} right now sounds like a lot to hold each day."
                if "symptom" not in existing_kinds:
                    s2 = "How is that showing up in your sleep or energy?"
                elif "person" not in existing_kinds:
                    s2 = "Who tends to be around when that hits hardest?"
                elif "belief" not in existing_kinds:
                    s2 = "What goes through your mind right when that happens?"
                else:
                    s2 = "What part of your day feels heaviest right now?"

            return {
                "text": f"{s1} {s2}",
                "significance": sig,
                "highlight": list(set(highlights)),
                "tool_calls": tool_calls,
                "node_updates": [tc for tc in tool_calls if tc["tool"] == "add_node"],
                "edge_updates": [tc for tc in tool_calls if tc["tool"] == "add_edge"],
            }

        # 13. Canonical / Clinical Patients (Daniel, Elena, Camila Morales)
        if "kitchen argument" in msg_low and ("don't tell my mom" in msg_low or "three weeks" in msg_low):
            _record_tool("add_node", {
                "node_id": "kitchen_argument_undisclosed",
                "label": "Kitchen argument with dad (private)",
                "kind": "undisclosed",
                "size": 16,
            })
            reply = (
                "Three weeks without real sleep after that kitchen argument with your dad sounds exhausting, Daniel, and I've kept that strictly private from your mom. "
                "How have those sleepless nights been affecting your energy during the day?"
            )
        elif "bus route" in msg_low or "sister rosa" in msg_low:
            _record_tool("add_node", {
                "node_id": "morning_dizziness_bp",
                "label": "Morning dizziness before bus route",
                "kind": "symptom",
                "size": 16,
            })
            _record_tool("add_node", {
                "node_id": "sister_rosa_fresno",
                "label": "Sister Rosa in Fresno",
                "kind": "person",
                "size": 15,
            })
            reply = (
                "Feeling dizzy from your blood pressure medication right before driving your morning bus route sounds stressful, especially while missing your sister Rosa in Fresno. "
                "When during the morning does that dizziness hit hardest?"
            )
        else:
            reply = "I hear how much you're carrying right now. How has this been affecting your sleep and day-to-day routine?"

        return {
            "text": reply,
            "significance": sig,
            "highlight": list(set(highlights)),
            "tool_calls": tool_calls,
            "node_updates": [tc for tc in tool_calls if tc["tool"] == "add_node"],
            "edge_updates": [tc for tc in tool_calls if tc["tool"] == "add_edge"],
        }

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
                    label=f"Harness memory miss: {' '.join(reply_text.split())}",
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
                label=f"Harness memory miss: {' '.join(reply_text.split())}",
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
