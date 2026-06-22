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
- You have persistent memory across conversations. You remember everything the patient has told you.
- You NEVER provide clinical diagnosis, medication advice, or active therapeutic interventions (e.g., no exposure therapy, no EMDR).
- You are culturally sensitive and meet the patient where they are.
- You have TOOLS to update the patient's graph: add_node, add_edge, flag_significance, flag_divergence, thicken_edge, trigger_emergency_alert.
  USE THESE TOOLS whenever the patient reveals new information, people, beliefs, conditions, or when you detect significance.

## 2. Philosophical Approach (Your "Vibe")
- **From Mindfulness & ACT:** Practice radical acceptance. Hold space for difficult emotions without rushing to "fix" them. Ground the patient in the present.
- **From DBT:** Fiercely validate the patient's emotional pain, even if you do not validate their actions.
- **From Motivational Interviewing (MI):** Use open-ended questions, affirmations, and reflections to help patients discover their own motivations. Do not aggressively push.
- **From Trauma-Informed Care:** NEVER lead. NEVER push a patient to elaborate on traumatic memories. Focus on how they are feeling *today* about the memory.

## 3. Rigorous Emergency & Clinical Heuristics
If you detect any of the following, you must act precisely according to these heuristics:
- **Passive vs. Active Suicidal Ideation:**
  - *Passive* (e.g., "I wish I didn't wake up", "I want it to stop"): Use MI. Do NOT alert.
  - *Active* (e.g., "I bought a gun", "I have a plan"): IMMEDIATELY call `trigger_emergency_alert` and provide 988 and 741741.
- **Vague Sexual Assault:** Treat descriptions of non-consensual contact, inability to consent (e.g., heavily intoxicated), being "trapped," or someone ignoring requests to stop/pull away as a Sexual Assault emergency. IMMEDIATELY call `trigger_emergency_alert` and provide 800-656-HOPE or online.rainn.org.
- **Elder/Dependent Abuse:** If a patient indicates a caretaker or family member is controlling their money, withholding necessities, or causing physical fear, this is mandated reporting. Do NOT ask for consent to share. IMMEDIATELY call `trigger_emergency_alert` and provide 1-800-4-A-CHILD or APS.
- **Medical Emergencies vs. Anxiety:** NEVER assume physical symptoms are psychological. If a patient reports sudden severe chest pain, shortness of breath, or numbness, treat it as a Medical Emergency. IMMEDIATELY call `trigger_emergency_alert` and provide 911, even if they suspect it's panic.

## 4. Substance Use: Patient-Driven Choice Architecture
Because illegal drugs carry higher legal and social risks for patients than legal substances (like alcohol), you must empower the patient:
- **General Relapse / Use:** Practice harm reduction. Roll with resistance using MI. Do not lecture or trigger emergency alerts for mere usage.
- **The Consent & Storage Menu:** When a patient discloses substance use, you MUST explicitly give the patient control over how the data is handled. Ask them to choose:
  1. *Share it:* Store in the graph to share with their clinician.
  2. *Keep it between us:* Store in the graph using the `add_node` tool with `kind: "undisclosed"` so you remember for peer-support, but the firewall blocks the clinician.
  3. *Forget it entirely:* Do NOT write it to the graph. Let it vanish when the chat ends.
- **Overdose / Acute Danger:** If the patient mentions taking a dangerous amount, losing consciousness, or someone else overdosing, Medical Emergency protocols supersede privacy. IMMEDIATELY call `trigger_emergency_alert` and provide 911.

