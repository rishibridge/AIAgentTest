from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Any

from prism.engine.memory.graph import TemporalGraph
from prism.engine.reasoning.engine import ReasoningEngine

app = FastAPI(title="Prism API")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins for development
    allow_credentials=False,
    allow_methods=["*"],  # Allows all methods
    allow_headers=["*"],  # Allows all headers
)

# In-memory store for MVP
sessions: Dict[str, TemporalGraph] = {}

class AnalyzeRequest(BaseModel):
    session_id: str
    question: str
    persona_pack: str = "generic"
    rounds: int = 1
    adjudication_mode: str = "force_winner"

class AnalyzeResponse(BaseModel):
    advocate: Dict[str, Any]
    skeptic: Dict[str, Any]
    judge: Dict[str, Any]

@app.post("/api/v1/sessions/create")
def create_session() -> Dict[str, str]:
    import uuid
    session_id = str(uuid.uuid4())
    sessions[session_id] = TemporalGraph()
    return {"session_id": session_id}

@app.post("/api/v1/sessions/upload")
async def upload_document(session_id: str = Form(...), file: UploadFile = File(...)):
    import os
    import tempfile
    
    graph = sessions.get(session_id)
    if not graph:
        # Create one if missing for demo purposes
        graph = TemporalGraph()
        sessions[session_id] = graph
        
    # Save the file to a temporary location
    temp_dir = tempfile.gettempdir()
    temp_path = os.path.join(temp_dir, file.filename)
    
    content = await file.read()
    with open(temp_path, "wb") as f:
        f.write(content)
        
    try:
        from prism.engine.memory.extractor import DocumentExtractor
        from prism.engine.reasoning.llm_client import LLMClient
        from crux.domain.medical_nlp import MedicalNLP
        
        # Initialize clients
        llm = LLMClient(mock=False)
        extractor = DocumentExtractor(graph, llm_client=llm)
        nlp = MedicalNLP(llm_client=llm)
        
        # Run generic memory extraction using Gemini File API
        result = extractor.ingest_file(temp_path, source_name=file.filename)
        
        # Run CRUX Medical NLP using Gemini File API
        events = nlp.extract_events_from_file(temp_path)
        for event in events:
            graph.add_node("crux_medical_event", {
                "text": event.get("concept"),
                "source_doc": file.filename,
                "entity_type": event.get("type"),
                "provider": event.get("provider", "Unknown")
            })
            
    finally:
        # Clean up temporary file
        if os.path.exists(temp_path):
            os.remove(temp_path)
            
    return result

transcripts: Dict[str, Any] = {}

@app.post("/api/v1/reasoning/analyze", response_model=AnalyzeResponse)
def analyze(req: AnalyzeRequest):
    graph = sessions.get(req.session_id)
    if not graph:
        # Fallback to a mock graph for testing if session doesn't exist
        graph = TemporalGraph()
        
    from prism.engine.reasoning.llm_client import LLMClient
    
    # Initialize engine with REAL LLM Client (mock=False)
    llm = LLMClient(mock=False)
    engine = ReasoningEngine(graph, llm_client=llm)
    
    result = engine.analyze(
        question=req.question,
        persona_pack=req.persona_pack,
        rounds=req.rounds,
        adjudication_mode=req.adjudication_mode
    )
    
    # Save transcript for reasoning viewer
    transcripts[req.session_id] = result
    
    return result

@app.get("/api/v1/sessions/{session_id}/memory")
def get_memory(session_id: str):
    graph = sessions.get(session_id)
    if not graph:
        return {"nodes": [], "edges": []}
    
    nodes = [{"id": n.id, "type": n.node_type, "properties": n.properties} for n in graph.get_all_nodes()]
    edges = [{"id": getattr(e, 'id', 'unknown'), "source": e.source, "target": e.target, "type": e.edge_type} for _, e in graph._graph.edges(data=True) if hasattr(e, 'source')]
    
    return {"nodes": nodes, "edges": edges}

@app.get("/api/v1/sessions/{session_id}/transcript")
def get_transcript(session_id: str):
    return transcripts.get(session_id, {})
