#!/usr/bin/env python3
"""Copy ad files into V1, patch CTA links, and create gallery page."""
import os, re, shutil

SRC = r"C:\Users\rishi\Downloads\adfiles"
DST = os.path.join(os.path.dirname(__file__), "templates", "ads")
os.makedirs(DST, exist_ok=True)

V1_URL = "https://naturecure-525536279111.us-central1.run.app/questionnaire"
LOCAL_URL = "/questionnaire"

AD_META = {
    "ad1_choice": ("Your Body. Your Call.", "Choice"),
    "ad2_dismissal": ("Your Doctor Said It's Nothing", "Dismissal"),
    "ad3_caretaker": ("Mom's Been on 6 Medications", "Caretaker"),
    "ad4_side_effects": ("Side Effects", "Side Effects"),
    "ad5_tribal": ("They'll Call You Crazy", "Tribal"),
    "ad6_overwhelm": ("Overwhelm", "Overwhelm"),
    "ad7_quiet_rebellion": ("No Prescription. No Co-pay.", "Rebellion"),
}

ads_info = []
for fname in sorted(os.listdir(SRC)):
    if not fname.endswith(".html"):
        continue
    src_path = os.path.join(SRC, fname)
    with open(src_path, "r", encoding="utf-8") as f:
        content = f.read()

    # Patch CTA links: replace absolute URL with relative URL, remove target="_blank"
    content = content.replace(V1_URL, LOCAL_URL)
    content = content.replace(' target="_blank"', '')

    # Make responsive: replace fixed 1080px with max-width
    content = content.replace("width: 1080px; height: 1080px;", "width: 100%; max-width: 800px; aspect-ratio: 1/1;")

    dst_path = os.path.join(DST, fname)
    with open(dst_path, "w", encoding="utf-8") as f:
        f.write(content)

    base = fname.replace(".html", "")
    title, label = AD_META.get(base, (base, base))
    ads_info.append((base, title, label))
    print(f"  Copied & patched: {fname}")

# Generate gallery page
gallery_html = """<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>NatureCure Ad Gallery</title>
    <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🌿</text></svg>">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="/static/style.css">
    <style>
        .gallery-page { padding: 100px 0 60px; min-height: 100vh; }
        .gallery-header { text-align: center; margin-bottom: 48px; }
        .gallery-header h1 { font-size: 2rem; font-weight: 700; margin-bottom: 8px; }
        .gallery-header p { color: var(--text-secondary); }
        .ad-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 24px; margin-bottom: 48px; }
        .ad-link-card { display: flex; align-items: center; justify-content: space-between; padding: 24px; border-radius: var(--radius-lg); border: 1px solid var(--border-subtle); background: var(--bg-surface); text-decoration: none; transition: var(--transition); }
        .ad-link-card:hover { transform: translateY(-4px); box-shadow: var(--shadow-glow); border-color: var(--border-medium); }
        .ad-info h3 { font-size: 1.1rem; font-weight: 600; color: var(--text-dark); margin-bottom: 4px; }
        .ad-info span { font-size: 0.85rem; color: var(--text-secondary); }
        .ad-icon { font-size: 2rem; margin-right: 16px; opacity: 0.8; }
        .ad-arrow { color: var(--primary); font-weight: 600; }
        .gallery-cta { text-align: center; }
    </style>
</head>
<body>
    <nav class="navbar" id="navbar">
        <div class="nav-container">
            <a href="/" class="nav-logo"><span class="logo-icon">🌿</span><span class="logo-text">NatureCure</span></a>
            <div class="nav-links">
                <a href="/">Home</a>
                <a href="/questionnaire" class="btn btn-nav">Get Started</a>
            </div>
            <button class="mobile-menu-btn" id="mobile-menu-btn" aria-label="Toggle menu"><span></span><span></span><span></span></button>
        </div>
    </nav>
    <main class="gallery-page">
        <div class="container">
            <div class="gallery-header">
                <span class="section-badge">Campaigns</span>
                <h1>NatureCure Ad Gallery</h1>
                <p>Browse our collection of wellness campaign creatives</p>
            </div>
            <div class="ad-grid">
"""

for base, title, label in ads_info:
    gallery_html += f"""                <a href="/ads/{base}" class="ad-link-card">
                    <div style="display: flex; align-items: center;">
                        <div class="ad-icon">✨</div>
                        <div class="ad-info">
                            <h3>{title}</h3>
                            <span>Campaign: {label}</span>
                        </div>
                    </div>
                    <div class="ad-arrow">→</div>
                </a>
"""

gallery_html += """            </div>
            <div class="gallery-cta">
                <a href="/questionnaire" class="btn btn-primary btn-lg">Find Your Remedy →</a>
            </div>
        </div>
    </main>
    <script src="/static/script.js"></script>
</body>
</html>"""

gallery_path = os.path.join(os.path.dirname(__file__), "templates", "gallery.html")
with open(gallery_path, "w", encoding="utf-8") as f:
    f.write(gallery_html)

print(f"\nGenerated gallery.html with {len(ads_info)} ads")
print("Ad files placed in templates/ads/")
