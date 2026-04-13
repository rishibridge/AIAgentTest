"""
Remy Identity — Token-based authentication (Magic Link MVP)
Simple email → token → bookmark flow. No passwords, no OAuth.
"""
import hashlib
import uuid
import logging
from memory.firestore_store import FirestoreStore

log = logging.getLogger("remy.auth")


def generate_token() -> str:
    """Generate a unique, URL-safe auth token."""
    raw = uuid.uuid4().hex + uuid.uuid4().hex
    return hashlib.sha256(raw.encode()).hexdigest()[:24]


def get_or_create_user(email: str, store: FirestoreStore) -> tuple[str, str, bool]:
    """
    Get existing user or create a new one.
    Returns: (user_id, token, is_new_user)
    """
    email = email.lower().strip()
    
    # Check if user exists
    existing = store.get_user_by_email(email)
    if existing:
        log.info(f"Returning user: {email}")
        return existing["user_id"], existing["token"], False
    
    # Create new user
    token = generate_token()
    user_id = store.create_user(email, token)
    log.info(f"New user created: {email} → {user_id}")
    return user_id, token, True


def verify_token(token: str, store: FirestoreStore) -> dict | None:
    """
    Verify a token and return user data, or None if invalid.
    Returns: {user_id, email, ...} or None
    """
    if not token or len(token) < 10:
        return None
    
    user = store.get_user_by_token(token)
    if user:
        log.info(f"Token verified for user: {user.get('email')}")
        return user
    
    log.warning(f"Invalid token attempted: {token[:8]}...")
    return None
