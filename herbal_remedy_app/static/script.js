/**
 * NatureCure — Frontend JavaScript
 * Handles symptom input, autocomplete, questionnaire flow, and results rendering
 */

document.addEventListener('DOMContentLoaded', () => {
    initNavbar();
    initMobileMenu();

    // Page-specific init
    if (document.getElementById('symptom-input')) initQuestionnaire();
    if (document.getElementById('results-grid')) initResults();
});

/* ═══════════════════ Navbar ═══════════════════ */
function initNavbar() {
    const nav = document.getElementById('navbar');
    if (!nav) return;
    window.addEventListener('scroll', () => {
        nav.classList.toggle('scrolled', window.scrollY > 40);
    });
}

function initMobileMenu() {
    const btn = document.getElementById('mobile-menu-btn');
    if (!btn) return;
    btn.addEventListener('click', () => {
        const links = btn.closest('.nav-container').querySelector('.nav-links');
        links.classList.toggle('open');
    });
}

/* ═══════════════════ Questionnaire ═══════════════════ */
function initQuestionnaire() {
    const state = {
        symptoms: [],
        answers: {},
        currentStep: 1,
    };

    const allSymptoms = window.ALL_SYMPTOMS || [];
    const input = document.getElementById('symptom-input');
    const chipsContainer = document.getElementById('chips-container');
    const dropdown = document.getElementById('autocomplete-dropdown');
    const nextBtn = document.getElementById('btn-next-step');
    const getResultsBtn = document.getElementById('btn-get-results');
    const backBtn = document.getElementById('btn-back-step-1');
    let highlightedIdx = -1;

    // Focus input when clicking container
    chipsContainer.addEventListener('click', () => input.focus());

    // --- Autocomplete ---
    input.addEventListener('input', () => {
        const val = input.value.trim().toLowerCase();
        highlightedIdx = -1;
        if (val.length < 2) { dropdown.classList.remove('show'); return; }

        const matches = allSymptoms
            .filter(s => s.includes(val) && !state.symptoms.includes(s))
            .slice(0, 8);

        if (matches.length === 0) { dropdown.classList.remove('show'); return; }

        dropdown.innerHTML = matches.map((s, i) => {
            const highlighted = s.replace(
                new RegExp(`(${escapeRegex(val)})`, 'gi'),
                '<mark>$1</mark>'
            );
            return `<div class="autocomplete-item" data-index="${i}" data-value="${s}">${highlighted}</div>`;
        }).join('');

        dropdown.classList.add('show');

        dropdown.querySelectorAll('.autocomplete-item').forEach(item => {
            item.addEventListener('click', () => {
                addSymptom(item.dataset.value);
                input.value = '';
                dropdown.classList.remove('show');
                input.focus();
            });
        });
    });

    // Keyboard navigation
    input.addEventListener('keydown', (e) => {
        const items = dropdown.querySelectorAll('.autocomplete-item');

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            highlightedIdx = Math.min(highlightedIdx + 1, items.length - 1);
            updateHighlight(items);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            highlightedIdx = Math.max(highlightedIdx - 1, 0);
            updateHighlight(items);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (highlightedIdx >= 0 && items[highlightedIdx]) {
                addSymptom(items[highlightedIdx].dataset.value);
                input.value = '';
                dropdown.classList.remove('show');
            } else if (input.value.trim().length >= 2) {
                addSymptom(input.value.trim().toLowerCase());
                input.value = '';
                dropdown.classList.remove('show');
            }
        } else if (e.key === 'Backspace' && input.value === '' && state.symptoms.length > 0) {
            removeSymptom(state.symptoms[state.symptoms.length - 1]);
        }
    });

    function updateHighlight(items) {
        items.forEach((item, i) => {
            item.classList.toggle('highlighted', i === highlightedIdx);
        });
    }

    // Close dropdown on outside click
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.symptom-input-area')) dropdown.classList.remove('show');
    });

    // --- Chips ---
    function addSymptom(symptom) {
        symptom = symptom.trim().toLowerCase();
        if (!symptom || state.symptoms.includes(symptom)) return;
        state.symptoms.push(symptom);
        renderChips();
        updatePopularChips();
        updateNextBtn();
    }

    function removeSymptom(symptom) {
        state.symptoms = state.symptoms.filter(s => s !== symptom);
        renderChips();
        updatePopularChips();
        updateNextBtn();
    }

    function renderChips() {
        const existing = chipsContainer.querySelectorAll('.chip');
        existing.forEach(c => c.remove());

        state.symptoms.forEach(s => {
            const chip = document.createElement('div');
            chip.className = 'chip';
            chip.innerHTML = `${escapeHtml(s)} <button class="chip-remove" data-symptom="${escapeHtml(s)}">×</button>`;
            chipsContainer.insertBefore(chip, input);
        });

        chipsContainer.querySelectorAll('.chip-remove').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                removeSymptom(btn.dataset.symptom);
            });
        });
    }

    function updateNextBtn() {
        nextBtn.disabled = state.symptoms.length === 0;
    }

    // --- Popular chips ---
    document.querySelectorAll('.popular-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            addSymptom(chip.dataset.symptom);
        });
    });

    function updatePopularChips() {
        document.querySelectorAll('.popular-chip').forEach(chip => {
            chip.classList.toggle('added', state.symptoms.includes(chip.dataset.symptom));
        });
    }

    // --- Step Navigation ---
    nextBtn.addEventListener('click', () => goToStep(2));
    if (backBtn) backBtn.addEventListener('click', () => goToStep(1));

    function goToStep(step) {
        state.currentStep = step;
        document.querySelectorAll('.form-step').forEach(s => s.classList.remove('active'));
        document.getElementById(`step-${step}`).classList.add('active');

        // Update progress
        document.querySelectorAll('.progress-step').forEach(ps => {
            const s = parseInt(ps.dataset.step);
            ps.classList.toggle('active', s === step);
            ps.classList.toggle('completed', s < step);
        });

        const line1 = document.getElementById('progress-line-1');
        const line2 = document.getElementById('progress-line-2');
        if (line1) line1.classList.toggle('filled', step >= 2);
        if (line2) line2.classList.toggle('filled', step >= 3);

        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    // --- Options ---
    document.querySelectorAll('.option-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const question = btn.dataset.question;
            // Deselect siblings
            btn.closest('.options-grid').querySelectorAll('.option-btn')
                .forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            state.answers[question] = btn.dataset.value;
        });
    });

    // --- Submit ---
    if (getResultsBtn) {
        getResultsBtn.addEventListener('click', async () => {
            // Show loading
            document.querySelectorAll('.form-step').forEach(s => s.classList.remove('active'));
            document.getElementById('step-loading').classList.add('active');

            // Update progress
            document.querySelectorAll('.progress-step').forEach(ps => {
                ps.classList.add('completed');
                ps.classList.remove('active');
            });
            const line1 = document.getElementById('progress-line-1');
            const line2 = document.getElementById('progress-line-2');
            if (line1) line1.classList.add('filled');
            if (line2) line2.classList.add('filled');

            try {
                const resp = await fetch('/api/analyze', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        symptoms: state.symptoms,
                        answers: state.answers,
                    }),
                });

                const data = await resp.json();

                // Store in sessionStorage and redirect
                sessionStorage.setItem('nc_results', JSON.stringify(data));
                sessionStorage.setItem('nc_symptoms', JSON.stringify(state.symptoms));
                window.location.href = '/results';
            } catch (err) {
                alert('Something went wrong. Please try again.');
                goToStep(2);
            }
        });
    }
}

