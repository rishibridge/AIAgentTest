/**
 * NatureCure V2 — Frontend JavaScript
 */
document.addEventListener('DOMContentLoaded', () => {
    initNavbar();
    initMobileMenu();
    if (document.getElementById('symptom-input')) initQuestionnaire();
    if (document.getElementById('results-grid')) initResults();
});

function initNavbar() {
    const nav = document.getElementById('navbar');
    if (!nav) return;
    window.addEventListener('scroll', () => nav.classList.toggle('scrolled', window.scrollY > 40));
}

function initMobileMenu() {
    const btn = document.getElementById('mobile-menu-btn');
    if (!btn) return;
    btn.addEventListener('click', () => {
        const links = btn.closest('.nav-container').querySelector('.nav-links');
        links.classList.toggle('open');
    });
    // Auto-close on link click
    document.querySelectorAll('.nav-links a').forEach(link => {
        link.addEventListener('click', () => {
            const links = document.querySelector('.nav-links');
            if (links) links.classList.remove('open');
        });
    });
}

function initQuestionnaire() {
    const state = { symptoms: [], answers: {}, currentStep: 1 };
    const allSymptoms = window.ALL_SYMPTOMS || [];
    const input = document.getElementById('symptom-input');
    const chipsContainer = document.getElementById('chips-container');
    const dropdown = document.getElementById('autocomplete-dropdown');
    const nextBtn = document.getElementById('btn-next-step');
    const getResultsBtn = document.getElementById('btn-get-results');
    const backBtn = document.getElementById('btn-back-step-1');
    const validationMsg = document.getElementById('validation-msg');
    let highlightedIdx = -1;

    chipsContainer.addEventListener('click', () => input.focus());

    // Autocomplete
    input.addEventListener('input', () => {
        const val = input.value.trim().toLowerCase();
        highlightedIdx = -1;
        if (val.length < 2) { dropdown.classList.remove('show'); return; }
        const matches = allSymptoms.filter(s => s.includes(val) && !state.symptoms.includes(s)).slice(0, 8);
        if (matches.length === 0) { dropdown.classList.remove('show'); return; }
        dropdown.innerHTML = matches.map((s, i) => {
            const hl = s.replace(new RegExp(`(${escapeRegex(val)})`, 'gi'), '<mark>$1</mark>');
            return `<div class="autocomplete-item" data-index="${i}" data-value="${s}">${hl}</div>`;
        }).join('');
        dropdown.classList.add('show');
        dropdown.querySelectorAll('.autocomplete-item').forEach(item => {
            item.addEventListener('click', () => { addSymptom(item.dataset.value); input.value = ''; dropdown.classList.remove('show'); input.focus(); });
        });
    });

    input.addEventListener('keydown', (e) => {
        const items = dropdown.querySelectorAll('.autocomplete-item');
        if (e.key === 'ArrowDown') { e.preventDefault(); highlightedIdx = Math.min(highlightedIdx + 1, items.length - 1); updateHighlight(items); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); highlightedIdx = Math.max(highlightedIdx - 1, 0); updateHighlight(items); }
        else if (e.key === 'Enter') {
            e.preventDefault();
            if (highlightedIdx >= 0 && items[highlightedIdx]) { addSymptom(items[highlightedIdx].dataset.value); }
            else if (input.value.trim().length >= 2) { addSymptom(input.value.trim().toLowerCase()); }
            input.value = ''; dropdown.classList.remove('show');
        } else if (e.key === 'Backspace' && input.value === '' && state.symptoms.length > 0) {
            removeSymptom(state.symptoms[state.symptoms.length - 1]);
        }
    });

    function updateHighlight(items) { items.forEach((item, i) => item.classList.toggle('highlighted', i === highlightedIdx)); }
    document.addEventListener('click', (e) => { if (!e.target.closest('.symptom-input-area')) dropdown.classList.remove('show'); });

    function addSymptom(s) {
        s = s.trim().toLowerCase();
        if (!s || state.symptoms.includes(s)) return;
        state.symptoms.push(s);
        renderChips(); updatePopularChips(); updateNextBtn();
        saveWizardContext();
    }
    function removeSymptom(s) {
        state.symptoms = state.symptoms.filter(x => x !== s);
        renderChips(); updatePopularChips(); updateNextBtn();
        saveWizardContext();
    }
    function renderChips() {
        chipsContainer.querySelectorAll('.chip').forEach(c => c.remove());
        state.symptoms.forEach(s => {
            const chip = document.createElement('div');
            chip.className = 'chip'; chip.setAttribute('role', 'option');
            chip.innerHTML = `${escapeHtml(s)} <button class="chip-remove" data-symptom="${escapeHtml(s)}" aria-label="Remove ${escapeHtml(s)}">×</button>`;
            chipsContainer.insertBefore(chip, input);
        });
        chipsContainer.querySelectorAll('.chip-remove').forEach(btn => {
            btn.addEventListener('click', (e) => { e.stopPropagation(); removeSymptom(btn.dataset.symptom); });
        });
    }
    function updateNextBtn() {
        const hasSymptoms = state.symptoms.length > 0;
        nextBtn.disabled = !hasSymptoms;
        if (validationMsg) validationMsg.classList.toggle('hidden', hasSymptoms);
    }

    document.querySelectorAll('.popular-chip').forEach(chip => {
        chip.addEventListener('click', () => addSymptom(chip.dataset.symptom));
    });
    function updatePopularChips() {
        document.querySelectorAll('.popular-chip').forEach(chip => {
            chip.classList.toggle('added', state.symptoms.includes(chip.dataset.symptom));
        });
    }

    nextBtn.addEventListener('click', () => goToStep(2));
    if (backBtn) backBtn.addEventListener('click', () => goToStep(1));

    function goToStep(step) {
        state.currentStep = step;
        document.querySelectorAll('.form-step').forEach(s => s.classList.remove('active'));
        document.getElementById(`step-${step}`).classList.add('active');
        document.querySelectorAll('.progress-step').forEach(ps => {
            const s = parseInt(ps.dataset.step);
            ps.classList.toggle('active', s === step);
            ps.classList.toggle('completed', s < step);
        });
        const l1 = document.getElementById('progress-line-1'), l2 = document.getElementById('progress-line-2');
        if (l1) l1.classList.toggle('filled', step >= 2);
        if (l2) l2.classList.toggle('filled', step >= 3);
        window.scrollTo({ top: 0, behavior: 'smooth' });
        // Focus management for a11y
        const heading = document.querySelector(`#step-${step} h1`);
        if (heading) setTimeout(() => heading.focus(), 400);
    }

    document.querySelectorAll('.option-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            btn.closest('.options-grid').querySelectorAll('.option-btn').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            state.answers[btn.dataset.question] = btn.dataset.value;
        });
    });

    if (getResultsBtn) {
        getResultsBtn.addEventListener('click', async () => {
            // Save wizard context to localStorage so Remy can pick it up
            saveWizardContext();
            document.querySelectorAll('.form-step').forEach(s => s.classList.remove('active'));
            document.getElementById('step-loading').classList.add('active');
            document.querySelectorAll('.progress-step').forEach(ps => { ps.classList.add('completed'); ps.classList.remove('active'); });
            const l1 = document.getElementById('progress-line-1'), l2 = document.getElementById('progress-line-2');
            if (l1) l1.classList.add('filled'); if (l2) l2.classList.add('filled');
            try {
                const resp = await fetch('/api/analyze', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ symptoms: state.symptoms, answers: state.answers }),
                });
                const data = await resp.json();
                sessionStorage.setItem('nc_results', JSON.stringify(data));
                sessionStorage.setItem('nc_symptoms', JSON.stringify(state.symptoms));
                if (data.share_id) {
                    window.location.href = '/results/' + data.share_id;
                } else {
                    window.location.href = '/results';
                }
            } catch (err) {
                const errEl = document.createElement('div');
                errEl.className = 'interaction-warning';
                errEl.style.marginTop = '20px';
                errEl.innerHTML = '⚠️ Something went wrong. <button class="btn btn-ghost" onclick="location.reload()" style="margin-left:8px">Try Again</button>';
                document.getElementById('step-loading').appendChild(errEl);
            }
        });
    }

    // Save wizard context anytime answers change (also called on submit)
    function saveWizardContext() {
        const ctx = {
            source: 'wizard',
            timestamp: Date.now(),
            symptoms: state.symptoms,
            answers: state.answers
        };
        localStorage.setItem('nc_patient_context', JSON.stringify(ctx));
    }

    // Also save context whenever an option is selected
    const origOptionHandler = document.querySelectorAll('.option-btn');
    origOptionHandler.forEach(btn => {
        btn.addEventListener('click', () => {
            // Small delay to let the state update
            setTimeout(saveWizardContext, 50);
        });
    });
}

