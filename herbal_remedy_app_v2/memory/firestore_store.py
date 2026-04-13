"""
Remy Hippocampus — Firestore Persistence
Load and save all memory layers to Google Firestore.
Falls back to local JSON files when Firestore is unavailable.
"""
import json
import os
import logging
from datetime import datetime, timezone

log = logging.getLogger("remy.firestore")

# Try to import Firestore — graceful fallback if not available
try:
    from google.cloud import firestore as firestore_module
    FIRESTORE_AVAILABLE = True
except ImportError:
    FIRESTORE_AVAILABLE = False
    log.warning("google-cloud-firestore not installed. Using local file storage.")


class FirestoreStore:
    """
    Persistence layer — stores memory in Firestore (GCP) with local JSON fallback.
    """

    def __init__(self, project_id: str = None, local_dir: str = None):
        self.db = None
        self.local_dir = local_dir or os.path.join(
            os.path.dirname(os.path.dirname(__file__)), "memory_data"
        )

        if FIRESTORE_AVAILABLE:
            try:
                self.db = firestore_module.Client(project=project_id)
                log.info(f"Connected to Firestore: {self.db.project}")
            except Exception as e:
                log.warning(f"Firestore connection failed: {e}. Using local storage.")
                self.db = None

        if not self.db:
            os.makedirs(self.local_dir, exist_ok=True)
            log.info(f"Using local file storage: {self.local_dir}")

    # ── User Management ────────────────────────────────────

    def get_user_by_token(self, token: str) -> dict | None:
        """Look up a user by their auth token."""
        if self.db:
            docs = (self.db.collection("users")
                    .where("token", "==", token)
                    .limit(1)
                    .get())
            for doc in docs:
                data = doc.to_dict()
                data["user_id"] = doc.id
                return data
            return None
        else:
            return self._local_get_user_by_token(token)

    def get_user_by_email(self, email: str) -> dict | None:
        """Look up a user by email."""
        if self.db:
            docs = (self.db.collection("users")
                    .where("email", "==", email.lower().strip())
                    .limit(1)
                    .get())
            for doc in docs:
                data = doc.to_dict()
                data["user_id"] = doc.id
                return data
            return None
        else:
            return self._local_get_user_by_email(email)

    def create_user(self, email: str, token: str) -> str:
        """Create a new user. Returns user_id."""
        user_data = {
            "email": email.lower().strip(),
            "token": token,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "last_seen": datetime.now(timezone.utc).isoformat(),
        }

        if self.db:
            doc_ref = self.db.collection("users").document()
            doc_ref.set(user_data)
            return doc_ref.id
        else:
            return self._local_create_user(email, token, user_data)

    def update_user_last_seen(self, user_id: str):
        """Update the last_seen timestamp."""
        if self.db:
            self.db.collection("users").document(user_id).update({
                "last_seen": datetime.now(timezone.utc).isoformat(),
            })
        else:
            self._local_update_last_seen(user_id)

    # ── Memory Load/Save ───────────────────────────────────

    def load_user_memory(self, user_id: str) -> dict:
        """
        Load all memory data for a user.
        Returns: {semantic: dict, episodic: list, associations: dict}
        """
        if self.db:
            return self._firestore_load(user_id)
        else:
            return self._local_load(user_id)

    def save_user_memory(self, user_id: str, memory_data: dict):
        """
        Save all memory data for a user.
        memory_data: {semantic: dict, episodic: list, associations: dict}
        """
        if self.db:
            self._firestore_save(user_id, memory_data)
        else:
            self._local_save(user_id, memory_data)

    # ── Firestore Implementation ───────────────────────────

    def _firestore_load(self, user_id: str) -> dict:
        """Load from Firestore."""
        result = {"semantic": None, "episodic": [], "associations": None}

        try:
            # Semantic memory (single document)
            sem_doc = (self.db.collection("users").document(user_id)
                       .collection("memory").document("semantic").get())
            if sem_doc.exists:
                result["semantic"] = sem_doc.to_dict()

            # Episodic memories (collection of documents)
            epi_docs = (self.db.collection("users").document(user_id)
                        .collection("memory").document("episodic").get())
            if epi_docs.exists:
                data = epi_docs.to_dict()
                result["episodic"] = data.get("memories", [])

            # Association graph (single document)
            assoc_doc = (self.db.collection("users").document(user_id)
                         .collection("memory").document("associations").get())
            if assoc_doc.exists:
                result["associations"] = assoc_doc.to_dict()

        except Exception as e:
            log.error(f"Firestore load failed for {user_id}: {e}")

        return result

    def _firestore_save(self, user_id: str, memory_data: dict):
        """Save to Firestore."""
        try:
            mem_ref = self.db.collection("users").document(user_id).collection("memory")

            # Semantic memory
            if memory_data.get("semantic"):
                mem_ref.document("semantic").set(memory_data["semantic"])

            # Episodic memories (stored as a single doc with array — simpler than subcollection)
            if memory_data.get("episodic") is not None:
                # Strip embeddings if the document would be too large (>1MB Firestore limit)
                episodic_data = memory_data["episodic"]
                doc_size = len(json.dumps(episodic_data, default=str))

                if doc_size > 900_000:  # approaching 1MB limit
                    # Store embeddings separately, keep metadata in main doc
                    log.warning(f"Episodic data is {doc_size} bytes — stripping embeddings")
                    stripped = []
                    for mem in episodic_data:
                        m = {k: v for k, v in mem.items() if k != "embedding"}
                        stripped.append(m)
                    mem_ref.document("episodic").set({"memories": stripped})
                    # Store embeddings in separate doc
                    emb_data = {mem["id"]: mem.get("embedding", []) for mem in episodic_data}
                    mem_ref.document("embeddings").set(emb_data)
                else:
                    mem_ref.document("episodic").set({"memories": episodic_data})

            # Association graph
            if memory_data.get("associations"):
                mem_ref.document("associations").set(memory_data["associations"])

        except Exception as e:
            log.error(f"Firestore save failed for {user_id}: {e}")
            # Fallback to local save
            self._local_save(user_id, memory_data)

    # ── Local File Implementation (fallback) ───────────────

    def _get_user_dir(self, user_id: str) -> str:
        """Get the local directory for a user."""
        path = os.path.join(self.local_dir, user_id)
        os.makedirs(path, exist_ok=True)
        return path

    def _local_load(self, user_id: str) -> dict:
        """Load from local JSON files."""
        user_dir = self._get_user_dir(user_id)
        result = {"semantic": None, "episodic": [], "associations": None}

        for key in ["semantic", "episodic", "associations"]:
            path = os.path.join(user_dir, f"{key}.json")
            if os.path.exists(path):
                try:
                    with open(path, "r", encoding="utf-8") as f:
                        result[key] = json.load(f)
                except Exception as e:
                    log.error(f"Local load failed for {user_id}/{key}: {e}")

        return result

    def _local_save(self, user_id: str, memory_data: dict):
        """Save to local JSON files."""
        user_dir = self._get_user_dir(user_id)

        for key in ["semantic", "episodic", "associations"]:
            if memory_data.get(key) is not None:
                path = os.path.join(user_dir, f"{key}.json")
                try:
                    with open(path, "w", encoding="utf-8") as f:
                        json.dump(memory_data[key], f, indent=2, default=str)
                except Exception as e:
                    log.error(f"Local save failed for {user_id}/{key}: {e}")

    def _local_get_user_by_token(self, token: str) -> dict | None:
        """Local fallback: look up user by token."""
        users_file = os.path.join(self.local_dir, "_users.json")
        if not os.path.exists(users_file):
            return None
        with open(users_file, "r", encoding="utf-8") as f:
            users = json.load(f)
        for uid, data in users.items():
            if data.get("token") == token:
                data["user_id"] = uid
                return data
        return None

    def _local_get_user_by_email(self, email: str) -> dict | None:
        """Local fallback: look up user by email."""
        users_file = os.path.join(self.local_dir, "_users.json")
        if not os.path.exists(users_file):
            return None
        with open(users_file, "r", encoding="utf-8") as f:
            users = json.load(f)
        for uid, data in users.items():
            if data.get("email") == email.lower().strip():
                data["user_id"] = uid
                return data
        return None

    def _local_create_user(self, email: str, token: str, user_data: dict) -> str:
        """Local fallback: create user in JSON file."""
        import uuid
        user_id = str(uuid.uuid4())[:12]
        users_file = os.path.join(self.local_dir, "_users.json")

        users = {}
        if os.path.exists(users_file):
            with open(users_file, "r", encoding="utf-8") as f:
                users = json.load(f)

        users[user_id] = user_data
        with open(users_file, "w", encoding="utf-8") as f:
            json.dump(users, f, indent=2)

        return user_id

    def _local_update_last_seen(self, user_id: str):
        """Local fallback: update last_seen."""
        users_file = os.path.join(self.local_dir, "_users.json")
        if not os.path.exists(users_file):
            return
        with open(users_file, "r", encoding="utf-8") as f:
            users = json.load(f)
        if user_id in users:
            users[user_id]["last_seen"] = datetime.now(timezone.utc).isoformat()
            with open(users_file, "w", encoding="utf-8") as f:
                json.dump(users, f, indent=2)
