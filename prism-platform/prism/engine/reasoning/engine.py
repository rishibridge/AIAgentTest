from typing import Dict, Any, List
import json
from prism.engine.memory.graph import TemporalGraph
from prism.engine.reasoning.llm_client import LLMClient


def _to_clean_str(val: Any, fallback: str = "") -> str:
    if isinstance(val, str):
        return val.replace("\n", " ").strip()
    if isinstance(val, dict):
        inner = val.get("text") or val.get("label") or fallback or json.dumps(val, ensure_ascii=False)
        return str(inner).replace("\n", " ").strip()
    if val is None:
        return fallback
    return str(val).replace("\n", " ").strip()


class ReasoningEngine:
    """
    Multi-round adversarial reasoning engine.
    Orchestrates Advocate, Skeptic, and Judge.
    """
    def __init__(self, graph: TemporalGraph, llm_client: LLMClient = None):
        self.graph = graph
        self.llm = llm_client or LLMClient(mock=True)

    def _build_context_prompt(self, question: str) -> str:
        """
        Builds the context string from the TemporalGraph memory.
        Includes BOTH detected divergences AND raw extracted patient graph nodes
        so seeding divergences never hides the underlying graph nodes.
        Safely coerces any non-string node properties to strings (H1/H5).
        """
        divergences = self.graph.get_all_divergences()
        nodes = self.graph.get_all_nodes()

        context = f"Target Question: {question}\n\n"
        context += "=== Clinical Memory Context ===\n"

        if not divergences and not nodes:
            context += "No memory data available. The graph is empty.\n"
            return context

        if divergences:
            context += "Detected Divergences:\n"
            for d in divergences:
                claim_a = self.graph.get_node(d.claim_a_id)
                claim_b = self.graph.get_node(d.claim_b_id)

                text_a = _to_clean_str(
                    (claim_a.properties.get("text") or claim_a.properties.get("label")) if claim_a else None,
                    fallback="Unknown",
                )
                src_a = _to_clean_str(
                    (claim_a.properties.get("source_doc") or claim_a.properties.get("kind")) if claim_a else None,
                    fallback="Unknown",
                )

                text_b = _to_clean_str(
                    (claim_b.properties.get("text") or claim_b.properties.get("label")) if claim_b else None,
                    fallback="Unknown",
                )
                src_b = _to_clean_str(
                    (claim_b.properties.get("source_doc") or claim_b.properties.get("kind")) if claim_b else None,
                    fallback="Unknown",
                )

                context += f"- Topic: {_to_clean_str(d.topic, 'Divergence')}\n"
                context += f"  Claim A ({src_a}): {text_a}\n"
                context += f"  Claim B ({src_b}): {text_b}\n\n"

        if nodes:
            context += "Patient Graph Nodes:\n"
            for n in nodes:
                raw_text = n.properties.get("text") or n.properties.get("label") or n.id
                text = _to_clean_str(raw_text, fallback=str(n.id))
                kind = _to_clean_str(n.node_type or n.properties.get("kind", ""))
                src = _to_clean_str(n.properties.get("source_doc", ""))

                parts: List[str] = [f"(id={n.id})"]
                if kind:
                    parts.append(f"[{kind}]")
                parts.append(text)
                if src:
                    parts.append(f"(from: {src})")
                context += f"- {' '.join(parts)}\n"

        return context

    def analyze(
        self,
        question: str,
        persona_pack: str = "generic",
        rounds: int = 1,
        adjudication_mode: str = "force_winner",
        strict: bool = False,
    ) -> Dict[str, Any]:
        """
        Runs the adversarial analysis.
        Uses LLMClient to orchestrate the Advocate, Skeptic, and Judge.
        """
        # 1. Grounding
        context_prompt = self._build_context_prompt(question)

        # 2. Advocate Phase
        advocate_prompt = f"Context: {context_prompt}\nYou are the Advocate. Make your case as a JSON object."
        advocate_output = self.llm.generate_json(advocate_prompt, strict=strict)

        # 3. Skeptic Phase
        skeptic_prompt = (
            f"Context: {context_prompt}\n"
            f"Advocate said: {json.dumps(advocate_output)}\n"
            "You are the Skeptic. Challenge it as a JSON object."
        )
        skeptic_output = self.llm.generate_json(skeptic_prompt, strict=strict)

        # 4. Judge Phase
        judge_prompt = (
            f"Context: {context_prompt}\n"
            f"Advocate: {json.dumps(advocate_output)}\n"
            f"Skeptic: {json.dumps(skeptic_output)}\n"
            "You are the Judge. Adjudicate strictly following the Judge output JSON schema requested in Target Question."
        )
        judge_output = self.llm.generate_json(judge_prompt, strict=strict)

        return {
            "advocate": advocate_output,
            "skeptic": skeptic_output,
            "judge": judge_output,
        }
