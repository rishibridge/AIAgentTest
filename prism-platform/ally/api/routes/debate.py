"""
DDx Clinical Debate — SSE streaming endpoint + persistent session & verdict storage (M13).
Streams adversarial debate turns (Case For / Case Against / Judge) as newline-delimited JSON events,
persists final verdicts onto PatientGraph.debates, updates matching divergences, and exposes retrieval endpoints.
"""
import json
import re
import time
import uuid
from datetime import datetime
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from ally.engine.patient_graph import DebateVerdictRecord

router = APIRouter(prefix="/api/v1/patients/{patient_id}/debate", tags=["debate"])

_store = None

# Active and recently completed debate sessions (for human turn coordination & session listing)
_sessions: Dict[str, Dict[str, Any]] = {}


def set_store(store):
    global _store
    _store = store


def _save(patient_id: str) -> None:
    hook = _store.get("save_hook")
    pg = _store["firewall"].get_patient_graph(patient_id)
    if hook and pg:
        try:
            hook(pg)
        except Exception as e:
            print(f"[WARN] Debate verdict save failed: {e}")


def _resolve_matching_divergence(pg, topic: str, divergence_id: Optional[str] = None) -> Optional[str]:
    """Mark matching divergence as resolved when a debate verdict is recorded (M13)."""
    if divergence_id and divergence_id in pg._divergences:
        pg._divergences[divergence_id].status = "resolved"
        pg.graph_version += 1
        return divergence_id

    topic_low = (topic or "").lower()
    for div_id, div in pg._divergences.items():
        div_topic_low = (div.topic or "").lower()
        if div_topic_low and (div_topic_low in topic_low or any(w in topic_low for w in div_topic_low.split() if len(w) >= 6)):
            if div.status != "resolved":
                div.status = "resolved"
                pg.graph_version += 1
            return div_id
    return None


def _persist_verdict(
    patient_id: str,
    session_id: str,
    topic: str,
    judge_type: str,
    judge_name: str,
    verdict_text: str,
    winner: str,
    score: int,
    round_num: int,
    history: List[str],
    divergence_id: Optional[str] = None,
) -> Optional[DebateVerdictRecord]:
    pg = _store["firewall"].get_patient_graph(patient_id)
    if not pg:
        return None

    # Deduplicate if already persisted for this session_id
    for existing in pg.debates:
        if existing.session_id == session_id:
            existing.verdict_text = verdict_text
            existing.winning_position = winner
            existing.score = score
            existing.rounds_count = round_num
            existing.judged_output = list(history)
            _save(patient_id)
            return existing

    resolved_div_id = _resolve_matching_divergence(pg, topic, divergence_id)
    rec = DebateVerdictRecord(
        session_id=session_id,
        patient_id=patient_id,
        topic=topic,
        judge_type=judge_type,
        judge_name=judge_name,
        verdict_text=verdict_text,
        winning_position=winner,
        score=score,
        resolved_divergence_id=resolved_div_id,
        rounds_count=round_num,
        judged_output=list(history),
        timestamp=datetime.utcnow().isoformat() + "Z",
    )
    pg.debates.append(rec)
    _save(patient_id)
    return rec


class HumanTurnRequest(BaseModel):
    session_id: str
    role: str  # 'for', 'against', or 'judge'
    text: str
    score_delta: Optional[int] = None  # For judge: -5 to +5
    end_debate: Optional[bool] = False
    winner: Optional[str] = None  # 'for', 'against', or 'draw'
    divergence_id: Optional[str] = None


class DirectVerdictRequest(BaseModel):
    topic: str
    verdict_text: Optional[str] = None
    rationale: Optional[str] = None
    winning_position: Optional[str] = None
    winner: Optional[str] = None
    judge_type: str = "human"
    judge_name: str = "Attending Clinician"
    score: int = 0
    rounds_count: Optional[int] = None
    round: Optional[int] = None
    judged_output: List[str] = []
    session_id: Optional[str] = None
    divergence_id: Optional[str] = None


@router.get("/verdicts")
def list_debate_verdicts(patient_id: str):
    """Retrieve all persisted debate verdicts for a patient (M13)."""
    pg = _store["firewall"].get_patient_graph(patient_id)
    if not pg:
        raise HTTPException(404, "Patient not found")
    verdicts = [d.model_dump() for d in getattr(pg, "debates", [])]
    return {
        "patient_id": patient_id,
        "verdict_count": len(verdicts),
        "verdicts": list(reversed(verdicts)),
    }