function initResults() {
    const skeletonGrid = document.getElementById('skeleton-grid');
    if (skeletonGrid) skeletonGrid.classList.add('show');

    // Check for shared results
    const shareId = window.SHARE_ID;
    if (shareId) {
        fetch('/api/shared/' + shareId)
            .then(r => r.json())
            .then(data => {
                if (data.error) { window.location.href = '/questionnaire'; return; }
                sessionStorage.setItem('nc_results', JSON.stringify(data));
                sessionStorage.setItem('nc_symptoms', JSON.stringify(data.symptoms || []));
                renderResultsData();
            })
            .catch(() => renderResultsData());
    } else {
        setTimeout(() => renderResultsData(), 300);
    }
}

function renderResultsData() {
    const stored = sessionStorage.getItem('nc_results');
    const symptoms = JSON.parse(sessionStorage.getItem('nc_symptoms') || '[]');
    const skeletonGrid = document.getElementById('skeleton-grid');

    if (!stored) { window.location.href = '/questionnaire'; return; }

    const data = JSON.parse(stored);
    const { results, total } = data;
    const allRemedies = [...(results.ayurvedic||[]),...(results.herbal||[]),...(results.supplement||[])];

    document.getElementById('results-subtitle').textContent =
        `We found ${total} natural remedies for your ${symptoms.length} symptom${symptoms.length !== 1 ? 's' : ''}`;
    document.getElementById('symptom-tags').innerHTML = symptoms.map(s => `<span class="symptom-tag">${escapeHtml(s)}</span>`).join('');
    document.getElementById('count-all').textContent = allRemedies.length;
    document.getElementById('count-ayurvedic').textContent = (results.ayurvedic||[]).length;
    document.getElementById('count-herbal').textContent = (results.herbal||[]).length;
    document.getElementById('count-supplement').textContent = (results.supplement||[]).length;

    if (skeletonGrid) skeletonGrid.classList.remove('show');
    renderRemedies(allRemedies);

    document.querySelectorAll('.tab-btn').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            const cat = tab.dataset.category;
            renderRemedies(cat === 'all' ? allRemedies : (results[cat] || []));
        });
    });

    if (allRemedies.length === 0) {
        document.getElementById('empty-state').style.display = 'block';
        document.getElementById('category-tabs').style.display = 'none';
    }
}