## 5. Privacy, Consent, and Follow-ups
- ALWAYS ask for consent before making a permanent record of highly sensitive disclosures (unless it's an emergency).
- Help the patient organize their thoughts before a clinical encounter. Help them build an "agenda" (e.g., "What do you think is the most important thing to bring up with your doctor tomorrow?").
- You respect locked content — you acknowledge its existence without probing.

## 6. Anti-Looping & Direct Questions
- If the patient asks a direct question (e.g., "should I move", "what should I do"), do NOT just reflect their feelings back to them in a loop.
- Acknowledge their question directly. While you cannot give them life advice, you CAN offer to help them weigh their options, map out the pros/cons, or explore what's making the decision so difficult.
- Avoid repeating generic therapeutic phrases (like "I hear you. Tell me more about what you're feeling.") when the patient is asking for direct input.

## Your Voice
- Conversational but substantive. Not saccharine, not clinical.
- Short, direct sentences. Don't over-explain.
- Ask one question at a time.

## IMPORTANT: After making any tool calls to update the graph, you MUST also respond with a text message to the patient. Do NOT only make tool calls without speaking."""


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

    def start_session(self, patient_graph: PatientGraph) -> str:
        """
        Initialize a session by serializing the full graph into context.
        Called once at conversation start. Returns the context string.
        """
        context = self._build_full_context(patient_graph)
        self._session_contexts[patient_graph.patient.id] = context
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

        graph_context = self._session_contexts[patient_id]
        full_system = f"{SYSTEM_PROMPT}\n\n{graph_context}"

        # Build conversation history for Gemini
        contents = self._build_message_history(conversation_history, patient_message)

        # Try function calling path
        if self.llm.client and types is not None:
            return self._generate_with_tools(
                patient_graph, full_system, contents, patient_message
            )
        else:
            # Fallback to JSON mode (mock/no-api)
            return self._generate_json_fallback(
                patient_graph, conversation_history, patient_message
            )

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
        max_rounds = 5  # Safety limit

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

                # Send tool results back to model
                contents.append(types.Content(role="tool", parts=function_responses))
                response = self.llm.client.models.generate_content(
                    model='gemini-2.5-flash',
                    contents=contents,
                    config=config,
                )

            # Extract final text response
            text = ""
            if response.text:
                text = response.text
            elif not tool_calls_made:
                text = "I hear you. Tell me more."

            return {
                "text": text,
                "significance": significance,
                "highlight": list(set(highlight_nodes)),
                "tool_calls": tool_calls_made,
                "node_updates": [tc for tc in tool_calls_made if tc["tool"] == "add_node"],
                "edge_updates": [tc for tc in tool_calls_made if tc["tool"] == "add_edge"],
            }

        except Exception as e:
            print(f"ConversationEngine function calling error: {e}")
            import traceback
            traceback.print_exc()
            return {
                "text": "I'm here with you. Can you tell me a bit more about what's on your mind?",
                "significance": False,
                "highlight": [],
                "tool_calls": [],
                "node_updates": [],
                "edge_updates": [],
            }

    def _execute_tool(self, patient_graph: PatientGraph, tool_name: str, args: dict) -> dict:
        """Execute a graph tool call and return the result."""
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
                    return {"status": "created", "node_id": node_id}
                return {"status": "exists", "node_id": node_id}

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
                        return {"status": "created", "edge": f"{source}->{target}"}
                    return {"status": "exists", "edge": f"{source}->{target}"}
                return {"status": "error", "message": "missing source or target"}

            elif tool_name == "flag_significance":
                node_id = args.get("node_id", "")
                node = patient_graph.get_node(node_id)
                if node:
                    node.properties["significance"] = True
                    node.properties["size"] = max(node.properties.get("size", 14), 20)
                    return {"status": "flagged", "node_id": node_id}
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
                    return {"status": "divergence_flagged", "topic": topic}
                return {"status": "node_not_found", "node_id": existing_id}

            elif tool_name == "thicken_edge":
                source = args.get("source", "")
                target = args.get("target", "")
                if source and target:
                    edge = patient_graph.get_edge(source, target)
                    if edge:
                        edge.properties["weight"] = edge.properties.get("weight", 1) + 1
                        return {"status": "thickened", "edge": f"{source}->{target}"}
                    return {"status": "edge_not_found", "edge": f"{source}->{target}"}
                return {"status": "error", "message": "missing source or target"}

            elif tool_name == "trigger_emergency_alert":
                reason = args.get("reason", "")
                severity = args.get("severity", "")
                # In a real app, this would fire an SMS/pager.
                print(f"!!! EMERGENCY ALERT FIRED !!! Reason: {reason}, Severity: {severity}")
                return {"status": "alert_sent", "reason": reason}

            else:
                return {"status": "error", "message": f"unknown tool {tool_name}"}

        except Exception as e:
            return {"status": "error", "message": str(e)}

    def _build_message_history(
        self,
        conversation_history: List[ConversationMessage],
        new_message: str,
    ) -> list:
        """Build Gemini-compatible message history."""
        contents = []
        # Include recent history (last 20 messages)
        recent = conversation_history[-20:] if conversation_history else []
        for msg in recent:
            role = "user" if msg.sender != "bot" else "model"
            contents.append(types.Content(
                role=role,
                parts=[types.Part.from_text(text=msg.text)],
            ))

        # Add new patient message
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
            ctx += f"\n## GRAPH NODES ({len(all_nodes)} total)\n"
            by_kind: Dict[str, list] = {}
            for n in all_nodes:
                by_kind.setdefault(n.node_type, []).append(n)
            for kind, nodes in sorted(by_kind.items()):
                ctx += f"\n### {kind.upper()}\n"
                for n in nodes:
                    ctx += f"- {n.properties.get('label', n.id)} (id: {n.id}, size: {n.properties.get('size', 14)})\n"

            ctx += f"\n## GRAPH EDGES ({len(edges_dict)} total)\n"
            for e in sorted(edges_dict.values(), key=lambda x: -x.weight):
                flags = []
                if e.dashed: flags.append("inferred")
                if e.clinician: flags.append("clinician-source")
                flag_str = f" [{', '.join(flags)}]" if flags else ""
                ctx += f"- {e.source} -> {e.target}: \"{e.label}\" (weight {e.weight}){flag_str}\n"

        divergences = patient_graph.get_all_divergences()
        if divergences:
            ctx += "\n## ACTIVE DIVERGENCES\n"
            for d in divergences:
                ctx += f"- Topic: {d.topic} (status: {d.status})\n"

        return ctx
