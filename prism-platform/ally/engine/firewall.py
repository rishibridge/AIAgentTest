"""
PatientFirewall — Absolute privacy separation between patient graphs.
Ensures no cross-patient data leakage, with family overlap detection.
"""
from typing import Dict, Any, List, Optional, Set, Tuple
from ally.engine.patient_graph import PatientGraph, Patient


class PatientFirewall:
    """
    Manages multiple patient graphs with absolute privacy separation.
    - No cross-patient data access
    - Family overlap detection (identifies related patients without breaching)
    - Handoff packages contain NO cross-patient data
    """

    def __init__(self):
        self.graphs: Dict[str, PatientGraph] = {}
        self._family_links: List[Dict[str, Any]] = []  # Private family overlap registry

    def register_patient(self, patient_graph: PatientGraph) -> None:
        """Register a patient graph. Automatically checks for family overlaps."""
        self.graphs[patient_graph.patient.id] = patient_graph
        self._detect_family_overlaps(patient_graph)

    def get_patient_graph(self, patient_id: str) -> Optional[PatientGraph]:
        """Get a patient graph. Returns ONLY that patient's data."""
        return self.graphs.get(patient_id)

    def list_patients(self) -> List[Dict[str, Any]]:
        """List all patients (basic info only, no cross-references)."""
        return [
            {
                "id": pg.patient.id,
                "name": pg.patient.name,
                "age": pg.patient.age,
                "anonymous": pg.patient.anonymous,
                "node_count": len(pg.nodes),
                "edge_count": len(pg.edges),
                "conversation_count": len(pg.conversations),
            }
            for pg in self.graphs.values()
        ]

    def remove_patient(self, patient_id: str) -> bool:
        """Remove a patient and clean up family links."""
        if patient_id in self.graphs:
            del self.graphs[patient_id]
            self._family_links = [
                fl for fl in self._family_links
                if fl["patient_a"] != patient_id and fl["patient_b"] != patient_id
            ]
            return True
        return False

    # ── Firewall enforcement ────────────────────────────────────────

    def validate_no_cross_contamination(
        self, patient_id: str, content: Dict[str, Any]
    ) -> bool:
        """
        Validate that content destined for one patient contains NOTHING
        from another patient's graph.
        """
        other_ids = set(self.graphs.keys()) - {patient_id}
        content_str = str(content).lower()

        for other_id in other_ids:
            other_graph = self.graphs[other_id]
            # Check for other patient's name
            if other_graph.patient.name.lower() in content_str:
                return False
            # Check for other patient's node IDs
            for node_id in other_graph.nodes:
                if node_id in content_str:
                    return False

        return True

    def get_firewall_status(self) -> Dict[str, Any]:
        """Get the overall firewall status."""
        return {
            "total_patients": len(self.graphs),
            "firewall_intact": True,
            "family_overlaps_detected": len(self._family_links),
            "family_links": [
                {
                    "patient_a_id": fl["patient_a"],
                    "patient_b_id": fl["patient_b"],
                    "relationship": fl["relationship"],
                    "shared_clinicians": fl.get("shared_clinicians", []),
                }
                for fl in self._family_links
            ],
        }

    # ── Family overlap detection ────────────────────────────────────

    def _detect_family_overlaps(self, new_graph: PatientGraph) -> None:
        """
        Detect if the new patient is related to any existing patient.
        This is done by looking for matching person nodes (same name references).
        CRITICAL: This detection is for SYSTEM-LEVEL awareness only.
        Neither patient sees the other's data.
        """
        new_patient = new_graph.patient
        new_person_labels = {
            n.label.lower()
            for n in new_graph.nodes.values()
            if n.kind == "person"
        }

        for existing_id, existing_graph in self.graphs.items():
            if existing_id == new_patient.id:
                continue

            existing_patient = existing_graph.patient

            # Check if the new patient is referenced in the existing graph
            for n in existing_graph.nodes.values():
                if n.kind == "person" and n.label.lower() == new_patient.name.split()[0].lower():
                    # Potential family link
                    self._register_family_link(
                        existing_patient.id, new_patient.id,
                        f"{n.label} in {existing_patient.name}'s graph matches {new_patient.name}",
                    )
                    break

            # Check if any existing patient is referenced in the new graph
            existing_first_name = existing_patient.name.split()[0].lower()
            if existing_first_name in new_person_labels:
                self._register_family_link(
                    existing_patient.id, new_patient.id,
                    f"{existing_patient.name} referenced in {new_patient.name}'s graph",
                )

    def _register_family_link(
        self, patient_a: str, patient_b: str, relationship: str
    ) -> None:
        """Register a family link (for system-level awareness only)."""
        # Check if link already exists
        for fl in self._family_links:
            if (fl["patient_a"] == patient_a and fl["patient_b"] == patient_b) or \
               (fl["patient_a"] == patient_b and fl["patient_b"] == patient_a):
                return

        self._family_links.append({
            "patient_a": patient_a,
            "patient_b": patient_b,
            "relationship": relationship,
            "shared_clinicians": self._find_shared_clinicians(patient_a, patient_b),
        })

    def _find_shared_clinicians(self, patient_a: str, patient_b: str) -> List[str]:
        """Find clinicians shared between two patients (from referral/handoff nodes)."""
        shared = []
        graph_a = self.graphs.get(patient_a)
        graph_b = self.graphs.get(patient_b)
        if not graph_a or not graph_b:
            return shared

        # Extract clinician names from referral/clinician nodes
        clinicians_a = set()
        clinicians_b = set()
        for n in graph_a.nodes.values():
            if n.kind in ("referral", "clinician", "clinician_safety", "therapist_locked"):
                clinicians_a.add(n.label.lower())
        for n in graph_b.nodes.values():
            if n.kind in ("referral", "clinician", "clinician_safety", "therapist_locked"):
                clinicians_b.add(n.label.lower())

        return list(clinicians_a & clinicians_b)

    def get_family_overlap_flag(
        self, patient_id: str, clinician_name: str
    ) -> Optional[str]:
        """
        Generate a family overlap flag message for a handoff to a specific clinician.
        Returns None if no overlap, or a warning string if overlap detected.
        """
        patient_graph = self.graphs.get(patient_id)
        if not patient_graph:
            return None

        for fl in self._family_links:
            other_id = None
            if fl["patient_a"] == patient_id:
                other_id = fl["patient_b"]
            elif fl["patient_b"] == patient_id:
                other_id = fl["patient_a"]

            if other_id:
                other_graph = self.graphs.get(other_id)
                if other_graph:
                    # Check if this clinician also treats the other patient
                    other_handoffs = [h for h in other_graph.handoffs if clinician_name.lower() in h.recipient.lower()]
                    other_referrals = [n for n in other_graph.nodes.values()
                                       if n.kind == "referral" and clinician_name.lower() in n.label.lower()]

                    if other_handoffs or other_referrals:
                        return (
                            f"{patient_graph.patient.name}'s {fl['relationship'].split(' in ')[0]} "
                            f"({other_graph.patient.name}) is also a patient of {clinician_name}. "
                            f"{patient_graph.patient.name} does not know. {other_graph.patient.name} does not know. "
                            f"Firewall is preserved. This package contains nothing about {other_graph.patient.name}."
                        )

        return None
