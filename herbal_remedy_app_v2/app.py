"""
NatureCure V4.0 — Flask Backend
Remy AI chatbot with hippocampus-inspired persistent memory.
"""
import os
import json
import hashlib
import uuid
import time
import re
import logging
import requests
from bs4 import BeautifulSoup
from flask import Flask, render_template, request, jsonify, redirect, url_for, session

from dotenv import load_dotenv
from google import genai
from google.genai import types

from remedies import (
    ALL_SYMPTOMS, FOLLOW_UP_QUESTIONS, SYMPTOM_CATEGORIES,
    get_matching_remedies, REMEDIES
)
from remy_agent import get_system_prompt
from auth import get_or_create_user, verify_token
from memory import MemoryManager
from memory.firestore_store import FirestoreStore
from memory.embeddings import init_embedding_client

# Configure logging
logging.basicConfig(level=logging.INFO)
log = logging.getLogger("remy")

# Load API key from parent ../.env (same pattern as debate app)
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"), override=True)
# Also try local .env
load_dotenv(override=True)

api_key = os.getenv("GOOGLE_API_KEY")
gemini_client = genai.Client(api_key=api_key) if api_key else None

# Initialize embedding client
if api_key:
    init_embedding_client(api_key)

# Build system prompt once at startup with full remedy knowledge
REMY_SYSTEM = get_system_prompt(REMEDIES)

app = Flask(__name__)
app.secret_key = os.urandom(24)

# In-memory results cache (keyed by hash)
_results_cache = {}

# ── Persistence Layer ──────────────────────────────────
# Uses Firestore if available, falls back to local JSON files
_store = FirestoreStore(project_id="dev-dispatch-331019")

# Active memory managers (keyed by user_id)
_active_managers: dict[str, MemoryManager] = {}


def _get_manager(user_id: str, session_id: str = None) -> MemoryManager:
    """Get or create a MemoryManager for a user."""
    if user_id in _active_managers:
        return _active_managers[user_id]

    if not session_id:
        session_id = str(uuid.uuid4())

    manager = MemoryManager(
        user_id=user_id,
        session_id=session_id,
        gemini_client=gemini_client,
        store=_store,
    )
    manager.load()
    _active_managers[user_id] = manager
    return manager


# ─────────────────────────────────────────────
#  PAGE ROUTES
# ─────────────────────────────────────────────

@app.route("/")
def index():
    return render_template("index.html")


@app.route("/questionnaire")
def questionnaire():
    return render_template(
        "questionnaire.html",
        symptoms=json.dumps(ALL_SYMPTOMS),
        questions=FOLLOW_UP_QUESTIONS,
    )

@app.route("/remy")
def remy_chat():
    """Live Remy AI chat interface"""
    # Pass remedy data as JSON so the frontend can render rich buy cards
    remedy_data = {}
    for r in REMEDIES:
        remedy_data[r["name"].lower()] = {
            "name": r["name"],
            "category": r.get("category", ""),
            "description": r.get("description", ""),
            "dosage": r.get("dosage", ""),
            "benefits": r.get("benefits", []),
            "cautions": r.get("cautions", []),
            "evidence_level": r.get("evidence_level", ""),
            "amazon_query": r.get("amazon_query", ""),
            "unsafe_pregnancy": r.get("unsafe_pregnancy", False),
        }
    return render_template("remy_prototype.html", remedy_data=json.dumps(remedy_data))


# ─────────────────────────────────────────────
#  AUTH API
# ─────────────────────────────────────────────

@app.route("/api/auth/login", methods=["POST"])
def api_auth_login():
    """
    Email-based login. Creates user if new, returns token.
    Expects JSON: { "email": "user@example.com" }
    Returns JSON: { "token": "...", "is_new": true/false, "user_id": "..." }
    """
    data = request.get_json()
    email = data.get("email", "").strip()

    if not email or "@" not in email:
        return jsonify({"error": "Valid email required."}), 400

    user_id, token, is_new = get_or_create_user(email, _store)

    return jsonify({
        "token": token,
        "is_new": is_new,
        "user_id": user_id,
    })


@app.route("/api/auth/verify", methods=["POST"])
def api_auth_verify():
    """
    Verify a token.
    Expects JSON: { "token": "..." }
    Returns JSON: { "valid": true/false, "user_id": "...", "email": "..." }
    """
    data = request.get_json()
    token = data.get("token", "")

    user = verify_token(token, _store)
    if user:
        return jsonify({
            "valid": True,
            "user_id": user["user_id"],
            "email": user.get("email", ""),
        })
    else:
        return jsonify({"valid": False}), 401