function renderRemedies(remedies) {
    const grid = document.getElementById('results-grid');
    const empty = document.getElementById('empty-state');
    if (remedies.length === 0) { grid.innerHTML = ''; empty.style.display = 'block'; return; }
    empty.style.display = 'none';

    grid.innerHTML = remedies.map((r, i) => {
        const badgeClass = `badge-${r.category}`;
        const catLabel = r.category.charAt(0).toUpperCase() + r.category.slice(1);

        // Evidence badge
        const evMap = { strong: ['ev-strong', '🟢 Strong Evidence'], moderate: ['ev-moderate', '🟡 Moderate Evidence'], traditional: ['ev-traditional', '🔴 Traditional Use'] };
        const [evClass, evLabel] = evMap[r.evidence_level] || evMap.traditional;

        const matchedHtml = (r.matched_symptoms||[]).map(s => `<span class="matched-badge">✓ ${escapeHtml(s)}</span>`).join('');
        const benefitsHtml = (r.benefits||[]).map(b => `<li>${escapeHtml(b)}</li>`).join('');
        const cautionsHtml = (r.cautions||[]).map(c => `<div class="caution-item">${escapeHtml(c)}</div>`).join('');

        // Interaction warnings
        let warningHtml = '';
        if (r._interaction_warnings && r._interaction_warnings.length > 0) {
            warningHtml = r._interaction_warnings.map(w => `<div class="interaction-warning">⚠️ ${escapeHtml(w)}</div>`).join('');
        }

        // References
        let refsHtml = '';
        if (r.references && r.references.length > 0) {
            const refItems = r.references.map(ref => {
                const [title, url, year] = ref;
                return `<div class="ref-item">📄 ${escapeHtml(title)} (${year}) <a href="${escapeHtml(url)}" target="_blank" rel="noopener">PubMed →</a></div>`;
            }).join('');
            refsHtml = `<div class="remedy-refs">
                <button class="refs-toggle" onclick="this.classList.toggle('open');this.nextElementSibling.classList.toggle('show')"><span class="arrow">▶</span> ${r.references.length} Research Reference${r.references.length>1?'s':''}</button>
                <div class="refs-list">${refItems}</div>
            </div>`;
        }

        return `
        <div class="remedy-card" style="animation-delay:${i*0.05}s">
            <div class="remedy-header">
                <div class="remedy-name">${escapeHtml(r.name)}</div>
                <div class="remedy-badges">
                    <span class="evidence-badge ${evClass}">${evLabel}</span>
                    <span class="remedy-type-badge ${badgeClass}">${catLabel}</span>
                </div>
            </div>
            <div class="remedy-desc">${escapeHtml(r.description)}</div>
            ${matchedHtml ? `<div class="remedy-section-title">Matched Symptoms</div><div class="remedy-matched">${matchedHtml}</div>` : ''}
            <div class="remedy-section-title">Benefits</div><ul class="remedy-benefits">${benefitsHtml}</ul>
            <div class="remedy-section-title">Suggested Dosage</div><div class="remedy-dosage">${escapeHtml(r.dosage||'')}</div>
            ${warningHtml}
            ${cautionsHtml ? `<div class="remedy-section-title">Cautions</div><div class="remedy-cautions">${cautionsHtml}</div>` : ''}
            ${refsHtml}
            <div class="remedy-footer">
                <a href="${escapeHtml(r.amazon_url||'#')}" target="_blank" rel="noopener noreferrer" class="btn btn-amazon">🛒 View on Amazon</a>
            </div>
        </div>`;
    }).join('');
}

function escapeHtml(str) { const d = document.createElement('div'); d.textContent = str; return d.innerHTML; }
function escapeRegex(str) { return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
