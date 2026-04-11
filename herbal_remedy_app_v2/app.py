"""
NatureCure V2 — Flask Backend
Enhanced with safety checks, evidence tiers, and expanded remedy database.
"""
import os
import json
import hashlib
from flask import Flask, render_template, request, jsonify, redirect, url_for

from remedies import (
    ALL_SYMPTOMS, FOLLOW_UP_QUESTIONS, SYMPTOM_CATEGORIES,
    get_matching_remedies
)

app = Flask(__name__)

# In-memory results cache (keyed by hash)
_results_cache = {}


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
    """Mockup route for Remy AI UX prototype"""
    return render_template("remy_prototype.html")


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

    results = get_matching_remedies(symptoms, answers)

    # Group by category
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

    # Create shareable ID
    key = hashlib.md5(json.dumps({"s": sorted(symptoms), "a": answers}, sort_keys=True).encode()).hexdigest()[:10]
    _results_cache[key] = payload

    payload["share_id"] = key
    return jsonify(payload)


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


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=True)