@router.post("/verdicts")
def record_direct_verdict(patient_id: str, req: DirectVerdictRequest):
    """Directly persist a clinical debate verdict and resolve any linked divergence (M13)."""
    pg = _store["firewall"].get_patient_graph(patient_id)
    if not pg:
        raise HTTPException(404, "Patient not found")
    session_id = req.session_id or f"direct_{uuid.uuid4().hex[:6]}"
    resolved_text = req.verdict_text or req.rationale or "Clinician verdict recorded."
    resolved_winner = req.winning_position or req.winner or "for"
    resolved_rounds = req.rounds_count if req.rounds_count is not None else (req.round if req.round is not None else 1)
    rec = _persist_verdict(
        patient_id=patient_id,
        session_id=session_id,
        topic=req.topic,
        judge_type=req.judge_type,
        judge_name=req.judge_name,
        verdict_text=resolved_text,
        winner=resolved_winner,
        score=req.score,
        round_num=resolved_rounds,
        history=req.judged_output,
        divergence_id=req.divergence_id,
    )
    return {"status": "persisted", "verdict": rec.model_dump() if rec else None}


@router.get("/sessions")
def list_debate_sessions(patient_id: str):
    """List active and completed debate sessions for this patient (M13)."""
    pg = _store["firewall"].get_patient_graph(patient_id)
    if not pg:
        raise HTTPException(404, "Patient not found")
    items = [
        {
            "session_id": sid,
            "topic": s.get("topic", ""),
            "status": s.get("status", "unknown"),
            "round": s.get("round", 0),
            "score": s.get("score", 0),
            "judge_model": s.get("judge_model", "human"),
            "started_at": s.get("started_at", ""),
        }
        for sid, s in _sessions.items()
        if s.get("patient_id") == patient_id
    ]
    return {"patient_id": patient_id, "sessions": items}


@router.get("/stream")
def stream_debate(
    patient_id: str,
    request: Request,
    topic: str = "What is the primary diagnosis?",
    for_model: str = "ai",
    against_model: str = "ai",
    judge_model: str = "human",
    max_rounds: int = 3,
    divergence_id: Optional[str] = None,
):
    """
    SSE streaming debate endpoint.
    Streams JSON events: {role, text, round, state, score_delta?, session_id?}
    Persists final verdict to PatientGraph.debates (M13).
    """
    pg = _store["firewall"].get_patient_graph(patient_id)
    if not pg:
        raise HTTPException(404, "Patient not found")

    rounds_cap = max(1, min(3, int(max_rounds)))
    session_id = str(uuid.uuid4())[:8]
    _sessions[session_id] = {
        "patient_id": patient_id,
        "topic": topic,
        "divergence_id": divergence_id,
        "judge_model": judge_model,
        "status": "active",
        "round": 0,
        "score": 0,
        "human_input": None,
        "history": [],
        "started_at": datetime.utcnow().isoformat() + "Z",
    }

    def generate():
        llm = _store["llm"]
        clinician_engine = _store["clinician_engine"]
        context = clinician_engine._build_clinical_context(pg, [])

        history = _sessions[session_id]["history"]
        score = 0

        yield _event("system", f"DDx Debate: {topic}", "start", 0, session_id=session_id)
        yield _event("system", f"Patient: {pg.patient.name}", "info", 0)
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

        last_judge_text = ""

        for round_num in range(1, rounds_cap + 1):
            if _sessions.get(session_id, {}).get("status") != "active":
                break
            _sessions[session_id]["round"] = round_num

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
                    "type": "judge_evaluation",
                })
                human_text = _wait_for_human(session_id, "judge")
                if human_text is None:
                    break
                session = _sessions.get(session_id, {})
                human_input = session.get("last_human_input", {})
                delta = human_input.get("score_delta", 0)
                score += delta
                _sessions[session_id]["score"] = score
                last_judge_text = human_text or f"Score adjusted by {delta:+d}."
                history.append(f"HUMAN JUDGE (Round {round_num}): {last_judge_text}")
                yield _event(
                    "judge",
                    last_judge_text,
                    "speaking",
                    round_num,
                    extra={"label": "Evaluation", "score_delta": delta, "total_score": score},
                )
                if human_input.get("end_debate"):
                    winner = human_input.get("winner") or ("for" if score > 0 else "against" if score < 0 else "draw")
                    verdict_msg = f"Winner declared: {'The Case For' if winner == 'for' else 'The Case Against' if winner == 'against' else 'Draw'}. {last_judge_text}"
                    rec = _persist_verdict(
                        patient_id=patient_id,
                        session_id=session_id,
                        topic=topic,
                        judge_type="human",
                        judge_name="Attending Clinician",
                        verdict_text=verdict_msg,
                        winner=winner,
                        score=score,
                        round_num=round_num,
                        history=history,
                        divergence_id=human_input.get("divergence_id") or divergence_id,
                    )
                    yield _event(
                        "judge",
                        verdict_msg,
                        "verdict",
                        round_num,
                        extra={
                            "winner": winner,
                            "total_score": score,
                            "verdict_id": rec.id if rec else None,
                            "resolved_divergence_id": rec.resolved_divergence_id if rec else None,
                        },
                    )
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