# ─────────────────────────────────────────────
#  REMY CHAT API (hippocampus-backed)
# ─────────────────────────────────────────────

@app.route("/api/chat", methods=["POST"])
def api_chat():
    """
    Conversational chat with Remy via Gemini, backed by hippocampal memory.
    Expects JSON: { "token": "...", "message": "user text", "session_id": "..." }
    Returns JSON: { "session_id": "...", "reply": "Remy's response", "is_returning": bool }
    """
    if not gemini_client:
        return jsonify({"error": "API key not configured."}), 500

    data = request.get_json()
    user_msg = data.get("message", "").strip()
    token = data.get("token", "")
    session_id = data.get("session_id", "") or str(uuid.uuid4())

    if not user_msg:
        return jsonify({"error": "Empty message."}), 400

    # ── Identify user ──
    user_id = "anonymous"
    if token:
        user = verify_token(token, _store)
        if user:
            user_id = user["user_id"]

    # ── Get memory manager ──
    manager = _get_manager(user_id, session_id)

    # ── Handle init signal ──
    is_init = (user_msg == "[INIT]")

    if is_init:
        # Build greeting context
        greeting_ctx = manager.get_greeting_context()
        if greeting_ctx:
            # Returning user — greet with memory
            gemini_contents = [
                types.Content(role="user", parts=[types.Part(text=greeting_ctx)]),
            ]
        else:
            # New user — standard greeting
            gemini_contents = [
                types.Content(role="user", parts=[types.Part(text=
                    "Start the conversation with your greeting."
                )]),
            ]
    else:
        # ── Regular message — build context + history ──
        memory_context = manager.get_context_for_prompt(user_msg)

        gemini_contents = []

        # Inject hippocampal context
        if memory_context:
            gemini_contents.append(
                types.Content(role="user", parts=[types.Part(text=memory_context)])
            )
            gemini_contents.append(
                types.Content(role="model", parts=[types.Part(text=
                    "Understood. I have all of this context and will not re-ask any of it."
                )])
            )

        # Add conversation history from this session
        for msg in manager.get_history_for_gemini():
            role = "user" if msg["role"] == "user" else "model"
            gemini_contents.append(
                types.Content(role=role, parts=[types.Part(text=msg["content"])])
            )

        # Add current user message
        gemini_contents.append(
            types.Content(role="user", parts=[types.Part(text=user_msg)])
        )

    try:
        response = gemini_client.models.generate_content(
            model="gemini-2.0-flash",
            contents=gemini_contents,
            config=types.GenerateContentConfig(
                system_instruction=REMY_SYSTEM,
                temperature=0.7,
                max_output_tokens=2048,
            ),
        )
        reply = response.text.strip()
    except Exception as e:
        log.error(f"Gemini error: {e}")
        reply = "I'm having trouble connecting right now. Please try again in a moment."

    # ── Store in working memory (skip init) ──
    if not is_init:
        manager.add_exchange(user_msg, reply)

    return jsonify({
        "session_id": session_id,
        "reply": reply,
        "is_returning": manager.is_returning_user(),
    })


@app.route("/api/chat/end", methods=["POST"])
def api_chat_end():
    """
    End a chat session — triggers consolidation ('sleep').
    Expects JSON: { "token": "..." }
    """
    data = request.get_json() or {}
    token = data.get("token", "")

    user_id = "anonymous"
    if token:
        user = verify_token(token, _store)
        if user:
            user_id = user["user_id"]

    if user_id in _active_managers:
        manager = _active_managers[user_id]
        try:
            result = manager.consolidate_and_save()
            log.info(f"Session consolidated for {user_id}: {result}")
            # Clean up in-memory manager
            del _active_managers[user_id]
            return jsonify({"status": "consolidated", "details": result})
        except Exception as e:
            log.error(f"Consolidation failed for {user_id}: {e}")
            return jsonify({"status": "error", "message": str(e)[:200]}), 500
    else:
        return jsonify({"status": "no_active_session"})


# ─────────────────────────────────────────────
#  EXISTING V2 ROUTES (unchanged)
# ─────────────────────────────────────────────

@app.route("/api/symptoms", methods=["GET"])
def get_symptoms():
    return jsonify(ALL_SYMPTOMS)


