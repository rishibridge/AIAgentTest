"""
NatureCure V3 — Flask Backend
Enhanced with Remy AI chatbot powered by Google Gemini.
"""
import os
import json
import hashlib
import uuid
import time
import re
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

# Load API key from parent ../.env (same pattern as debate app)
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"), override=True)
# Also try local .env
load_dotenv(override=True)

api_key = os.getenv("GOOGLE_API_KEY")
gemini_client = genai.Client(api_key=api_key) if api_key else None

# Build system prompt once at startup with full remedy knowledge
REMY_SYSTEM = get_system_prompt(REMEDIES)

app = Flask(__name__)
app.secret_key = os.urandom(24)

# In-memory results cache (keyed by hash)
_results_cache = {}

# In-memory chat sessions  {session_id: [{"role": ..., "content": ...}, ...]}
_chat_sessions = {}


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
#  CONTEXT EXTRACTION (prevents "goldfish memory")
# ─────────────────────────────────────────────

def _extract_patient_context(history):
    """
    Scan all user messages in history and extract key patient facts.
    Returns a concise summary string, or empty string if nothing found.
    This is injected into each Gemini call so the model never forgets.
    """
    # Collect all user messages
    user_msgs = [m["content"] for m in history if m["role"] == "user"]
    if not user_msgs:
        return ""

    # Simple extraction: concatenate all user messages and let the model
    # see them. But we also do a quick keyword scan to build a structured
    # context reminder.
    facts = []
    combined = " ".join(user_msgs).lower()

    # Age detection
    import re as re_module
    age_match = re_module.search(r'\b(\d{1,3})\s*(?:years?\s*old|yo|y\.o\.?|yrs?)\b', combined)
    if not age_match:
        age_match = re_module.search(r'\bam\s+(\d{2,3})\b', combined)
    if not age_match:
        age_match = re_module.search(r'\bage\s*(?:is\s*)?(\d{2,3})\b', combined)
    if age_match:
        facts.append(f"Age: {age_match.group(1)}")

    # Sex/gender detection
    sex_keywords = {
        "male": ["male", "man", "guy", "m "],
        "female": ["female", "woman", "girl", "f "],
    }
    for sex, keywords in sex_keywords.items():
        for kw in keywords:
            if kw in combined:
                facts.append(f"Sex: {sex.capitalize()}")
                break
        else:
            continue
        break

    # Health conditions
    conditions = []
    condition_map = {
        "ankylosing spondylitis": ["ankylosing spondylitis", " as,", " as ", "a.s."],
        "diabetes": ["diabetes", "diabetic", "blood sugar"],
        "atrial fibrillation": ["afib", "a-fib", "atrial fibrillation", "atrial fib"],
        "hypertension": ["hypertension", "high blood pressure", "hbp"],
        "anxiety": ["anxiety", "anxious"],
        "depression": ["depression", "depressed"],
        "insomnia": ["insomnia", "can't sleep", "can not sleep"],
        "heart disease": ["heart disease", "cardiac", "heart condition"],
    }
    for condition, keywords in condition_map.items():
        for kw in keywords:
            if kw in combined:
                conditions.append(condition)
                break
    if conditions:
        facts.append(f"Health conditions: {', '.join(conditions)}")

    # Lifestyle markers
    if any(w in combined for w in ["sedentary", "don't move", "sit all day", "no exercise"]):
        facts.append("Lifestyle: Sedentary")
    if any(w in combined for w in ["sleep late", "late sleep", "night owl", "stay up late"]):
        facts.append("Sleep: Late schedule")
    if any(w in combined for w in ["stress", "stressed"]):
        facts.append("Mental state: Stressed")

    # Financial context
    money_match = re_module.search(r'\$[\d,.]+\s*[mkb]?\b', combined)
    if money_match:
        facts.append(f"Financial context mentioned: {money_match.group(0)}")

    # Goals
    if any(w in combined for w in ["adventure", "exploration", "carefree", "wholesome"]):
        facts.append("Goal: Seeking a carefree, wholesome life of exploration")

    if not facts:
        return ""

    return "\n".join(f"• {f}" for f in facts)


# ─────────────────────────────────────────────
#  REMY CHAT API
# ─────────────────────────────────────────────

@app.route("/api/chat", methods=["POST"])
def api_chat():
    """
    Conversational chat with Remy via Gemini.
    Expects JSON: { "session_id": "...", "message": "user text" }
    Returns JSON: { "session_id": "...", "reply": "Remy's response" }
    """
    if not gemini_client:
        return jsonify({"error": "API key not configured. Add GOOGLE_API_KEY to ../.env"}), 500

    data = request.get_json()
    user_msg = data.get("message", "").strip()
    session_id = data.get("session_id", "")

    if not user_msg:
        return jsonify({"error": "Empty message."}), 400

    # Get or create session history
    if not session_id or session_id not in _chat_sessions:
        session_id = str(uuid.uuid4())
        _chat_sessions[session_id] = []

    history = _chat_sessions[session_id]

    # Handle init signal — don't pollute history with fake messages
    is_init = (user_msg == "[INIT]")
    if is_init:
        # Don't store [INIT] in history — it's not a real user message
        # Just send a greeting prompt
        user_msg = "Start the conversation with your greeting."
    
    # Append user message (skip for init — we don't want it in history)
    if not is_init:
        history.append({"role": "user", "content": user_msg})

    # ── Build context summary from ALL user messages ──
    # This prevents "goldfish memory" by extracting key facts and
    # injecting them as a reminder every turn.
    context_summary = _extract_patient_context(history)

    # Build Gemini contents from history
    gemini_contents = []

    # Inject context reminder as the first model message if we have context
    if context_summary:
        gemini_contents.append(
            types.Content(role="user", parts=[types.Part(text=
                f"[SYSTEM CONTEXT — DO NOT REPEAT THIS TO THE USER]\n"
                f"The following facts have already been shared by this patient. "
                f"DO NOT re-ask any of this information:\n{context_summary}\n"
                f"Continue the conversation naturally from where we left off."
            )])
        )
        gemini_contents.append(
            types.Content(role="model", parts=[types.Part(text=
                "Understood. I have all of this context. I will not re-ask any of it."
            )])
        )

    for msg in history:
        role = "user" if msg["role"] == "user" else "model"
        gemini_contents.append(
            types.Content(role=role, parts=[types.Part(text=msg["content"])])
        )

    # For init calls, add the greeting prompt (not stored in history)
    if is_init:
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
        reply = f"I'm having trouble connecting right now. Please try again in a moment. (Error: {str(e)[:100]})"

    # Append assistant reply to history
    history.append({"role": "assistant", "content": reply})

    # Cap history length to avoid token overflow (keep last 40 turns)
    if len(history) > 40:
        _chat_sessions[session_id] = history[-40:]

    return jsonify({"session_id": session_id, "reply": reply})


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
    import re
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

