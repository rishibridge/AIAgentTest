"""
Herbal Remedy Suggestion App
Flask backend serving the symptom questionnaire and remedy results.
"""
import os
import json
from flask import Flask, render_template, request, jsonify

from remedies import (
    ALL_SYMPTOMS, FOLLOW_UP_QUESTIONS, SYMPTOM_CATEGORIES,
    get_matching_remedies
)

app = Flask(__name__)


@app.route("/")
def index():
    """Landing page."""
    return render_template("index.html")


@app.route("/questionnaire")
def questionnaire():
    """Symptom input and follow-up questions page."""
    return render_template(
        "questionnaire.html",
        symptoms=json.dumps(ALL_SYMPTOMS),
        questions=FOLLOW_UP_QUESTIONS,
    )


@app.route("/api/symptoms", methods=["GET"])
def get_symptoms():
    """Return all available symptoms for autocomplete."""
    return jsonify(ALL_SYMPTOMS)


@app.route("/api/analyze", methods=["POST"])
def analyze():
    """
    Receive symptoms and follow-up answers, return matched remedies.
    """
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

    return jsonify({
        "results": grouped,
        "total": len(results),
        "symptoms": symptoms,
    })


@app.route("/results")
def results():
    """Results page (rendered client-side with data from /api/analyze)."""
    return render_template("results.html")


@app.route("/ads")
def ads_gallery():
    return render_template("gallery.html")


@app.route("/ads/<ad_name>")
def view_ad(ad_name):
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
