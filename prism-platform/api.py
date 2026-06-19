import os
import sys
# Ensure Prism can be found
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import asyncio

from ally.engine.patient_graph import Patient, PatientGraph, ConversationMessage
from ally.engine.handoff_generator import HandoffGenerator
from ally.engine.clinician_engine import ClinicianEngine

app = FastAPI(title="Prism Clinician API")

# Enable CORS for the local React app
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For local dev
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory "database" for the demo
def _get_demo_graph() -> PatientGraph:
    patient = Patient(
        id="test_provider_handoff_01",
        name="Daniel P.",
        age=34,
        bio="Software engineer. Seeking support for work stress and relationship tension.",
        bot_context="Patient has chatted with the bot 3 times over the last week.",
        excluded_content=["Relapsed on alcohol last night.", "Bought a gun (though currently dismantled)"]
    )
    graph = PatientGraph(patient)
    graph.add_node("work_stress", "Work Stress", kind="symptom", size=18)
    graph.add_node("insomnia", "Insomnia", kind="symptom", size=16)
    graph.add_node("relationship_tension", "Fights with Wife", kind="event", size=14)
    graph.add_node("goal_better_sleep", "Wants to sleep 7 hours", kind="life", size=14)
    graph.add_node("secret_drinking", "Drinking alone", kind="undisclosed", size=14)
    
    graph.add_edge("work_stress", "insomnia", "Causes", weight=3)
    graph.add_edge("relationship_tension", "insomnia", "Worsens", weight=2)
    return graph

# Global graph for this demo session
_GLOBAL_GRAPH = _get_demo_graph()

# Clinician chat history
_CLINICIAN_HISTORY = []

@app.get("/api/handoff")
async def generate_handoff():
    """Generates the live handoff package using the ReasonEngine."""
    generator = HandoffGenerator()
    try:
        handoff, debate = generator.generate_handoff(
            patient_graph=_GLOBAL_GRAPH,
            recipient_name="Dr. Ramirez",
            recipient_role="Lead Psychiatrist",
            authorization_notes="Patient authorized full clinical sharing except undisclosed nodes."
        )
        return {
            "handoff": handoff.model_dump(),
            "debate": debate
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class ChatRequest(BaseModel):
    message: str
    role: str = "copilot" # "copilot", "advocate", "skeptic", "judge"

@app.post("/api/chat")
async def clinician_chat(req: ChatRequest):
    """Handles messages from the clinician, including DDx Arena roleplay."""
    engine = ClinicianEngine()
    
    # Add the clinician's message to history
    user_msg = ConversationMessage(sender="clinician", text=req.message)
    _CLINICIAN_HISTORY.append(user_msg)
    
    # Modify the prompt based on the chosen role
    system_instruction_override = None
    if req.role == "defend":
        # The user is proposing a diagnosis, the AI must challenge it
        user_msg.text = f"[DDX ARENA: I am defending a diagnosis. Rule it out.]\n{req.message}"
    elif req.role == "challenge":
        # The AI proposed a diagnosis, the user is challenging it
        user_msg.text = f"[DDX ARENA: I am challenging your primary diagnosis. Defend it with quotes.]\n{req.message}"
    elif req.role == "compare":
        # User is comparing A vs B
        user_msg.text = f"[DDX ARENA: Let's debate Hypothesis A vs Hypothesis B.]\n{req.message}"
    
    try:
        response = engine.generate_response(
            patient_graph=_GLOBAL_GRAPH,
            clinician_history=_CLINICIAN_HISTORY,
            clinician_message=user_msg.text
        )
        
        # Add bot response to history
        _CLINICIAN_HISTORY.append(ConversationMessage(sender="bot", text=response["text"]))
        
        return response
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("api:app", host="127.0.0.1", port=8000, reload=True)
