"""
DDx Clinical Debate — SSE streaming endpoint.
Streams adversarial debate turns (Case For / Case Against / Judge) as newline-delimited JSON events.
"""
import json
import uuid
import time
from typing import Dict, Any, Optional
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

router = APIRouter(prefix="/api/v1/patients/{patient_id}/debate", tags=["debate"])

_store = None

# In-memory debate sessions (for human turn coordination)
_sessions: Dict[str, Dict] = {}


def set_store(store):
    global _store
    _store = store


class HumanTurnRequest(BaseModel):
    session_id: str
    role: str  # 'for', 'against', or 'judge'
    text: str
    score_delta: Optional[int] = None  # For judge: -5 to +5
    end_debate: Optional[bool] = False
    winner: Optional[str] = None  # 'for' or 'against'


@router.get("/stream")
def stream_debate(patient_id: str, request: Request,
                  topic: str = "What is the primary diagnosis?",
                  for_model: str = "ai",
                  against_model: str = "ai",
                  judge_model: str = "human"):
    """
    SSE streaming debate endpoint.
    Streams JSON events: {role, text, round, state, score_delta?, session_id?}
    """
    pg = _store["firewall"].get_patient_graph(patient_id)
    if not pg:
        raise HTTPException(404, "Patient not found")

    session_id = str(uuid.uuid4())[:8]
    _sessions[session_id] = {"status": "active", "human_input": None, "history": []}

    def generate():
        llm = _store["llm"]
        clinician_engine = _store["clinician_engine"]

        # Build clinical context from patient graph
        context = clinician_engine._build_clinical_context(pg, [])

        history = []
        score = 0
        max_rounds = 3

        # Emit session start
        yield _event("system", f"DDx Debate: {topic}", "start", 0, session_id=session_id)
        yield _event("system", f"Patient: {pg.patient.name}", "info", 0)

        # Opening statements
        yield _event("system", "Opening Statements", "loading", 0)

        # Advocate opening
        if for_model == "human":
            yield _event("for", "", "human_turn", 0, extra={"prompt": "Present your opening argument for this position."})
            human_text = _wait_for_human(session_id, "for")
            if human_text is None:
                yield _event("system", "Debate ended.", "done", 0)
                return
            adv_text = human_text
        else:
            yield _event("for", "", "thinking", 0)
            adv_prompt = f"""You are presenting THE CASE FOR in a clinical debate.

Topic: {topic}
Patient Context:
{context}

Present a strong opening argument supporting this position. Cite specific patient quotes, symptoms, and clinical evidence from the patient record. Be concise (2-3 paragraphs max).

Do NOT use headers, JSON, or formatting. Write in plain clinical prose."""
            adv_text = llm.generate(adv_prompt)

        history.append(f"CASE FOR (Opening): {adv_text}")
        yield _event("for", adv_text, "speaking", 0, extra={"label": "Opening"})

        # Skeptic opening
        if against_model == "human":
            yield _event("against", "", "human_turn", 0, extra={"prompt": "Present your opening argument against this position."})
            human_text = _wait_for_human(session_id, "against")
            if human_text is None:
                yield _event("system", "Debate ended.", "done", 0)
                return
            skep_text = human_text
        else:
            yield _event("against", "", "thinking", 0)
            skep_prompt = f"""You are presenting THE CASE AGAINST in a clinical debate.

Topic: {topic}
Patient Context:
{context}

The Case For argued:
{adv_text}

Present a strong opening argument AGAINST this position. Challenge assumptions, cite contradictory evidence from the patient record, and propose alternative explanations. Be concise (2-3 paragraphs max).

Do NOT use headers, JSON, or formatting. Write in plain clinical prose."""
            skep_text = llm.generate(skep_prompt)

        history.append(f"CASE AGAINST (Opening): {skep_text}")
        yield _event("against", skep_text, "speaking", 0, extra={"label": "Opening"})

        # Rounds
        for round_num in range(1, max_rounds + 1):
            # Check if session was ended
            if _sessions.get(session_id, {}).get("status") != "active":
                break

            yield _event("system", f"Round {round_num}", "loading", round_num)

            # Advocate turn
            if for_model == "human":
                yield _event("for", "", "human_turn", round_num, extra={"prompt": f"Round {round_num}: Respond to the opposing argument."})
                human_text = _wait_for_human(session_id, "for")
                if human_text is None:
                    break
                adv_text = human_text
            else:
                yield _event("for", "", "thinking", round_num)
                adv_prompt = f"""Clinical debate Round {round_num}. You are THE CASE FOR.

Topic: {topic}
Patient Context:
{context}

Debate history:
{chr(10).join(history[-4:])}

Respond to the opposing argument. Reinforce your position with new evidence from the patient record. Address specific challenges raised. Be concise (1-2 paragraphs).

Do NOT use headers, JSON, or formatting. Write in plain clinical prose."""
                adv_text = llm.generate(adv_prompt)

            history.append(f"CASE FOR (Round {round_num}): {adv_text}")
            yield _event("for", adv_text, "speaking", round_num, extra={"label": f"Round {round_num}"})

            # Skeptic turn
            if against_model == "human":
                yield _event("against", "", "human_turn", round_num, extra={"prompt": f"Round {round_num}: Respond to the supporting argument."})
                human_text = _wait_for_human(session_id, "against")
                if human_text is None:
                    break
                skep_text = human_text
            else:
                yield _event("against", "", "thinking", round_num)
                skep_prompt = f"""Clinical debate Round {round_num}. You are THE CASE AGAINST.

Topic: {topic}
Patient Context:
{context}

Debate history:
{chr(10).join(history[-4:])}

Respond to the supporting argument. Challenge new evidence, find weaknesses, propose alternatives. Be concise (1-2 paragraphs).

Do NOT use headers, JSON, or formatting. Write in plain clinical prose."""
                skep_text = llm.generate(skep_prompt)

            history.append(f"CASE AGAINST (Round {round_num}): {skep_text}")
            yield _event("against", skep_text, "speaking", round_num, extra={"label": f"Round {round_num}"})

            # Judge evaluation
            if judge_model == "human":
                yield _event("judge", "", "human_turn", round_num, extra={
                    "prompt": "Score this round and decide whether to continue.",
                    "type": "judge_evaluation"
                })
                human_text = _wait_for_human(session_id, "judge")
                if human_text is None:
                    break
                session = _sessions.get(session_id, {})
                human_input = session.get("last_human_input", {})
                delta = human_input.get("score_delta", 0)
                score += delta
                yield _event("judge", human_text or f"Score adjusted by {delta:+d}.", "speaking", round_num,
                             extra={"label": "Evaluation", "score_delta": delta, "total_score": score})
                if human_input.get("end_debate"):
                    winner = human_input.get("winner", "for" if score > 0 else "against" if score < 0 else "draw")
                    yield _event("judge", f"Winner declared: {'The Case For' if winner == 'for' else 'The Case Against' if winner == 'against' else 'Draw'}", "verdict", round_num,
                                 extra={"winner": winner, "total_score": score})
                    _cleanup_session(session_id)
                    return
            else:
                yield _event("judge", "", "thinking", round_num)
                judge_prompt = f"""You are the JUDGE in a clinical debate.

Topic: {topic}
Patient Context:
{context}

Full debate so far:
{chr(10).join(history)}

Evaluate Round {round_num}. Who made stronger arguments? Score this round from -5 (Case Against stronger) to +5 (Case For stronger). Running score: {score}.

Format your response as:
SCORE: [number]
[Your 1-2 sentence evaluation]

{"This is the FINAL round. Declare a winner: 'WINNER: Case For' or 'WINNER: Case Against' or 'DRAW'." if round_num == max_rounds else ""}

Do NOT use headers, JSON, or formatting beyond the SCORE line."""
                judge_text = llm.generate(judge_prompt)

                # Parse score
                delta = _parse_score(judge_text)
                score += delta
                history.append(f"JUDGE (Round {round_num}): {judge_text}")
                yield _event("judge", judge_text, "speaking", round_num,
                             extra={"label": "Evaluation", "score_delta": delta, "total_score": score})

        # Final verdict (if not already ended)
        if _sessions.get(session_id, {}).get("status") == "active":
            if judge_model == "human":
                yield _event("judge", "", "human_turn", max_rounds, extra={
                    "prompt": "Declare the winner of this debate.",
                    "type": "final_verdict"
                })
                human_text = _wait_for_human(session_id, "judge")
                session = _sessions.get(session_id, {})
                human_input = session.get("last_human_input", {})
                winner = human_input.get("winner", "for" if score > 0 else "against" if score < 0 else "draw")
            else:
                winner = "for" if score > 0 else "against" if score < 0 else "draw"

            yield _event("judge", f"Final Verdict: {'The Case For wins' if winner == 'for' else 'The Case Against wins' if winner == 'against' else 'Draw — no clear winner'}",
                         "verdict", max_rounds, extra={"winner": winner, "total_score": score})

        _cleanup_session(session_id)

    return StreamingResponse(generate(), media_type="text/event-stream")


