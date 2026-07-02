from typing import Dict, Any, List
import json
from prism.engine.memory.graph import TemporalGraph
from prism.engine.reasoning.llm_client import LLMClient

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
        If divergences exist, it focuses on them. 
        Otherwise, it provides all raw extracted nodes.
        
        Supports both Prism-native properties ('text', 'source_doc')
        and application-specific properties ('label', 'kind').
        """
        divergences = self.graph.get_all_divergences()
        nodes = self.graph.get_all_nodes()
        
        context = f"Target Question: {question}\n\n"
        context += "=== Clinical Memory Context ===\n"
        
        if divergences:
            context += "Detected Divergences:\n"
            for d in divergences:
                claim_a = self.graph.get_node(d.claim_a_id)
                claim_b = self.graph.get_node(d.claim_b_id)
                
                text_a = (claim_a.properties.get('text') or claim_a.properties.get('label', 'Unknown')) if claim_a else "Unknown"
                src_a = (claim_a.properties.get('source_doc') or claim_a.properties.get('kind', 'Unknown')) if claim_a else "Unknown"
                
                text_b = (claim_b.properties.get('text') or claim_b.properties.get('label', 'Unknown')) if claim_b else "Unknown"
                src_b = (claim_b.properties.get('source_doc') or claim_b.properties.get('kind', 'Unknown')) if claim_b else "Unknown"
                
                context += f"- Topic: {d.topic}\n"
                context += f"  Claim A ({src_a}): {text_a}\n"
                context += f"  Claim B ({src_b}): {text_b}\n"
                context += "\n"
        elif nodes:
            context += "Patient Graph Nodes:\n"
            for n in nodes:
                # Support both Prism properties ('text', 'source_doc') and app properties ('label', 'kind')
                text = n.properties.get('text') or n.properties.get('label', n.id)
                kind = n.node_type or n.properties.get('kind', '')
                src = n.properties.get('source_doc', '')
                
                # Build a rich context line: [kind] label (source if available)
                parts = []
                if kind:
                    parts.append(f"[{kind}]")
                parts.append(text)
                if src:
                    parts.append(f"(from: {src})")
                context += f"- {' '.join(parts)}\n"
        else:
            context += "No memory data available. The graph is empty.\n"
            
        return context

    def analyze(self, question: str, persona_pack: str = "generic", rounds: int = 1, adjudication_mode: str = "force_winner") -> Dict[str, Any]:
        """
        Runs the adversarial analysis.
        Uses LLMClient to orchestrate the Advocate, Skeptic, and Judge.
        """
        
        # 1. Grounding
        context_prompt = self._build_context_prompt(question)
        
        # 2. Advocate Phase
        advocate_prompt = f"Context: {context_prompt}\nYou are the Advocate. Make your case."
        advocate_output = self.llm.generate_json(advocate_prompt)
        
        # 3. Skeptic Phase
        skeptic_prompt = f"Context: {context_prompt}\nAdvocate said: {json.dumps(advocate_output)}\nYou are the Skeptic. Challenge it."
        skeptic_output = self.llm.generate_json(skeptic_prompt)
        
        # 4. Judge Phase
        judge_prompt = f"Context: {context_prompt}\nAdvocate: {json.dumps(advocate_output)}\nSkeptic: {json.dumps(skeptic_output)}\nYou are the Judge. Adjudicate."
        judge_output = self.llm.generate_json(judge_prompt)

        return {
            "advocate": advocate_output,
            "skeptic": skeptic_output,
            "judge": judge_output
        }
