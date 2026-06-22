"""
Ally API — FastAPI application for the Castle Behavioral Health Companion.
Runs on port 8001 (separate from Prism on 8000).
"""
import sys
import os

# Add parent to path for prism imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from prism.engine.reasoning.llm_client import LLMClient
from ally.engine.firewall import PatientFirewall
from ally.engine.conversation_engine import ConversationEngine
from ally.engine.consolidation import ConsolidationEngine
from ally.engine.handoff_generator import HandoffGenerator
from ally.engine.clinician_engine import ClinicianEngine
from ally.engine.persistence import save_patient, save_all, load_all, DEFAULT_DATA_DIR

from ally.api.routes import patients, conversations, graphs, consolidation, handoffs, clinician

app = FastAPI(
    title="Ally API",
    description="Castle Behavioral Health Companion — AI-powered patient engagement with persistent graph memory",
    version="1.0.0",
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Initialize shared services ──────────────────────────────────────
llm = LLMClient(mock=False)

store = {
    "firewall": PatientFirewall(),
    "conversation_engine": ConversationEngine(llm_client=llm),
    "llm": llm,  # Expose LLM so routes can create per-patient GraphBuilders
    "consolidation_engine": ConsolidationEngine(llm_client=llm),
    "handoff_generator": HandoffGenerator(llm_client=llm),
    "clinician_engine": ClinicianEngine(llm_client=llm),
    "save_hook": lambda pg: save_patient(pg, DEFAULT_DATA_DIR),
    "data_dir": DEFAULT_DATA_DIR,
}

# ── Inject store into route modules ────────────────────────────────
patients.set_store(store)
conversations.set_store(store)
graphs.set_store(store)
consolidation.set_store(store)
handoffs.set_store(store)
clinician.set_store(store)

# ── Register routers ───────────────────────────────────────────────
app.include_router(patients.router)
app.include_router(conversations.router)
app.include_router(graphs.router)
app.include_router(consolidation.router)
app.include_router(handoffs.router)
app.include_router(clinician.router)


@app.get("/api")
def api_root():
    return {
        "name": "Ally API",
        "description": "Castle Behavioral Health Companion",
        "version": "1.0.0",
        "endpoints": {
            "patients": "/api/v1/patients",
            "conversations": "/api/v1/patients/{id}/conversations",
            "graph": "/api/v1/patients/{id}/graph",
            "consolidation": "/api/v1/patients/{id}/consolidation",
            "handoffs": "/api/v1/patients/{id}/handoffs",
            "clinician_chat": "/api/v1/patients/{id}/clinician/messages",
            "clinician_handoff": "/api/v1/patients/{id}/clinician/handoff",
        },
    }


@app.get("/api/v1/health")
def health():
    return {"status": "healthy", "firewall": store["firewall"].get_firewall_status()}


@app.on_event("startup")
def load_or_seed_data():
    """
    On startup: check if ally/data/ has saved JSON files → load them.
    If empty or missing → run seed + save to disk.
    """
    loaded_firewall = load_all(DEFAULT_DATA_DIR)

    if loaded_firewall and loaded_firewall.graphs:
        # Load succeeded — replace the empty firewall with the loaded one
        store["firewall"] = loaded_firewall
        # Re-inject updated store into all route modules
        _reinject_store()
        patient_names = [pg.patient.name for pg in loaded_firewall.graphs.values()]
        print(f"[OK] Loaded {len(loaded_firewall.graphs)} patients from disk: {', '.join(patient_names)}")
    else:
        # No saved data — seed demo data and save
        from ally.seed import seed_elena_and_daniel
        seed_elena_and_daniel(store["firewall"])
        count = save_all(store["firewall"], DEFAULT_DATA_DIR)
        print(f"[OK] Ally demo data seeded and saved to disk: {count} patients")


def _reinject_store():
    """Re-inject store into all route modules after firewall replacement."""
    patients.set_store(store)
    conversations.set_store(store)
    graphs.set_store(store)
    consolidation.set_store(store)
    handoffs.set_store(store)
    clinician.set_store(store)

from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import os

ui_dist = os.path.join(os.path.dirname(__file__), "..", "ui", "dist")
if os.path.isdir(ui_dist):
    app.mount("/assets", StaticFiles(directory=os.path.join(ui_dist, "assets")), name="assets")
    
    @app.get("/{full_path:path}")
    def serve_react_app(full_path: str):
        return FileResponse(os.path.join(ui_dist, "index.html"))