@router.post("/human_turn")
def submit_human_turn(patient_id: str, req: HumanTurnRequest):
    """Submit a human player's turn during an active debate."""
    session = _sessions.get(req.session_id)
    if not session:
        raise HTTPException(404, "Debate session not found")

    session["human_input"] = req.text
    session["last_human_input"] = {
        "text": req.text,
        "score_delta": req.score_delta or 0,
        "end_debate": req.end_debate or False,
        "winner": req.winner,
    }
    return {"status": "ok"}


@router.post("/stop")
def stop_debate(patient_id: str, session_id: str):
    """Stop an active debate."""
    session = _sessions.get(session_id)
    if session:
        session["status"] = "stopped"
        session["human_input"] = "__STOP__"
    return {"status": "stopped"}


# ── Helpers ──────────────────────────────────────────────────────────

def _event(role: str, text: str, state: str, round_num: int,
           session_id: str = None, extra: dict = None) -> str:
    """Format an SSE event as JSON + newline."""
    data = {"role": role, "text": text, "state": state, "round": round_num}
    if session_id:
        data["session_id"] = session_id
    if extra:
        data.update(extra)
    return json.dumps(data) + "\n"


def _wait_for_human(session_id: str, role: str, timeout: int = 300) -> Optional[str]:
    """Block until human submits their turn, or timeout."""
    session = _sessions.get(session_id)
    if not session:
        return None

    session["human_input"] = None
    start = time.time()
    while time.time() - start < timeout:
        if session.get("status") != "active":
            return None
        if session["human_input"] is not None:
            text = session["human_input"]
            session["human_input"] = None
            if text == "__STOP__":
                return None
            return text
        time.sleep(0.3)
    return None


def _parse_score(text: str) -> int:
    """Extract SCORE: N from judge text."""
    import re
    match = re.search(r'SCORE:\s*([+-]?\d+)', text)
    if match:
        return max(-5, min(5, int(match.group(1))))
    return 0


def _cleanup_session(session_id: str):
    """Clean up a finished debate session."""
    if session_id in _sessions:
        _sessions[session_id]["status"] = "finished"
