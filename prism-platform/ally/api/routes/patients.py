"""Patient CRUD API routes with persistence sync."""
import uuid
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Dict, Any

from ally.engine.persistence import delete_patient_record

router = APIRouter(prefix="/api/v1/patients", tags=["patients"])

_store = None


def set_store(store):
    global _store
    _store = store


def _save(pg) -> None:
    hook = _store.get("save_hook")
    if hook and pg:
        try:
            hook(pg)
        except Exception as e:
            print(f"[WARN] Patient save failed: {e}")


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

    clean_name = (req.name or "").strip()
    if not clean_name:
        raise HTTPException(400, "Patient name is required")

    patient = Patient(
        id=str(uuid.uuid4()),
        name=clean_name,
        age=req.age,
        bio=req.bio,
        bot_context=req.bot_context,
        anonymous=req.anonymous,
        excluded_content=req.excluded_content,
        locked_nodes=req.locked_nodes,
    )
    pg = PatientGraph(patient)
    pg.add_node(
        node_id=clean_name.split()[0].lower(),
        label=clean_name.split()[0],
        kind="self",
        size=30,
        x=550.0,
        y=310.0,
    )
    pg.graph_version = 1
    _store["firewall"].register_patient(pg)
    _save(pg)
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
    data_dir = _store.get("data_dir")
    if data_dir:
        delete_patient_record(patient_id, data_dir)
    else:
        delete_patient_record(patient_id)
    return {"status": "deleted"}
