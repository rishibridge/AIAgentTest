"""Patient CRUD API routes."""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Dict, Any

router = APIRouter(prefix="/api/v1/patients", tags=["patients"])

# Forward reference — app.py injects the actual store
_store = None

def set_store(store):
    global _store
    _store = store


class CreatePatientRequest(BaseModel):
    name: str
    age: int = 0
    bio: str = ""
    bot_context: str = ""
    anonymous: bool = False
    excluded_content: List[str] = []
    locked_nodes: List[str] = []


@router.post("")
def create_patient(req: CreatePatientRequest):
    from ally.engine.patient_graph import Patient, PatientGraph
    import uuid
    patient = Patient(
        id=str(uuid.uuid4()),
        name=req.name,
        age=req.age,
        bio=req.bio,
        bot_context=req.bot_context,
        anonymous=req.anonymous,
        excluded_content=req.excluded_content,
        locked_nodes=req.locked_nodes,
    )
    pg = PatientGraph(patient)
    # Add self node
    pg.add_node(
        node_id=req.name.split()[0].lower(),
        label=req.name.split()[0],
        kind="self",
        size=30,
        x=550.0, y=310.0,
    )
    _store["firewall"].register_patient(pg)
    return {"id": patient.id, "name": patient.name}


@router.get("")
def list_patients():
    return _store["firewall"].list_patients()


@router.get("/{patient_id}")
def get_patient(patient_id: str):
    pg = _store["firewall"].get_patient_graph(patient_id)
    if not pg:
        raise HTTPException(404, "Patient not found")
    return pg.to_dict()


@router.delete("/{patient_id}")
def delete_patient(patient_id: str):
    if not _store["firewall"].remove_patient(patient_id):
        raise HTTPException(404, "Patient not found")
    return {"status": "deleted"}