{"This is the FINAL round. Declare a winner: 'WINNER: Case For' or 'WINNER: Case Against' or 'DRAW'." if round_num == rounds_cap else ""}

Do NOT use headers, JSON, or formatting beyond the SCORE line."""
                judge_text = llm.generate(judge_prompt)
                delta = _parse_score(judge_text)
                score += delta
                _sessions[session_id]["score"] = score
                last_judge_text = judge_text
                history.append(f"JUDGE (Round {round_num}): {judge_text}")
                yield _event(
                    "judge",
                    judge_text,
                    "speaking",
                    round_num,
                    extra={"label": "Evaluation", "score_delta": delta, "total_score": score},
                )

        if _sessions.get(session_id, {}).get("status") == "active":
            if judge_model == "human":
                yield _event("judge", "", "human_turn", rounds_cap, extra={
                    "prompt": "Declare the winner of this debate.",
                    "type": "final_verdict",
                })
                human_text = _wait_for_human(session_id, "judge")
                session = _sessions.get(session_id, {})
                human_input = session.get("last_human_input", {})
                winner = human_input.get("winner") or ("for" if score > 0 else "against" if score < 0 else "draw")
                if human_text:
                    last_judge_text = human_text
            else:
                winner = "for" if score > 0 else "against" if score < 0 else "draw"

            verdict_summary = (
                f"Final Verdict: {'The Case For wins' if winner == 'for' else 'The Case Against wins' if winner == 'against' else 'Draw — no clear winner'}"
                + (f" — {last_judge_text}" if last_judge_text else "")
            )
            rec = _persist_verdict(
                patient_id=patient_id,
                session_id=session_id,
                topic=topic,
                judge_type="human" if judge_model == "human" else "ai",
                judge_name="Attending Clinician" if judge_model == "human" else "AI Medical Arbiter",
                verdict_text=verdict_summary,
                winner=winner,
                score=score,
                round_num=rounds_cap,
                history=history,
                divergence_id=divergence_id,
            )
            yield _event(
                "judge",
                verdict_summary,
                "verdict",
                rounds_cap,
                extra={
                    "winner": winner,
                    "total_score": score,
                    "verdict_id": rec.id if rec else None,
                    "resolved_divergence_id": rec.resolved_divergence_id if rec else None,
                },
            )

        _cleanup_session(session_id)

    return StreamingResponse(generate(), media_type="text/event-stream")


@router.post("/human_turn")
def submit_human_turn(patient_id: str, req: HumanTurnRequest):
    """Submit a human player's turn during an active debate, persisting verdict immediately if concluding (M13)."""
    session = _sessions.get(req.session_id)
    if not session:
        raise HTTPException(404, "Debate session not found")

    session["human_input"] = req.text
    session["last_human_input"] = {
        "text": req.text,
        "score_delta": req.score_delta or 0,
        "end_debate": req.end_debate or False,
        "winner": req.winner,
        "divergence_id": req.divergence_id,
    }

    persisted_verdict = None
    if req.role == "judge" and (req.end_debate or req.winner):
        running_score = session.get("score", 0) + (req.score_delta or 0)
        winner = req.winner or ("for" if running_score > 0 else "against" if running_score < 0 else "draw")
        rec = _persist_verdict(
            patient_id=patient_id,
            session_id=req.session_id,
            topic=session.get("topic", "Clinical Debate"),
            judge_type="human",
            judge_name="Attending Clinician",
            verdict_text=req.text or f"Winner declared: {winner}",
            winner=winner,
            score=running_score,
            round_num=session.get("round", 1),
            history=session.get("history", []),
            divergence_id=req.divergence_id or session.get("divergence_id"),
        )
        if rec:
            persisted_verdict = rec.model_dump()

    return {"status": "ok", "verdict": persisted_verdict}


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
        time.sleep(0.2)
    return None


def _parse_score(text: str) -> int:
    """Extract SCORE: N from judge text."""
    match = re.search(r"SCORE:\s*([+-]?\d+)", text)
    if match:
        return max(-5, min(5, int(match.group(1))))
    return 0


def _cleanup_session(session_id: str):
    """Mark debate session finished while preserving metadata in _sessions for audit listing."""
    if session_id in _sessions:
        _sessions[session_id]["status"] = "finished"