/* ═══════════════════ Results ═══════════════════ */
function initResults() {
    const stored = sessionStorage.getItem('nc_results');
    const symptoms = JSON.parse(sessionStorage.getItem('nc_symptoms') || '[]');

    if (!stored) {
        window.location.href = '/questionnaire';
        return;
    }

    const data = JSON.parse(stored);
    const { results, total } = data;

    // All remedies flat
    const allRemedies = [
        ...(results.ayurvedic || []),
        ...(results.herbal || []),
        ...(results.supplement || []),
    ];

    // Header
    document.getElementById('results-subtitle').textContent =
        `We found ${total} natural remedies for your ${symptoms.length} symptom${symptoms.length !== 1 ? 's' : ''}`;

    const tagsEl = document.getElementById('symptom-tags');
    tagsEl.innerHTML = symptoms.map(s =>
        `<span class="symptom-tag">${escapeHtml(s)}</span>`
    ).join('');

    // Counts
    document.getElementById('count-all').textContent = allRemedies.length;
    document.getElementById('count-ayurvedic').textContent = (results.ayurvedic || []).length;
    document.getElementById('count-herbal').textContent = (results.herbal || []).length;
    document.getElementById('count-supplement').textContent = (results.supplement || []).length;

    // Render all initially
    renderRemedies(allRemedies);

    // Tab switching
    document.querySelectorAll('.tab-btn').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            const cat = tab.dataset.category;
            if (cat === 'all') {
                renderRemedies(allRemedies);
            } else {
                renderRemedies(results[cat] || []);
            }
        });
    });

    // Show empty state if no results
    if (allRemedies.length === 0) {
        document.getElementById('empty-state').style.display = 'block';
        document.getElementById('category-tabs').style.display = 'none';
    }
}

