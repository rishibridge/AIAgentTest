import os
import uuid
import time
from dotenv import load_dotenv

# Load the environment keys so we can test Gemini connectivity directly
load_dotenv(os.path.join(os.path.dirname(__file__), "..", "..", ".env"), override=True)
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"), override=True)

from google import genai
from google.genai import types

from memory.manager import MemoryManager
from memory.firestore_store import FirestoreStore
from memory.embeddings import init_embedding_client

def run_demo_script_test():
    print("======================================================")
    print("  HIPPOCAMPUS TEST BED: The Rishi Core Narrative")
    print("======================================================\n")

    api_key = os.getenv("GOOGLE_API_KEY")
    if not api_key:
        print("ERROR: GOOGLE_API_KEY not found. Skipping test.")
        return

    # Init clients
    gemini_client = genai.Client(api_key=api_key)
    init_embedding_client(api_key)
    
    # We use local storage for this test to avoid messing with production Firestore
    store = FirestoreStore(project_id="testbed-local")
    store.db = None # Force fallback to local files

    # Create a completely fresh session user
    user_id = str(uuid.uuid4())
    session_id = str(uuid.uuid4())
    
    manager = MemoryManager(
        user_id=user_id,
        session_id=session_id,
        gemini_client=gemini_client,
        store=store
    )
    manager.load()

    # --- ACT 1: INGESTION (Simulating 6 months ago) ---
    print("[ACT 1] Building historical context (simulating 6 months ago)...")
    manager.add_exchange(
        "I'm building an AI Human Debate Arena app to pit humans against AI.", 
        "That sounds fascinating! What are the constraints?"
    )
    manager.add_exchange(
        "The constraints are strict: 6 minute runtime max. Has to be completely real conversation history, no faking data.",
        "Understood. We'll ensure the system logic handles pure history."
    )
    
    print("\n[Simulating Consolidation 'Sleep']...")
    manager.consolidate_and_save()
    
    # Time Travel -> Push past timestamps 6 months back
    print("[Simulating Time Travel: Fast forward 6 months]")
    from datetime import datetime, timedelta, timezone
    for memory in manager.episodic.memories:
        dt = datetime.fromisoformat(memory["timestamp"].replace("Z", "+00:00"))
        memory["timestamp"] = (dt - timedelta(days=180)).isoformat()
    manager.save()

    # --- ACT 2: THE MEMORY ---
    print("\n[ACT 2] Querying long-term memory...")
    prompt_a = "Where did we leave off on the debate app?"
    print(f"User: >_ {prompt_a}")
    
    context_a = manager.get_context_for_prompt(prompt_a)
    print("\n-- [Hippocampal Context Supplied to LLM] --")
    print(context_a.strip())
    print("-------------------------------------------\n")

    # --- ACT 3: THE CORRECTION ---
    print("[ACT 3] Issuing a semantic command to forget...")
    prompt_b = "We abandoned the debate app. We are building something else now, a healthcare memory app."
    print(f"User: >_ {prompt_b}")
    manager.add_exchange(prompt_b, "Got it. The debate app is scrapped. What's the new focus?")
    
    print("\n[Simulating Consolidation 'Sleep']...")
    manager.consolidate_and_save()
    
    prompt_c = "What am I working on?"
    print(f"\nUser: >_ {prompt_c}")
    context_c = manager.get_context_for_prompt(prompt_c)
    print("\n-- [Hippocampal Context Supplied to LLM] --")
    print(context_c.strip())
    # The context should strictly reflect the new project and the 'debate app' should be pruned from Semantic Memory!
    print("-------------------------------------------\n")

    # --- ACT 4: THE CROSSING ---
    print("[ACT 4] Simulating Model Switcher...")
    print("Because the MemoryManager generated the text payload above, ")
    print("we can literally pipe it into `openai.chat.completions.create(...)`")
    print("or `anthropic.messages.create(...)`. The memory works identically across all models!\n")

    # --- ACT 5: THE ONE MORE THING ---
    print("[ACT 5] Extracting empathetic profile...")
    prompt_d = "What does this person need to hear right now?"
    print(f"User: >_ {prompt_d}")
    context_d = manager.get_context_for_prompt(prompt_d)
    print("\n-- [Hippocampal Context Supplied to LLM] --")
    print(context_d.strip())
    print("-------------------------------------------\n")

    print("\n✅ Test Bed Demo Execution Complete.")

if __name__ == "__main__":
    run_demo_script_test()