@app.route("/api/analyze", methods=["POST"])
def analyze():
    data = request.get_json()
    symptoms = data.get("symptoms", [])
    answers = data.get("answers", {})

    if not symptoms:
        return jsonify({"error": "Please enter at least one symptom."}), 400

    # Try Gemini-powered analysis first
    if gemini_client:
        try:
            gemini_results = _gemini_analyze(symptoms, answers)
            if gemini_results:
                payload = {
                    "results": gemini_results,
                    "total": sum(len(v) for v in gemini_results.values()),
                    "symptoms": symptoms,
                }
                key = hashlib.md5(json.dumps({"s": sorted(symptoms), "a": answers}, sort_keys=True).encode()).hexdigest()[:10]
                _results_cache[key] = payload
                payload["share_id"] = key
                return jsonify(payload)
        except Exception as e:
            print(f"Gemini analyze error, falling back to static: {e}")

    # Fallback: static database matching
    results = get_matching_remedies(symptoms, answers)
    grouped = {"ayurvedic": [], "herbal": [], "supplement": []}
    for remedy in results:
        cat = remedy.get("category", "herbal")
        if cat in grouped:
            grouped[cat].append(remedy)

    payload = {
        "results": grouped,
        "total": len(results),
        "symptoms": symptoms,
    }
    key = hashlib.md5(json.dumps({"s": sorted(symptoms), "a": answers}, sort_keys=True).encode()).hexdigest()[:10]
    _results_cache[key] = payload
    payload["share_id"] = key
    return jsonify(payload)


def _gemini_analyze(symptoms, answers):
    """Use Gemini to generate personalized remedy recommendations."""
    # Build patient context
    ctx_parts = [f"Symptoms: {', '.join(symptoms)}"]
    if answers.get("severity"):
        ctx_parts.append(f"Severity: {answers['severity']}")
    if answers.get("duration"):
        ctx_parts.append(f"Duration: {answers['duration']}")
    if answers.get("medications"):
        ctx_parts.append(f"Current medications: {answers['medications']}")
    if answers.get("supplements"):
        ctx_parts.append(f"Current supplements: {answers['supplements']}")
    if answers.get("conditions"):
        ctx_parts.append(f"Diagnosed conditions: {answers['conditions']}")
    if answers.get("allergies"):
        ctx_parts.append(f"Allergies: {answers['allergies']}")
    if answers.get("pregnancy"):
        ctx_parts.append(f"Pregnancy: {answers['pregnancy']}")
    if answers.get("age"):
        ctx_parts.append(f"Age: {answers['age']}")
    if answers.get("preference"):
        ctx_parts.append(f"Preference: {answers['preference']}")
    patient_context = "\n".join(ctx_parts)

    prompt = f"""You are an expert Ayurvedic and natural medicine specialist. A patient has provided:

{patient_context}

Recommend 8-12 natural remedies. Use your FULL knowledge of Ayurveda (Charaka Samhita, Sushruta Samhita, Ashtanga Hridaya), herbalism, and modern supplement science. Do NOT limit yourself to any pre-defined list.

For EACH remedy, return a JSON object with these exact fields:
- "name": remedy name (e.g., "Yograj Guggulu", "Triphala", "Ashwagandha")
- "category": one of "ayurvedic", "herbal", or "supplement"
- "description": 1-2 sentences explaining what it is and why it helps THIS patient
- "benefits": array of 3-4 specific benefits
- "dosage": specific dosage recommendation (e.g., "500mg twice daily with warm water")
- "cautions": array of relevant cautions/contraindications
- "evidence_level": one of "strong", "moderate", or "traditional"
- "amazon_query": search query for finding this on Amazon (e.g., "yograj guggulu tablets organic")
- "matched_symptoms": which of the patient's symptoms this addresses
- "references": array of [title, url, year] for research references (use real PubMed URLs if known, otherwise omit this field)

IMPORTANT:
- Check for interactions with the patient's current medications/supplements
- If pregnant, exclude unsafe remedies
- Prioritize the patient's preference (ayurvedic/herbal/supplement) if stated
- Include a mix of well-known and specialized remedies
- Be specific with dosages, not vague

Return ONLY a valid JSON array of remedy objects. No markdown, no explanation, just the JSON array."""

    response = gemini_client.models.generate_content(
        model="gemini-2.0-flash",
        contents=prompt,
        config=types.GenerateContentConfig(
            temperature=0.3,
        )
    )

    # Parse the JSON response
    text = response.text.strip()
    # Strip markdown code fences if present
    if text.startswith("```"):
        text = text.split("\n", 1)[1] if "\n" in text else text[3:]
        if text.endswith("```"):
            text = text[:-3]
        text = text.strip()
    if text.startswith("json"):
        text = text[4:].strip()

    remedies = json.loads(text)

    # Add amazon_url and ensure required fields
    for r in remedies:
        q = r.get("amazon_query", r.get("name", ""))
        r["amazon_url"] = f"https://www.amazon.com/s?k={q.replace(' ', '+')}"
        r.setdefault("category", "herbal")
        r.setdefault("evidence_level", "traditional")
        r.setdefault("benefits", [])
        r.setdefault("cautions", [])
        r.setdefault("matched_symptoms", [])
        r.setdefault("references", [])

    # Group by category
    grouped = {"ayurvedic": [], "herbal": [], "supplement": []}
    for remedy in remedies:
        cat = remedy.get("category", "herbal")
        if cat in grouped:
            grouped[cat].append(remedy)
        else:
            grouped["herbal"].append(remedy)

    return grouped