function renderRemedies(remedies) {
    const grid = document.getElementById('results-grid');
    const empty = document.getElementById('empty-state');

    if (remedies.length === 0) {
        grid.innerHTML = '';
        empty.style.display = 'block';
        return;
    }

    empty.style.display = 'none';
    grid.innerHTML = remedies.map((r, i) => {
        const badgeClass = `badge-${r.category}`;
        const categoryLabel = r.category.charAt(0).toUpperCase() + r.category.slice(1);

        const matchedHtml = (r.matched_symptoms || []).map(s =>
            `<span class="matched-badge">✓ ${escapeHtml(s)}</span>`
        ).join('');

        const benefitsHtml = (r.benefits || []).map(b =>
            `<li>${escapeHtml(b)}</li>`
        ).join('');

        const cautionsHtml = (r.cautions || []).map(c =>
            `<div class="caution-item">${escapeHtml(c)}</div>`
        ).join('');

        const warningHtml = r._interaction_warning
            ? `<div class="interaction-warning">⚠️ May interact with your current medications — consult your healthcare provider.</div>`
            : '';

        return `
        <div class="remedy-card" style="animation-delay: ${i * 0.05}s">
            <div class="remedy-header">
                <div class="remedy-name">${escapeHtml(r.name)}</div>
                <span class="remedy-type-badge ${badgeClass}">${categoryLabel}</span>
            </div>

            <div class="remedy-desc">${escapeHtml(r.description)}</div>

            ${matchedHtml ? `
            <div class="remedy-section-title">Matched Symptoms</div>
            <div class="remedy-matched">${matchedHtml}</div>
            ` : ''}

            <div class="remedy-section-title">Benefits</div>
            <ul class="remedy-benefits">${benefitsHtml}</ul>

            <div class="remedy-section-title">Suggested Dosage</div>
            <div class="remedy-dosage">${escapeHtml(r.dosage || '')}</div>

            ${warningHtml}

            ${cautionsHtml ? `
            <div class="remedy-section-title">Cautions</div>
            <div class="remedy-cautions">${cautionsHtml}</div>
            ` : ''}

            <div class="remedy-footer">
                <a href="${escapeHtml(r.amazon_url || '#')}" target="_blank" rel="noopener noreferrer" class="btn btn-amazon">
                    🛒 View on Amazon
                </a>
            </div>
        </div>
        `;
    }).join('');
}

/* ═══════════════════ Utilities ═══════════════════ */
function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