@app.route("/results")
def results():
    return render_template("results.html")


@app.route("/results/<share_id>")
def shared_results(share_id):
    return render_template("results.html", share_id=share_id)


@app.route("/api/shared/<share_id>")
def get_shared(share_id):
    data = _results_cache.get(share_id)
    if not data:
        return jsonify({"error": "Results not found or expired."}), 404
    return jsonify(data)


@app.route("/ads")
def ads_gallery():
    return render_template("gallery.html")


@app.route("/ads/<ad_name>")
def view_ad(ad_name):
    # Sanitize to prevent path traversal
    if not re.match(r'^ad\d+_[a-z_]+$', ad_name):
        return "Not found", 404
    try:
        return render_template(f"ads/{ad_name}.html")
    except Exception:
        return "Not found", 404


# ─────────────────────────────────────────────
#  AMAZON PRICE LOOKUP
# ─────────────────────────────────────────────

_price_cache = {}  # { query: { price, url, title, timestamp } }
PRICE_CACHE_TTL = 3600  # 1 hour

AMAZON_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
}

def scrape_amazon_price(query):
    """Search Amazon for a product and extract price, title, and URL."""
    # Check cache first
    if query in _price_cache:
        cached = _price_cache[query]
        if time.time() - cached['timestamp'] < PRICE_CACHE_TTL:
            return cached

    try:
        search_url = f"https://www.amazon.com/s?k={requests.utils.quote(query)}"
        resp = requests.get(search_url, headers=AMAZON_HEADERS, timeout=8)
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, 'html.parser')

        # Find product cards
        results = soup.select('[data-component-type="s-search-result"]')
        if not results:
            # Fallback: try different selectors
            results = soup.select('.s-result-item[data-asin]')

        for item in results[:5]:  # Check first 5 results
            # Skip sponsored/ad results
            if item.select_one('.s-label-popover-default'):
                continue

            # Extract price
            price_whole = item.select_one('.a-price .a-price-whole')
            price_frac = item.select_one('.a-price .a-price-fraction')
            if not price_whole:
                continue

            whole = price_whole.get_text(strip=True).replace(',', '').rstrip('.')
            frac = price_frac.get_text(strip=True) if price_frac else '00'
            price_str = f"${whole}.{frac}"

            # Extract title
            title_el = item.select_one('h2 a span') or item.select_one('h2 span')
            title = title_el.get_text(strip=True) if title_el else query

            # Extract product URL
            link_el = item.select_one('h2 a') or item.select_one('a.a-link-normal.s-no-outline')
            product_url = ''
            if link_el and link_el.get('href'):
                href = link_el['href']
                if href.startswith('/'):
                    product_url = f"https://www.amazon.com{href}"
                else:
                    product_url = href
            # Fallback: construct URL from ASIN
            if not product_url:
                asin = item.get('data-asin', '')
                if asin:
                    product_url = f"https://www.amazon.com/dp/{asin}"

            # Extract rating
            rating_el = item.select_one('.a-icon-star-small .a-icon-alt') or item.select_one('.a-icon-alt')
            rating = rating_el.get_text(strip=True) if rating_el else ''

            result = {
                'price': price_str,
                'title': title[:80],  # Truncate long titles
                'url': product_url,
                'rating': rating,
                'timestamp': time.time()
            }
            _price_cache[query] = result
            return result

        return None
    except Exception as e:
        print(f"Price scrape error for '{query}': {e}")
        return None


@app.route("/api/price", methods=["POST"])
def api_price():
    """Look up Amazon price for a remedy.
    Expects JSON: { "query": "turmeric curcumin supplement" }
    Returns JSON: { "price": "$23.99", "title": "...", "url": "...", "rating": "..." }
    """
    data = request.get_json()
    query = data.get('query', '').strip()
    if not query:
        return jsonify({'error': 'No query provided'}), 400

    result = scrape_amazon_price(query)
    if result:
        return jsonify(result)
    else:
        return jsonify({'error': 'No price found', 'search_url': f'https://www.amazon.com/s?k={requests.utils.quote(query)}'}), 404


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=True)
