// Speech synthesis state
let soundEnabled = false;
let currentFlowHistory = null; // For viewing flow from history
let speechQueue = [];
let isSpeaking = false;
let voices = [];

// Pacing State
let nextMessageTime = 0; // Timestamp when the next message is allowed to show

// Preset speed levels: 50-100-150-175-200-225-250-300-400-500-600-700-Instant
const SPEED_LEVELS = [50, 100, 150, 175, 200, 225, 250, 300, 400, 500, 600, 700, 999];
let currentSpeedIndex = 6; // Start at 250 WPM

// Prediction State
let userPrediction = null;
let predictionResolve = null;

// Audio Context for victory sounds
let audioContext = null;

// =============================================
// PREDICTION BETTING
// =============================================
function showPredictionModal() {
    return new Promise((resolve) => {
        predictionResolve = resolve;
        document.getElementById('prediction-modal').classList.remove('hidden');
    });
}

function submitPrediction(choice) {
    userPrediction = choice;
    document.getElementById('prediction-modal').classList.add('hidden');
    if (predictionResolve) {
        predictionResolve(choice);
        predictionResolve = null;
    }
}

function showPredictionResult(actualWinner) {
    if (!userPrediction) return; // No prediction made

    const correct = userPrediction === actualWinner;
    const resultEl = document.createElement('div');
    resultEl.className = `prediction-result ${correct ? 'correct' : 'wrong'}`;
    resultEl.textContent = correct ? '✅ You called it!' : '❌ Wrong call!';
    document.body.appendChild(resultEl);

    // Remove after animation
    setTimeout(() => resultEl.remove(), 3000);

    // Track accuracy in localStorage
    const stats = JSON.parse(localStorage.getItem('predictionStats') || '{"correct":0,"total":0}');
    stats.total++;
    if (correct) stats.correct++;
    localStorage.setItem('predictionStats', JSON.stringify(stats));
}

// =============================================
// VICTORY SOUNDS (Web Audio API)
// =============================================
function initAudio() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
}

function playVictorySound() {
    initAudio();

    // Create a triumphant fanfare using oscillators
    const now = audioContext.currentTime;

    // Note frequencies for a victory fanfare (C major chord arpeggio)
    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6

    notes.forEach((freq, i) => {
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();

        osc.type = 'sine';
        osc.frequency.value = freq;

        gain.gain.setValueAtTime(0, now + i * 0.15);
        gain.gain.linearRampToValueAtTime(0.3, now + i * 0.15 + 0.05);
        gain.gain.linearRampToValueAtTime(0, now + i * 0.15 + 0.4);

        osc.connect(gain);
        gain.connect(audioContext.destination);

        osc.start(now + i * 0.15);
        osc.stop(now + i * 0.15 + 0.5);
    });
}

function playScoreChime(positive) {
    initAudio();

    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();

    osc.type = 'sine';
    osc.frequency.value = positive ? 880 : 440; // High for positive, low for negative

    const now = audioContext.currentTime;
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.linearRampToValueAtTime(0, now + 0.2);

    osc.connect(gain);
    gain.connect(audioContext.destination);

    osc.start(now);
    osc.stop(now + 0.2);
}

// =============================================
// STREAK TRACKING
// =============================================
function updateStreak() {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const lastDate = localStorage.getItem('lastDebateDate');
    let streak = parseInt(localStorage.getItem('debateStreak') || '0');

    if (lastDate === today) {
        // Already debated today, just increment debates count
        const todayCount = parseInt(localStorage.getItem('debatesToday') || '0') + 1;
        localStorage.setItem('debatesToday', todayCount);
    } else {
        // New day
        const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

        if (lastDate === yesterday) {
            // Consecutive day - increment streak
            streak++;
        } else {
            // Streak broken - reset
            streak = 1;
        }

        localStorage.setItem('debateStreak', streak);
        localStorage.setItem('lastDebateDate', today);
        localStorage.setItem('debatesToday', '1');
    }

    // Update display
    const badge = document.getElementById('streak-badge');
    if (badge) {
        badge.textContent = `🔥 ${streak}`;
    }
}

function initStreakDisplay() {
    const streak = localStorage.getItem('debateStreak') || '0';
    const badge = document.getElementById('streak-badge');
    if (badge) {
        badge.textContent = `🔥 ${streak}`;
    }
}

// Initialize streak on page load
document.addEventListener('DOMContentLoaded', initStreakDisplay);

// Get current WPM (for real-time reading during typing)
function getCurrentWPM() {
    return SPEED_LEVELS[currentSpeedIndex];
}

// Adjust speed via +/- buttons (steps through preset levels)
function adjustWPM(delta) {
    if (delta > 0) {
        currentSpeedIndex = Math.min(SPEED_LEVELS.length - 1, currentSpeedIndex + 1);
    } else {
        currentSpeedIndex = Math.max(0, currentSpeedIndex - 1);
    }
    const wpm = SPEED_LEVELS[currentSpeedIndex];
    const display = document.getElementById('wpm-display');
    if (display) {
        display.textContent = wpm === 999 ? '∞' : wpm;
    }
}

// CURRENT DEBATE STYLES
let currentAdvocateTone = '';
let currentSkepticTone = '';

function loadVoices() {
    voices = window.speechSynthesis.getVoices();
    populateVoiceDropdowns();
}

function populateVoiceDropdowns() {
    const dropdowns = ['advocate-voice', 'skeptic-voice', 'judge-voice'];

    dropdowns.forEach(id => {
        const select = document.getElementById(id);
        if (!select) return;

        // Preserve current selection if refreshing
        const currentVal = select.value;

        // Clear except first "Auto" option
        select.innerHTML = '<option value="">Auto Voice</option>';

        voices.forEach(voice => {
            const option = document.createElement('option');
            // Use name as value for easy lookup
            option.value = voice.name;
            option.textContent = `${voice.name} (${voice.lang})`;
            select.appendChild(option);
        });

        if (currentVal) select.value = currentVal;
    });
}

window.speechSynthesis.onvoiceschanged = loadVoices;
// Initial load
loadVoices();

// Locale priority: US > UK > AU > IN > ZA (South Africa)
const localePriority = ['en-US', 'en-GB', 'en-AU', 'en-IN', 'en-ZA'];

// Voice name hints by gender
const femaleHints = ['aria', 'jenny', 'zira', 'samantha', 'salli', 'joanna', 'kendra', 'hazel', 'susan', 'karen', 'moira', 'fiona', 'veena', 'female'];
const maleHints = ['david', 'mark', 'guy', 'matthew', 'joey', 'daniel', 'george', 'ravi', 'male'];

let selectedLocale = null;
let cachedFemaleVoice = null;
let cachedMaleVoice = null;

function findVoicesForLocale(locale) {
    const localeVoices = voices.filter(v => v.lang === locale);
    const female = localeVoices.find(v => femaleHints.some(h => v.name.toLowerCase().includes(h)));
    const male = localeVoices.find(v => maleHints.some(h => v.name.toLowerCase().includes(h)));
    return { female, male, hasBoth: !!(female && male) };
}

function findBestVoiceByGender(preferFemale) {
    // Search through locales in priority order for this gender
    const hints = preferFemale ? femaleHints : maleHints;
    for (const locale of localePriority) {
        const localeVoices = voices.filter(v => v.lang === locale);
        const voice = localeVoices.find(v => hints.some(h => v.name.toLowerCase().includes(h)));
        if (voice) {
            console.log(`Best ${preferFemale ? 'female' : 'male'} voice from ${locale}:`, voice.name);
            return voice;
        }
    }
    // Ultimate fallback: any English voice
    const englishVoices = voices.filter(v => v.lang.startsWith('en'));
    return englishVoices[0] || voices[0];
}

function initializeVoices() {
    console.log('Available voices:', voices.map(v => `${v.name} (${v.lang})`));

    // Try to find a locale with both genders first
    for (const locale of localePriority) {
        const result = findVoicesForLocale(locale);
        if (result.hasBoth) {
            selectedLocale = locale;
            cachedFemaleVoice = result.female;
            cachedMaleVoice = result.male;
            console.log(`Matched locale: ${locale} (both genders available)`);
            console.log(`  Female: ${cachedFemaleVoice.name}, Male: ${cachedMaleVoice.name}`);
            return;
        }
    }

    // No single locale has both - find best for each gender independently
    console.log('No locale has both genders, finding best per-gender...');
    cachedFemaleVoice = findBestVoiceByGender(true);
    cachedMaleVoice = findBestVoiceByGender(false);
}

function findVoice(preferFemale) {
    if (voices.length === 0) return null;

    // Initialize once
    if (!cachedFemaleVoice && !cachedMaleVoice) {
        initializeVoices();
    }

    const voice = preferFemale ? cachedFemaleVoice : cachedMaleVoice;
    console.log(`Using ${preferFemale ? 'female' : 'male'} voice:`, voice?.name || 'none');
    return voice || voices[0];
}

// Voice settings per role
const voiceSettings = {
    'for': { pitch: 1.1, rate: 1.0, female: true },
    'against': { pitch: 0.9, rate: 0.95, female: false },
    'judge': { pitch: 1.0, rate: 0.85, female: false }
};

function toggleSound() {
    const checkbox = document.getElementById('sound-toggle-checkbox');

    // If called from checkbox, use its state; otherwise toggle
    if (checkbox) {
        soundEnabled = checkbox.checked;
    } else {
        soundEnabled = !soundEnabled;
    }

    // Sync checkbox state
    if (checkbox) checkbox.checked = soundEnabled;

    // Update toggle text
    const toggleText = document.querySelector('.audio-toggle-text');
    if (toggleText) {
        toggleText.textContent = soundEnabled ? '🔊 Audio Enabled' : '🔇 Audio Disabled';
    }

    // Show/hide voice sections based on audio state
    document.querySelectorAll('.voice-section').forEach(section => {
        section.classList.toggle('hidden', !soundEnabled);
    });

    // Note: When audio is enabled, typing is now synced via SpeechSynthesis 
    // boundary events in renderWithAudioSync(), so no WPM override needed.

    if (!soundEnabled) {
        window.speechSynthesis.cancel();
        speechQueue = [];
        isSpeaking = false;
    }
}

function previewVoice(dropdownId) {
    const select = document.getElementById(dropdownId);
    const voiceName = select.value;

    // Cancel any current speech
    window.speechSynthesis.cancel();

    const sampleText = "This is how I sound. Ready to debate?";
    const utterance = new SpeechSynthesisUtterance(sampleText);

    if (voiceName) {
        const voice = voices.find(v => v.name === voiceName);
        if (voice) utterance.voice = voice;
    } else {
        // Auto voice - use default based on role
        const role = dropdownId.includes('advocate') ? 'for' : 'against';
        const settings = voiceSettings[role];
        const voice = findVoice(settings.female);
        if (voice) utterance.voice = voice;
        utterance.pitch = settings.pitch;
        utterance.rate = settings.rate;
    }

    window.speechSynthesis.speak(utterance);
}

function sanitizeForSpeech(text) {
    return text
        .replace(/\*\*(.+?)\*\*/g, '$1')   // Remove bold **text**
        .replace(/\*(.+?)\*/g, '$1')       // Remove italic *text*
        .replace(/__(.+?)__/g, '$1')       // Remove bold __text__
        .replace(/_(.+?)_/g, '$1')         // Remove italic _text_
        .replace(/#{1,6}\s*/g, '')         // Remove headers
        .replace(/^\s*[-*+]\s+/gm, '')     // Remove bullet points
        .replace(/^\s*\d+\.\s+/gm, '')     // Remove numbered lists
        .replace(/`(.+?)`/g, '$1')         // Remove inline code
        .replace(/\[(.+?)\]\(.+?\)/g, '$1') // Remove links, keep text
        .trim();
}

function speakText(text, role) {
    if (!soundEnabled) return;
    const cleanText = sanitizeForSpeech(text);
    speechQueue.push({ text: cleanText, role });
    processQueue();
}

function processQueue() {
    if (isSpeaking || speechQueue.length === 0) return;

    const { text, role } = speechQueue.shift();
    const utterance = new SpeechSynthesisUtterance(text);

    const settings = voiceSettings[role] || voiceSettings['judge'];
    utterance.pitch = settings.pitch;
    utterance.rate = settings.rate;

    // Determine voice: Check User Selection first, then Auto Fallback
    let selectedVoiceName = '';
    if (role === 'for') selectedVoiceName = document.getElementById('advocate-voice')?.value;
    else if (role === 'against') selectedVoiceName = document.getElementById('skeptic-voice')?.value;
    else if (role === 'judge') selectedVoiceName = document.getElementById('judge-voice')?.value;

    let voice = null;
    if (selectedVoiceName) {
        voice = voices.find(v => v.name === selectedVoiceName);
    }

    // Fallback if no user selection or voice not found
    if (!voice) {
        voice = findVoice(settings.female);
    }

    if (voice) utterance.voice = voice;

    isSpeaking = true;

    utterance.onend = () => {
        isSpeaking = false;
        processQueue();
    };

    utterance.onerror = () => {
        isSpeaking = false;
        processQueue();
    };

    window.speechSynthesis.speak(utterance);
}

// --- PACING LOGIC ---

function calculateReadingDelay(text) {
    const wpm = currentWPM;

    // Very high WPM = nearly instant
    if (wpm >= 500) return 200;

    const wordCount = text.trim().split(/\s+/).length;
    // Calculate reading time in milliseconds
    const readingTimeMs = (wordCount / wpm) * 60 * 1000;
    // Return the delay (minimum 1 second for very fast settings)
    return Math.max(1000, readingTimeMs);
}

async function enforcePacing() {
    const now = Date.now();
    if (nextMessageTime > now) {
        const waitTime = nextMessageTime - now;
        if (waitTime > 100) {
            // Show a "typing" indicator or just wait? For now, just wait.
            // Could add "Judge is analyzing..." but clean wait is finest.
            await new Promise(resolve => setTimeout(resolve, waitTime));
        }
    }
}

function updatePacing(text) {
    const delay = calculateReadingDelay(text);
    nextMessageTime = Date.now() + delay;
}

// --- SCROLL LOGIC ---

function setupSmartScroll() {
    const container = document.getElementById('main-discussion');
    const indicator = document.createElement('div');
    indicator.className = 'new-messages-indicator';
    // indicator.innerHTML = 'New Messages ⬇️'; // REMOVED: Using pure CSS shape (Ive Style)
    indicator.onclick = () => {
        container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
        indicator.classList.remove('visible');
    };
    document.body.appendChild(indicator);

    container.addEventListener('scroll', () => {
        // We use a small buffer (50px) to consider "at bottom"
        const isAtBottom = container.scrollHeight - container.scrollTop <= container.clientHeight + 50;
        if (isAtBottom) {
            indicator.classList.remove('visible');
        }
    });
}

function isUserAtBottom() {
    const container = document.getElementById('main-discussion');
    // Buffer of 100px allows for some fuzziness
    return container.scrollHeight - container.scrollTop <= container.clientHeight + 100;
}

// Updated smart scroll: uses the boolean passed from BEFORE the render
function handleScrollPostRender(wasAtBottom) {
    const container = document.getElementById('main-discussion');
    const indicator = document.querySelector('.new-messages-indicator');

    // Only show if there is actually content hidden below the fold
    const isContentHidden = container.scrollHeight > (container.scrollTop + container.clientHeight + 10);

    if (indicator) {
        if (isContentHidden) {
            indicator.classList.add('visible');
        } else {
            indicator.classList.remove('visible');
        }
    }
}


// --- CLIENT-SIDE DEBATE PROTOCOL ---

let debateState = {
    history: [],
    context: { for: [], against: [] },
    round: 0,
    topic: "",
    config: {},
    active: false,
    paused: false,              // NEW: debate is paused
    pauseResolve: null,         // NEW: resolves when resumed
    resolveHumanInput: null,    // Function to resolve the Promise when human submits
    resolveJudgeInput: null     // Function to resolve the Promise when human judge submits
};

// Enable/disable controls that can't change during an active debate
function setDebateControlsEnabled(enabled) {
    const controls = [
        'topic-input',
        'advocate-tone', 'skeptic-tone',
        'advocate-model', 'skeptic-model', 'judge-model'
    ];

    controls.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.disabled = !enabled;
    });

    // Debate button - change text and behavior
    const debateBtn = document.querySelector('.debate-btnGlass');
    if (debateBtn) {
        if (enabled) {
            debateBtn.textContent = 'DEBATE';
            debateBtn.disabled = false;
        } else {
            debateBtn.textContent = 'STOP';
            debateBtn.disabled = false; // Keep enabled for stopping (future feature)
        }
    }

    // Fire button (random topic)
    const fireBtn = document.querySelector('.chaos-btnGlass');
    if (fireBtn) fireBtn.disabled = !enabled;
}

// Handle DEBATE/PAUSE/RESUME button click - routes to correct function based on state
function handleDebateButton() {
    if (debateState.paused) {
        resumeDebate();
    } else if (debateState.active || debateState.isDebating) {
        pauseDebate();
    } else {
        showSettings();
    }
}

// Update the main debate button text based on state
function updateDebateButtonUI() {
    const btn = document.querySelector('.debate-btnGlass');
    const stopBtn = document.getElementById('stop-btn');
    if (!btn) return;

    if (debateState.paused) {
        btn.textContent = '▶ RESUME';
        btn.classList.add('paused');
        if (stopBtn) stopBtn.classList.remove('hidden');
    } else if (debateState.active) {
        btn.textContent = '⏸ PAUSE';
        btn.classList.remove('paused');
        if (stopBtn) stopBtn.classList.remove('hidden');
    } else {
        btn.textContent = 'DEBATE';
        btn.classList.remove('paused');
        if (stopBtn) stopBtn.classList.add('hidden');
    }
}

// Show/hide the pause overlay
function setPauseOverlay(visible) {
    let overlay = document.getElementById('pause-overlay');

    if (visible) {
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'pause-overlay';
            overlay.className = 'pause-overlay';
            overlay.innerHTML = `
                <div class="pause-indicator">
                    <span class="pause-icon">⏸</span>
                    <span class="pause-text">PAUSED</span>
                    <span class="pause-round">Round ${debateState.round}</span>
                </div>
            `;
            document.querySelector('.discussion-container').appendChild(overlay);
        }
        overlay.classList.add('visible');
    } else if (overlay) {
        overlay.classList.remove('visible');
        setTimeout(() => overlay.remove(), 300);
    }
}

// Global reference for aborting pending fetch requests
let currentAbortController = null;

// Pause the debate - waits at end of current message
function pauseDebate() {
    if (!debateState.active || debateState.paused) return;

    console.log("Pausing debate...");
    debateState.paused = true;

    // Pause speech instead of cancelling
    if (window.speechSynthesis.speaking) {
        window.speechSynthesis.pause();
    }
    isSpeaking = false;

    // Update UI
    updateDebateButtonUI();
    setPauseOverlay(true);

    // Hide human input if visible
    setInputState('waiting');

    console.log("Debate paused");
}

// Resume the debate from where we left off
function resumeDebate() {
    if (!debateState.active || !debateState.paused) return;

    console.log("Resuming debate...");
    debateState.paused = false;

    // Resume speech
    if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
    }
    isSpeaking = true;

    // Resolve the pause promise to continue the loop (if waiting between turns)
    if (debateState.pauseResolve) {
        debateState.pauseResolve();
        debateState.pauseResolve = null;
    }

    // Update UI
    updateDebateButtonUI();
    setPauseOverlay(false);

    console.log("Debate resumed");
}

function stopDebate() {
    console.log("Stopping debate...");

    // Abort any pending fetch requests
    if (currentAbortController) {
        currentAbortController.abort();
        currentAbortController = null;
    }

    // Cancel any pending speech
    window.speechSynthesis.cancel();
    speechQueue = [];
    isSpeaking = false;

    // Reset debate state
    debateState.active = false;
    debateState.isDebating = false;
    debateState.paused = false;

    // Resolve any pending pause promise
    if (debateState.pauseResolve) {
        debateState.pauseResolve();
        debateState.pauseResolve = null;
    }

    // Re-enable controls
    setDebateControlsEnabled(true);

    // Reset logo state
    const logo = document.querySelector('.header-logo');
    if (logo) logo.classList.remove('debating');

    // Cleanup UI
    removeLoadingMessages();
    setInputState('hidden');
    setPauseOverlay(false);
    updateDebateButtonUI();

    // Hide footer config
    const debateConfig = document.getElementById('debate-config');
    if (debateConfig) debateConfig.classList.add('hidden');

    // Show stopped message
    const stream = document.getElementById('discussion-stream');
    const stoppedMsg = document.createElement('div');
    stoppedMsg.className = 'message msg-judge';
    stoppedMsg.innerHTML = `
        <div class="bubble" style="text-align: center; color: #f59e0b;">
            ⚠️ Debate stopped by user
        </div>
    `;
    stream.appendChild(stoppedMsg);

    console.log("Debate stopped successfully");
}

async function startDebate() {
    // If debate is already running, stop it instead
    if (debateState.active || debateState.isDebating) {
        stopDebate();
        return;
    }

    console.log("Starting debate..."); // Debug Log
    const topicInput = document.getElementById('topic-input');
    const topic = topicInput.value || "Is Buddhism a religion?";

    // Config
    const practiceConfig = window._practiceConfig || {};
    const config = {
        advocateTone: document.getElementById('advocate-tone').value,
        skepticTone: document.getElementById('skeptic-tone').value,
        advocateModel: document.getElementById('advocate-model').value,
        skepticModel: document.getElementById('skeptic-model').value,
        judgeModel: document.getElementById('judge-model').value,
        caseText: practiceConfig.caseText || (document.getElementById('case-text')?.value || '').trim(),
        caseOwner: practiceConfig.caseOwner || ''
    };
    // Clear practice config after use
    window._practiceConfig = null;

    // UI Setup
    currentAdvocateTone = config.advocateTone.charAt(0).toUpperCase() + config.advocateTone.slice(1);
    currentSkepticTone = config.skepticTone.charAt(0).toUpperCase() + config.skepticTone.slice(1);

    const stream = document.getElementById('discussion-stream');
    stream.innerHTML = '';
    window.speechSynthesis.cancel();
    speechQueue = [];
    isSpeaking = false;
    nextMessageTime = 0;

    // Disable controls that can't change during debate
    setDebateControlsEnabled(false);

    // Show config in footer during debate
    const debateConfig = document.getElementById('debate-config');
    if (debateConfig) {
        const modelNames = { gemini: 'Gemini', deepseek: 'DeepSeek', kimi: 'Kimi', human: 'Human' };
        const forModel = modelNames[config.advocateModel] || config.advocateModel;
        const againstModel = modelNames[config.skepticModel] || config.skepticModel;
        const judgeModel = modelNames[config.judgeModel] || config.judgeModel;
        debateConfig.textContent = `🟢 ${forModel}/${currentAdvocateTone} vs 🔴 ${againstModel}/${currentSkepticTone} | ⚖️ ${judgeModel}`;
        debateConfig.classList.remove('hidden');
    }

    // Logo State
    document.querySelector('.header-logo').classList.add('debating');

    // Reset State
    debateState = {
        history: [],
        context: { for: [], against: [] },
        round: 0,
        topic: topic,
        config: config,
        active: true,
        paused: false,              // Reset pause state
        pauseResolve: null,         // Reset pause resolver
        resolveHumanInput: null,
        isDebating: true,
        score: 0 // Range: -10 (Skeptic) to +10 (Advocate)
    };

    // Update button to show PAUSE mode
    updateDebateButtonUI();

    // Dynamic Tagline
    const tagline = document.getElementById('tagline');
    const hasHuman = config.advocateModel === 'human' || config.skepticModel === 'human';
    const allHuman = config.advocateModel === 'human' && config.skepticModel === 'human';
    const allAI = config.advocateModel !== 'human' && config.skepticModel !== 'human';

    if (allHuman) tagline.innerText = 'Human vs Human';
    else if (allAI) tagline.innerText = 'Pick a topic. Watch AI Agents Debate. See Who Wins.';
    else tagline.innerText = 'Human vs AI';

    // UI Updates
    // (welcome-screen removed in previous refactor)
    document.getElementById('discussion-stream').innerHTML = '';
    document.getElementById('discussion-stream').classList.remove('hidden');

    // Show Score Bar and reset crowns
    document.getElementById('score-container').style.display = 'flex';
    document.getElementById('crown-advocate').style.display = 'none';
    document.getElementById('crown-skeptic').style.display = 'none';
    updateScoreBar(0, "Debate Start");
    updateRoundDisplay(0); // Initialize round counter

    // PERSISTENT DOCK SETUP
    // If Human is playing, show the dock immediately (Waiting State)
    if (config.advocateModel === 'human' || config.skepticModel === 'human') {
        setInputState('waiting');
    } else {
        setInputState('hidden');
    }

    // STEP 1: Initialize (Analysis & Research)
    renderLoadingMessage({ text: `Analyzing '${topic}'...` });

    try {
        const initRes = await fetch('/api/init_debate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ topic: topic })
        });

        if (!initRes.ok) throw new Error(`Init Failed: ${initRes.status}`);

        const initData = await initRes.json();

        if (!initData.is_debatable) {
            removeLoadingMessages();
            renderMessage({ role: 'judge', text: initData.factual_answer, round: 'Answer', state: 'speaking' });
            renderMessage({ role: 'judge', text: "No debate needed for factual questions.", state: 'online' });
            document.querySelector('.header-logo').classList.remove('debating');
            // Hide dock if debate canceled
            setInputState('hidden');
            // Hide scoreboard (no debate = no scores)
            document.getElementById('score-container').style.display = 'none';
            // Hide footer config
            const debateConfig = document.getElementById('debate-config');
            if (debateConfig) debateConfig.classList.add('hidden');
            // Reset state
            debateState.isDebating = false;
            debateState.active = false;
            // Reset button to DEBATE (was stuck on STOP)
            setDebateControlsEnabled(true);
            return;
        }

        // Store Context
        debateState.context.for = initData.for_data;
        debateState.context.against = initData.against_data;

        // Visualize Research
        renderLoadingMessage({ text: "Researching perspectives..." });
        await new Promise(r => setTimeout(r, 1000));

        // Display Scraped Data (Optional/Fast)
        for (const d of initData.against_data) {
            renderMessage({ role: 'against', text: d, round: 'Research', state: 'searching' });
            await new Promise(r => setTimeout(r, 50));
        }
        for (const d of initData.for_data) {
            renderMessage({ role: 'for', text: d, round: 'Research', state: 'searching' });
            await new Promise(r => setTimeout(r, 50));
        }

        removeLoadingMessages();
        renderMessage({ role: 'judge', text: "Let the debate begin!", state: 'online' });

        // Start Protocol Loop
        await runDebateProtocol();

    } catch (e) {
        console.error("Debate Error:", e);
        removeLoadingMessages();
        renderMessage({ role: 'judge', text: `SYSTEM ERROR: ${e.message}`, state: 'error' });
        document.querySelector('.header-logo').classList.remove('debating');
        setInputState('hidden');
        debateState.isDebating = false;
        document.getElementById('score-container').style.display = 'none';
    }
}

// Wait if debate is paused (returns a Promise that resolves when resumed)
async function waitIfPaused() {
    if (debateState.paused) {
        console.log("Waiting for resume...");
        await new Promise(resolve => {
            debateState.pauseResolve = resolve;
        });
        console.log("Resumed from pause");
    }
}

async function runDebateProtocol() {
    try {
        const { config } = debateState;
        const maxRounds = 15;
        let winner = null;

        // ROUND 0: Opening Statements
        renderLoadingMessage({ text: "Opening Statements..." });

        // Advocate Opening
        await executeTurn('advocate', true, false, false);
        await new Promise(r => setTimeout(r, 1500));
        await waitIfPaused();  // Check for pause after each turn
        if (!debateState.active) return;

        // Skeptic Opening
        await executeTurn('skeptic', true, false, false);
        await new Promise(r => setTimeout(r, 1500));
        await waitIfPaused();  // Check for pause after each turn
        if (!debateState.active) return;

        removeLoadingMessages();

        // MAIN LOOP
        let debateEnded = false;
        debateState.round = 1;

        while (!debateEnded && debateState.round <= maxRounds && debateState.active) {
            await waitIfPaused();  // Check for pause at start of each round
            if (!debateState.active) return;

            // Advocate Turn - typewriter effect handles pacing
            await executeTurn('advocate', false, false, false);
            await new Promise(r => setTimeout(r, 500)); // Small buffer between turns
            await waitIfPaused();  // Check for pause after advocate turn
            if (!debateState.active) return;

            // Skeptic Turn - typewriter effect handles pacing
            await executeTurn('skeptic', false, false, false);
            await new Promise(r => setTimeout(r, 500)); // Small buffer between turns
            await waitIfPaused();  // Check for pause after skeptic turn
            if (!debateState.active) return;

            // Judge Evaluation - Human judges from round 1, AI from round 2
            const shouldJudge = config.judgeModel === 'human' || debateState.round >= 2;

            if (shouldJudge) {
                // Note: using outer debateEnded and winner variables (no let re-declaration)

                if (config.judgeModel === 'human') {
                    // HUMAN JUDGE - Show score slider UI
                    const result = await handleHumanJudge(false);

                    if (result.endDebate) {
                        // Human chose to end - now show the VERDICT UI to pick winner
                        const verdictResult = await handleHumanJudge(true);

                        // verdictResult.winner is 'advocate' or 'skeptic'
                        winner = verdictResult.winner;
                        debateEnded = true;
                    }
                } else {
                    // AI JUDGE
                    const judgeRes = await executeTurn('judge', false, false, true); // is_evaluation=true

                    // Check if debate was stopped during the turn
                    if (!debateState.active || (typeof judgeRes === 'object' && judgeRes?.stopped)) {
                        return; // Exit cleanly, stopDebate() handles UI
                    }

                    // Check for Termination - expanded to match backend
                    const text = (typeof judgeRes === 'string' ? judgeRes : judgeRes?.text || '').toUpperCase();
                    const terminationPhrases = [
                        "ADVOCATE WINS", "SKEPTIC WINS",
                        "ADVOCATE PREVAILS", "SKEPTIC PREVAILS",
                        "THE ADVOCATE WINS", "THE SKEPTIC WINS",
                        "THE ADVOCATE PREVAILS", "THE SKEPTIC PREVAILS",
                        "ADVOCATE TAKES IT", "SKEPTIC TAKES IT",
                        "ADVOCATE IS THE WINNER", "SKEPTIC IS THE WINNER",
                        "DEADLOCK", "STALEMATE", "VERDICT",
                        "I FIND IN FAVOR OF", "DECLARE THE WINNER",
                        "THE WINNER IS", "WINS THE DEBATE"
                    ];

                    if (terminationPhrases.some(phrase => text.includes(phrase))) {
                        // Determine winner from the evaluation text
                        if (text.includes("ADVOCATE") && (text.includes("WINS") || text.includes("PREVAILS") || text.includes("TAKES IT") || text.includes("FAVOR OF THE ADVOCATE"))) {
                            winner = 'advocate';
                        } else if (text.includes("SKEPTIC") && (text.includes("WINS") || text.includes("PREVAILS") || text.includes("TAKES IT") || text.includes("FAVOR OF THE SKEPTIC"))) {
                            winner = 'skeptic';
                        } else {
                            // Fallback to score
                            winner = debateState.score > 0 ? 'advocate' : debateState.score < 0 ? 'skeptic' : 'draw';
                        }
                        debateEnded = true;
                    }
                }

                if (debateEnded) {
                    // ALWAYS generate formal verdict before ending
                    await executeTurn('judge', false, true, false); // is_final=true

                    // Winner Celebration (only for non-draw)
                    if (winner && winner !== 'draw') triggerWinAnimation(winner);
                    saveDebateToHistory(debateState.topic, winner || 'Unknown');
                    renderMessage({ role: 'judge', text: "Session closed.", round: 'SYSTEM', state: 'online' });
                    document.querySelector('.header-logo').classList.remove('debating');
                    setInputState('hidden');
                    setJudgeInputState('hidden');
                    debateState.isDebating = false;
                    setDebateControlsEnabled(true);  // Re-enable controls
                    document.body.classList.remove('debate-fullscreen');
                    return; // Exit the loop
                }
            }

            debateState.round++;
            // Update round display
            updateRoundDisplay(debateState.round);
        }

        // If debate was stopped by user, don't do final verdict - stopDebate() already handled UI
        if (!debateState.active) {
            console.log("Debate was stopped by user, skipping final verdict.");
            return;
        }

        // FINAL VERDICT (If loop maxed out)
        if (config.judgeModel === 'human') {
            // HUMAN FINAL VERDICT - show binary choice
            const verdictResult = await handleHumanJudge(true);
            winner = verdictResult.winner;
        } else {
            // AI JUDGE - Get final verdict and parse winner from text
            const verdictResult = await executeTurn('judge', false, true, false); // is_final=true

            // Check if stopped during verdict
            if (!debateState.active || (typeof verdictResult === 'object' && verdictResult?.stopped)) {
                return; // Exit cleanly
            }

            const verdictText = (typeof verdictResult === 'string' ? verdictResult : verdictResult?.text || '').toUpperCase();

            // Parse winner from verdict text
            if (verdictText.includes('ADVOCATE') && (verdictText.includes('WINS') || verdictText.includes('PREVAILS') || verdictText.includes('FAVOR OF THE ADVOCATE') || verdictText.includes('WINNER'))) {
                winner = 'advocate';
            } else if (verdictText.includes('SKEPTIC') && (verdictText.includes('WINS') || verdictText.includes('PREVAILS') || verdictText.includes('FAVOR OF THE SKEPTIC') || verdictText.includes('WINNER'))) {
                winner = 'skeptic';
            } else {
                // Fallback: use score to determine winner
                winner = debateState.score > 0 ? 'advocate' : debateState.score < 0 ? 'skeptic' : 'draw';
            }
        }

        // WINNER CELEBRATION
        if (winner && winner !== 'draw') {
            triggerWinAnimation(winner);
        }

        // SAVE HISTORY
        saveDebateToHistory(debateState.topic, winner || 'Unknown');

        renderMessage({ role: 'judge', text: "Session closed.", round: 'SYSTEM', state: 'online' });
        document.querySelector('.header-logo').classList.remove('debating');
        setInputState('hidden');
        debateState.isDebating = false;
        setDebateControlsEnabled(true);  // Re-enable controls
        // Exit full screen mode
        document.body.classList.remove('debate-fullscreen');
        // Score bar stays visible until next debate starts

    } catch (e) {
        console.error("Protocol Error:", e);
        renderMessage({ role: 'judge', text: `PROTOCOL ERROR: ${e.message}`, state: 'error' });
        document.querySelector('.header-logo').classList.remove('debating');
        setInputState('hidden');
        debateState.isDebating = false;
        setDebateControlsEnabled(true);  // Re-enable controls on error
        document.body.classList.remove('debate-fullscreen');
        // Score bar stays visible
    }
}

// ... executeTurn and other functions remain ...
async function executeTurn(role, isOpening, isFinal, isEvaluation) {
    const { config, topic, history, context } = debateState;

    // Determine Model and Tone
    let model = 'gemini';
    let tone = 'casual';
    let contextData = [];

    if (role === 'advocate') {
        model = config.advocateModel;
        tone = config.advocateTone;
        contextData = context.for;
    } else if (role === 'skeptic') {
        model = config.skepticModel;
        tone = config.skepticTone;
        contextData = context.against;
    } else { // Judge
        model = config.judgeModel;
        tone = 'scholar'; // Judge always scholar/neutral
    }

    // HUMAN CHECK
    if (model === 'human') {
        return await handleHumanTurn(role, isOpening, isFinal, isEvaluation);
    }

    // AI GENERATION
    renderLoadingMessage({ text: `${role.toUpperCase()} is thinking...` });

    // Create AbortController for this turn
    currentAbortController = new AbortController();

    try {
        // Check if already stopped
        if (!debateState.active) {
            removeLoadingMessages();
            return { text: '', stopped: true };
        }
        const payload = {
            role: role,
            topic: topic,
            history: history,
            context_data: contextData,
            model_provider: model,
            tone: tone,
            is_opening: isOpening,
            is_final: isFinal,
            is_evaluation: isEvaluation,
            case_text: debateState.config.caseText || '',
            case_owner: debateState.config.caseOwner || ''
        };

        const res = await fetch('/api/turn', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: currentAbortController.signal
        });

        // Check if stopped while waiting for response
        if (!debateState.active) {
            removeLoadingMessages();
            return { text: '', stopped: true };
        }

        if (!res.ok) {
            const errText = await res.text();
            throw new Error(`API ${res.status}: ${errText.substring(0, 50)}`);
        }

        const data = await res.json();
        let text = data.text;
        let scoreDelta = 0;

        // Check for SCORE_DELTA in judge's output
        if (role === 'judge' && text.includes("|| SCORE_DELTA:")) {
            const parts = text.split("|| SCORE_DELTA:");
            text = parts[0].trim(); // Text to display
            scoreDelta = parseInt(parts[1].trim()); // Score change
            updateScoreBar(scoreDelta, text);
        }

        // Update State
        if (role !== 'judge' || isEvaluation || isFinal) {
            debateState.history.push(`${role.charAt(0).toUpperCase() + role.slice(1)}: ${text}`);
        }

        // Render
        removeLoadingMessages();

        const roleMap = { 'advocate': 'for', 'skeptic': 'against', 'judge': 'judge' };

        let roundLabel = "";
        if (isOpening) roundLabel = "Opening";
        else if (isFinal) roundLabel = "FINAL";
        else if (isEvaluation) roundLabel = `${debateState.round}.3`;
        else roundLabel = `${debateState.round}.${role === 'advocate' ? '1' : '2'}`;

        // Use typewriter effect for AI messages
        await renderMessageWithTypewriter({
            role: roleMap[role],
            text: text,
            state: isFinal ? 'verdict' : 'speaking',
            round: roundLabel
        });
        // Scroll is handled by typewriter function

        return text;

    } catch (e) {
        // Handle abort gracefully - don't show error
        if (e.name === 'AbortError') {
            console.log("Turn aborted");
            removeLoadingMessages();
            return { text: '', stopped: true };
        }

        console.error("Turn Error:", e);
        removeLoadingMessages();

        const errMap = { 'advocate': 'for', 'skeptic': 'against', 'judge': 'judge' };
        renderMessage({
            role: errMap[role] || 'judge',
            text: `[Connection Error: ${e.message}]`,
            state: 'error',
            round: 'ERR'
        });

        return `[Connection Error: ${e.message}]`;
    }
}

// INPUT DOCK STATE MANAGEMENT
function setInputState(state, role = null) {
    const container = document.getElementById('user-input-container');
    const textarea = document.getElementById('human-argument');
    const button = document.getElementById('submit-argument');

    if (!container) return; // Guard clause

    if (state === 'hidden') {
        container.classList.add('hidden');
        return;
    }

    container.classList.remove('hidden');

    if (state === 'waiting') {
        container.classList.add('waiting');
        textarea.disabled = true;
        button.disabled = true;
        textarea.placeholder = "Listening...";
        textarea.value = "";
        textarea.style.height = 'auto'; // Reset size
    } else if (state === 'active') {
        container.classList.remove('waiting');
        textarea.disabled = false;
        button.disabled = false;
        textarea.placeholder = `Reply as ${role}...`;
        textarea.focus();
    }
}

// HUMAN INPUT HANDLING
function handleHumanTurn(role, isOpening, isFinal, isEvaluation) {
    return new Promise((resolve) => {
        // Activate Dock
        setInputState('active', role === 'advocate' ? 'Advocate' : 'Skeptic');

        // Define the resolver
        debateState.resolveHumanInput = (text) => {
            // Switch back to waiting immediately
            setInputState('waiting');

            // Add to history and render
            debateState.history.push(`${role.charAt(0).toUpperCase() + role.slice(1)}: ${text}`);

            const roleMap = { 'advocate': 'for', 'skeptic': 'against' };

            let roundLabel = "";
            if (isOpening) roundLabel = "Opening";
            else if (isFinal) roundLabel = "FINAL";
            else if (isEvaluation) roundLabel = `${debateState.round}.3`;
            else roundLabel = `${debateState.round}.${role === 'advocate' ? '1' : '2'}`;

            renderMessage({
                role: roleMap[role],
                text: text,
                state: 'speaking',
                round: roundLabel
            });

            handleScrollPostRender();
            resolve(text);
        };
    });
}

function submitHumanTurn() {
    const textarea = document.getElementById('human-argument');
    const text = textarea.value.trim();
    if (!text) return;

    if (debateState.resolveHumanInput) {
        debateState.resolveHumanInput(text);
        debateState.resolveHumanInput = null;
    }
}

// Ctrl+Enter Shortcut & Auto-Resize
const humanInput = document.getElementById('human-argument');
if (humanInput) {
    humanInput.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.key === 'Enter') {
            submitHumanTurn();
        }
    });
    humanInput.addEventListener('input', function () {
        this.style.height = 'auto'; // Reset
        this.style.height = (this.scrollHeight) + 'px'; // Expand
    });
}

// =============================================
// HUMAN JUDGE INPUT HANDLING
// =============================================

function setJudgeInputState(state, isVerdictMode = false) {
    const container = document.getElementById('judge-input-container');
    const slider = document.getElementById('judge-score');
    const display = document.getElementById('score-display');
    const comment = document.getElementById('judge-comment');
    const continueBtn = document.getElementById('judge-continue');
    const endBtn = document.getElementById('judge-end');

    if (!container) return;

    if (state === 'hidden') {
        container.classList.add('hidden');
        return;
    }

    // Hide the debater input dock when showing judge UI
    setInputState('hidden');

    container.classList.remove('hidden');
    slider.value = 0;
    display.textContent = '0';
    comment.value = '';

    // Get sections
    const scoreSection = document.getElementById('score-section');
    const verdictSection = document.getElementById('verdict-section');
    const actionsDiv = container.querySelector('.judge-actions');

    if (isVerdictMode) {
        // VERDICT MODE: Show binary choice buttons, hide slider and normal actions
        document.querySelector('.judge-header').textContent = '⚖️ Declare the Winner';
        if (scoreSection) scoreSection.style.display = 'none';
        if (verdictSection) verdictSection.style.display = 'flex';
        if (actionsDiv) actionsDiv.style.display = 'none';
        comment.placeholder = 'Explain your verdict (optional)...';
    } else {
        // NORMAL MODE: Show slider and actions, hide verdict buttons
        document.querySelector('.judge-header').textContent = '⚖️ Your Judgment';
        if (scoreSection) scoreSection.style.display = 'flex';
        if (verdictSection) verdictSection.style.display = 'none';
        if (actionsDiv) actionsDiv.style.display = 'flex';
        comment.placeholder = 'Why? (optional)';
        continueBtn.style.display = 'inline-block';
        endBtn.textContent = 'End & Declare Winner';
    }

    // Update score display on slider change
    slider.oninput = () => {
        const val = parseInt(slider.value);
        display.textContent = val > 0 ? '+' + val : val.toString();
        display.style.color = val > 0 ? 'var(--accent-green)' : val < 0 ? 'var(--accent-red)' : 'var(--text-primary)';
    };
}

function handleHumanJudge(isForVerdict = false) {
    return new Promise((resolve) => {
        setJudgeInputState('active', isForVerdict);

        // In verdict mode, 'score' param will be winner string ('advocate'/'skeptic')
        // In normal mode, 'score' is a number from the slider
        debateState.resolveJudgeInput = (endDebate, scoreOrWinner, comment) => {
            setJudgeInputState('hidden');

            // Build judge response text
            let text = '';
            let shouldRenderMessage = true;
            let winner = null;

            if (isForVerdict) {
                // BINARY VERDICT - scoreOrWinner is 'advocate' or 'skeptic'
                winner = scoreOrWinner === 'advocate' ? 'Advocate' : 'Skeptic';
                text = `**FINAL VERDICT**: The ${winner} wins!`;
                if (comment) text += ` ${comment}`;
            } else if (endDebate) {
                // User clicked "End & Declare Winner" - don't render message,
                // just signal to show the verdict UI
                shouldRenderMessage = false;
            } else {
                // Normal round evaluation - scoreOrWinner is a number
                const score = scoreOrWinner;
                updateScoreBar(score, comment || 'Human Judge');
                const direction = score > 0 ? 'Advocate' : score < 0 ? 'Skeptic' : 'Neither';
                text = `+${Math.abs(score)} to ${direction}.`;
                if (comment) text += ` "${comment}"`;
                text += ' Continue.';
            }

            // Render judge message (if applicable)
            if (shouldRenderMessage && text) {
                debateState.history.push(`Judge: ${text}`);

                renderMessage({
                    role: 'judge',
                    text: text,
                    state: isForVerdict ? 'verdict' : 'speaking',
                    round: isForVerdict ? 'FINAL' : `${debateState.round}.3`
                });
            }

            handleScrollPostRender(true);
            resolve({ endDebate, winner: scoreOrWinner, comment, text });
        };
    });
}

function submitJudgeEvaluation(endDebate) {
    const slider = document.getElementById('judge-score');
    const comment = document.getElementById('judge-comment');

    const score = parseInt(slider.value);
    const commentText = comment.value.trim();

    console.log('submitJudgeEvaluation called:', { endDebate, score, commentText, sliderValue: slider.value });

    if (debateState.resolveJudgeInput) {
        debateState.resolveJudgeInput(endDebate, score, commentText);
        debateState.resolveJudgeInput = null;
    }
}

// Binary verdict submission - called from Advocate/Skeptic wins buttons
function submitVerdict(winner) {
    const comment = document.getElementById('judge-comment');
    const commentText = comment.value.trim();

    console.log('submitVerdict called:', { winner, commentText });

    if (debateState.resolveJudgeInput) {
        // Pass winner directly: 'advocate' or 'skeptic'
        debateState.resolveJudgeInput(true, winner, commentText);
        debateState.resolveJudgeInput = null;
    }
}

function markdownToHtml(text) {
    return text
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        .replace(/__(.+?)__/g, '<strong>$1</strong>')
        .replace(/_(.+?)_/g, '<em>$1</em>')
        .replace(/`(.+?)`/g, '<code>$1</code>')
        .replace(/\n/g, '<br>');
}

function renderMessage(data) {
    const stream = document.getElementById('discussion-stream');

    const msgDiv = document.createElement('div');
    msgDiv.className = `message msg-${data.role}`;
    if (data.state === 'verdict') msgDiv.classList.add('verdict-box');
    if (data.state === 'error') msgDiv.classList.add('error-box');

    const avatarMap = {
        'for': '/static/advocate_avatar.png',
        'against': '/static/skeptic_avatar.png',
        'judge': '/static/judge_avatar.png'
    };

    const nameMap = {
        'for': 'The Advocate',
        'against': 'The Skeptic',
        'judge': 'The Judge'
    };

    // Constructing the HTML structure
    let innerHTML = '';

    // Determine style label (if applicable)
    let styleLabel = '';
    if (data.role === 'for') styleLabel = `<div class="style-label">${currentAdvocateTone}</div>`;
    if (data.role === 'against') styleLabel = `<div class="style-label">${currentSkepticTone}</div>`;

    if (data.state === 'verdict') {
        const cleanText = markdownToHtml(data.text);
        innerHTML = `
            <div class="bubble">
                <span class="verdict-title">Final Judgment</span>
                <div class="text">${cleanText}</div>
            </div>
        `;
    } else {
        const cleanText = markdownToHtml(data.text);

        // Get model + flag for this role
        let modelFlag = '';
        if (debateState.config) {
            const modelMap = {
                'gemini': 'Gemini 🇺🇸',
                'deepseek': 'DeepSeek 🇨🇳',
                'kimi': 'Kimi 🇨🇳',
                'human': 'Human 👤'
            };
            if (data.role === 'for' && debateState.config.advocateModel) {
                modelFlag = `<div class="model-flag">${modelMap[debateState.config.advocateModel] || ''}</div>`;
            } else if (data.role === 'against' && debateState.config.skepticModel) {
                modelFlag = `<div class="model-flag">${modelMap[debateState.config.skepticModel] || ''}</div>`;
            } else if (data.role === 'judge' && debateState.config.judgeModel) {
                modelFlag = `<div class="model-flag">${modelMap[debateState.config.judgeModel] || ''}</div>`;
            }
        }

        innerHTML = `
            <div class="msg-header-row">
                <div class="avatar-block">
                    <img src="${avatarMap[data.role]}" class="msg-avatar">
                    ${modelFlag}
                </div>
                <div class="msg-name-block">
                    <span class="role-label">${nameMap[data.role]}</span>
                    <div class="msg-meta-row">
                        ${styleLabel}
                        ${data.round ? `<span class="round-label">${data.round}</span>` : ''}
                    </div>
                </div>
            </div>
            <div class="bubble">${cleanText}</div>
        `;
    }

    msgDiv.innerHTML = innerHTML;
    stream.appendChild(msgDiv);
}

// TYPEWRITER EFFECT - Renders message word-by-word at WPM rate
// When audio is enabled, uses SpeechSynthesis boundary events for true sync
async function renderMessageWithTypewriter(data) {
    const stream = document.getElementById('discussion-stream');

    const msgDiv = document.createElement('div');
    msgDiv.className = `message msg-${data.role}`;
    if (data.state === 'verdict') msgDiv.classList.add('verdict-box');
    if (data.state === 'error') msgDiv.classList.add('error-box');

    const avatarMap = {
        'for': '/static/advocate_avatar.png',
        'against': '/static/skeptic_avatar.png',
        'judge': '/static/judge_avatar.png'
    };

    const nameMap = {
        'for': 'The Advocate',
        'against': 'The Skeptic',
        'judge': 'The Judge'
    };

    // Style label
    let styleLabel = '';
    if (data.role === 'for') styleLabel = `<div class="style-label">${currentAdvocateTone}</div>`;
    if (data.role === 'against') styleLabel = `<div class="style-label">${currentSkepticTone}</div>`;

    // Create the structure with empty bubble for typing
    if (data.state === 'verdict') {
        msgDiv.innerHTML = `
            <div class="bubble">
                <span class="verdict-title">Final Judgment</span>
                <div class="text typewriter-target"></div>
            </div>
        `;
    } else {
        // Get model + flag for this role
        let modelFlag = '';
        if (debateState.config) {
            const modelMap = {
                'gemini': 'Gemini 🇺🇸',
                'deepseek': 'DeepSeek 🇨🇳',
                'kimi': 'Kimi 🇨🇳',
                'human': 'Human 👤'
            };
            if (data.role === 'for' && debateState.config.advocateModel) {
                modelFlag = `<div class="model-flag">${modelMap[debateState.config.advocateModel] || ''}</div>`;
            } else if (data.role === 'against' && debateState.config.skepticModel) {
                modelFlag = `<div class="model-flag">${modelMap[debateState.config.skepticModel] || ''}</div>`;
            } else if (data.role === 'judge' && debateState.config.judgeModel) {
                modelFlag = `<div class="model-flag">${modelMap[debateState.config.judgeModel] || ''}</div>`;
            }
        }

        msgDiv.innerHTML = `
            <div class="msg-header-row">
                <div class="avatar-block">
                    <img src="${avatarMap[data.role]}" class="msg-avatar">
                    ${modelFlag}
                </div>
                <div class="msg-name-block">
                    <span class="role-label">${nameMap[data.role]}</span>
                    <div class="msg-meta-row">
                        ${styleLabel}
                        ${data.round ? `<span class="round-label">${data.round}</span>` : ''}
                    </div>
                </div>
            </div>
            <div class="bubble"><span class="typewriter-target"></span></div>
        `;
    }

    stream.appendChild(msgDiv);

    // Get the target element for typing
    const target = msgDiv.querySelector('.typewriter-target');
    if (!target) return;

    const text = data.text;

    // =====================================================
    // AUDIO-SYNCED MODE: Use boundary events for true sync
    // =====================================================
    if (soundEnabled && window.speechSynthesis) {
        await renderWithAudioSync(target, text, data.role, msgDiv);
    } else {
        // =====================================================
        // WPM MODE: Character-by-character typing (no audio)
        // =====================================================
        await renderWithWPMTiming(target, text, msgDiv);
    }

    // Final scroll
    handleScrollPostRender(true);
}

// Audio-synced rendering: words appear as they are spoken
async function renderWithAudioSync(target, text, role, msgDiv) {
    return new Promise((resolve) => {
        const cleanText = sanitizeForSpeech(text);
        const words = cleanText.split(/\s+/);
        let wordIndex = 0;
        let displayedText = '';

        // Cancel any previous speech
        window.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(cleanText);

        // Configure voice based on role
        const settings = voiceSettings[role] || voiceSettings['judge'];
        utterance.pitch = settings.pitch;
        utterance.rate = settings.rate;

        // Get voice
        let selectedVoiceName = '';
        if (role === 'for') selectedVoiceName = document.getElementById('advocate-voice')?.value;
        else if (role === 'against') selectedVoiceName = document.getElementById('skeptic-voice')?.value;
        else if (role === 'judge') selectedVoiceName = document.getElementById('judge-voice')?.value;

        let voice = selectedVoiceName ? voices.find(v => v.name === selectedVoiceName) : null;
        if (!voice) voice = findVoice(settings.female);
        if (voice) utterance.voice = voice;

        // Track if we got any boundary events (for fallback)
        let boundaryEventFired = false;

        // Real-time sync: reveal words as they're spoken
        utterance.onboundary = (event) => {
            // STRICT PAUSE CHECK: Do not update if paused!
            if (event.name === 'word' && debateState.active && !debateState.paused) {
                boundaryEventFired = true;
                wordIndex++;
                // Build displayed text from original (with formatting)
                const originalWords = text.split(/\s+/);
                displayedText = originalWords.slice(0, wordIndex).join(' ');
                target.innerHTML = markdownToHtml(displayedText);

                // Auto-scroll periodically
                if (wordIndex % 10 === 0) {
                    handleScrollPostRender(true);
                }
            }
        };

        utterance.onend = () => {
            // Ensure full text is shown
            target.innerHTML = markdownToHtml(text);
            resolve();
        };

        // Fallback timeout: if no boundary events after 800ms, 
        // the browser may not support them (Firefox/Headless)
        const fallbackTimer = setTimeout(() => {
            if (!boundaryEventFired && debateState.active) {
                console.log('No boundary events detected, falling back to WPM timing BUT waiting for speech');

                // Don't cancel speech! It's already playing. Just switch visualization mode.
                // We let the original utterance continue playing.

                // Start typing visual text in parallel with the speech
                renderWithWPMTiming(target, text, msgDiv);

                // IMPORTANT: We do NOT resolve here. We wait for utterance.onend to resolve.
                // This ensures the next turn doesn't start until audio finishes.
            }
        }, 800);

        // Abort check - if debate stopped, cancel speech
        const abortCheck = setInterval(() => {
            if (!debateState.active) {
                window.speechSynthesis.cancel();
                clearInterval(abortCheck);
                clearTimeout(fallbackTimer);
                msgDiv.remove();
                resolve();
            }
        }, 100);

        // Clear interval when speech ends
        utterance.onend = () => {
            clearInterval(abortCheck);
            clearTimeout(fallbackTimer);
            target.innerHTML = markdownToHtml(text); // Ensure full text is shown
            console.log("Speech finished, resolving turn.");
            resolve();
        };

        utterance.onerror = (e) => {
            console.warn('Speech synthesis error:', e);
            clearInterval(abortCheck);
            clearTimeout(fallbackTimer);
            target.innerHTML = markdownToHtml(text);
            resolve();
        };

        // Start speech
        window.speechSynthesis.speak(utterance);
    });
}

// WPM-based rendering: character-by-character at configured speed
async function renderWithWPMTiming(target, text, msgDiv) {
    let currentText = '';

    for (let i = 0; i < text.length; i++) {
        // ABORT CHECK - Stop typing if debate was cancelled
        if (!debateState.active) {
            msgDiv.remove();
            return;
        }

        const char = text[i];
        currentText += char;

        // Apply markdown formatting to accumulated text
        target.innerHTML = markdownToHtml(currentText);

        // Auto-scroll every 30 characters
        if (i % 30 === 0) {
            handleScrollPostRender(true);
        }

        // Check for pause\n        await waitIfPaused();
        if (!debateState.active) {
            msgDiv.remove();
            return;
        }

        // Calculate delay based on CURRENT WPM (real-time reading for instant changes)
        const wpm = getCurrentWPM();

        // Instant mode (999 WPM) = no delay
        if (wpm >= 999) continue;

        const charsPerMinute = wpm * 5;
        const msPerChar = (60 * 1000) / charsPerMinute;

        // Skip delay for spaces/newlines (feels more natural)
        if (char !== ' ' && char !== '\n') {
            await new Promise(r => setTimeout(r, msPerChar));
        }
    }
}

function renderLoadingMessage(data) {
    const stream = document.getElementById('discussion-stream');
    removeLoadingMessages(); // remove old ones
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'loading-message';
    loadingDiv.innerHTML = `
        <div class="spinner"></div>
        <span class="loading-text">${data.text}</span>
    `;
    stream.appendChild(loadingDiv);
}

function removeLoadingMessages() {
    const loadingMessages = document.querySelectorAll('.loading-message');
    loadingMessages.forEach(msg => msg.remove());
}

// --- WINNER ANIMATION (KICK-ASS CELEBRATION!) ---
function triggerWinAnimation(winner) {
    const crownAdvocate = document.getElementById('crown-advocate');
    const crownSkeptic = document.getElementById('crown-skeptic');

    // Set winner score and show crown
    if (winner === 'advocate') {
        if (crownAdvocate) crownAdvocate.style.display = 'inline';
        debateState.score = 10;
    } else if (winner === 'skeptic') {
        if (crownSkeptic) crownSkeptic.style.display = 'inline';
        debateState.score = -10;
    }

    // Update score display
    const advScoreEl = document.getElementById('score-advocate');
    const skpScoreEl = document.getElementById('score-skeptic');
    if (advScoreEl) advScoreEl.innerText = debateState.score > 0 ? '+' + debateState.score : '0';
    if (skpScoreEl) skpScoreEl.innerText = debateState.score < 0 ? Math.abs(debateState.score) : '0';

    // ========================================
    // 🎆 CELEBRATION EFFECTS 🎆
    // ========================================

    // 1. CONFETTI EXPLOSION!
    if (window.confetti) {
        const colors = winner === 'advocate' ? ['#22c55e', '#34d399', '#ffffff'] :
            winner === 'skeptic' ? ['#ef4444', '#fb7185', '#ffffff'] :
                ['#eab308', '#fbbf24', '#ffffff'];

        // Multi-burst confetti
        const origin = winner === 'advocate' ? { x: 0.2, y: 0.6 } :
            winner === 'skeptic' ? { x: 0.8, y: 0.6 } : { x: 0.5, y: 0.5 };

        confetti({ particleCount: 100, spread: 70, origin: origin, colors: colors, zIndex: 10001 });
        setTimeout(() => confetti({ particleCount: 80, spread: 100, origin: { x: 0.5, y: 0.3 }, colors: colors, zIndex: 10001 }), 200);
        setTimeout(() => confetti({ particleCount: 60, spread: 120, origin: { x: Math.random(), y: 0.5 }, colors: colors, zIndex: 10001 }), 400);
    }

    // 2. SCREEN FLASH
    const flash = document.createElement('div');
    flash.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: white; opacity: 0.8; z-index: 9999;
        animation: flashFade 0.3s ease-out forwards;
    `;
    document.body.appendChild(flash);
    setTimeout(() => flash.remove(), 300);

    // 3. SCREEN SHAKE
    document.body.style.animation = 'shake 0.4s ease-in-out';
    setTimeout(() => document.body.style.animation = '', 400);

    // 4. SPOTLIGHT BURST
    const spotlightColor = winner === 'advocate' ? 'rgba(52,211,153,0.4)' :
        winner === 'skeptic' ? 'rgba(251,113,133,0.4)' : 'rgba(250,204,21,0.4)';
    const spotlight = document.createElement('div');
    spotlight.style.cssText = `
        position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
        width: 0; height: 0; border-radius: 50%; z-index: 9998;
        background: radial-gradient(circle, ${spotlightColor} 0%, transparent 70%);
        animation: spotlightBurst 1s ease-out forwards;
    `;
    document.body.appendChild(spotlight);
    setTimeout(() => spotlight.remove(), 1000);

    // 5. WINNER BADGE
    const badge = document.createElement('div');
    const winnerText = winner === 'advocate' ? 'FOR WINS!' : winner === 'skeptic' ? 'AGAINST WINS!' : 'DRAW!';
    const winnerColor = winner === 'advocate' ? '#34d399' : winner === 'skeptic' ? '#fb7185' : '#fbbf24';
    badge.innerHTML = `
        <div style="font-size: 3rem; margin-bottom: 10px;">🏆</div>
        <div style="font-size: 2rem; font-weight: 800; letter-spacing: 3px; text-shadow: 0 0 30px ${winnerColor};">${winnerText}</div>
    `;
    badge.style.cssText = `
        position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%) scale(0);
        text-align: center; color: ${winnerColor}; z-index: 10000;
        animation: badgePop 2.5s ease-out forwards;
    `;
    document.body.appendChild(badge);
    setTimeout(() => badge.remove(), 2500);

    // VISUAL CELEBRATION ONLY (no sound)
}

// --- DEBATE HISTORY LOCAL STORAGE ---
function getHistory() {
    try {
        return JSON.parse(localStorage.getItem('debate_history') || '[]');
    } catch {
        return [];
    }
}

function saveDebateToHistory(topic, winner) {
    const history = getHistory();

    // Build transcript with voice metadata for audio playback
    const transcriptWithVoice = debateState.history.map(line => {
        // Parse role from line format "Role: text"
        let role = 'judge';
        let text = line;

        if (line.toLowerCase().startsWith('advocate:')) {
            role = 'advocate';
            text = line.substring(9).trim();
        } else if (line.toLowerCase().startsWith('skeptic:')) {
            role = 'skeptic';
            text = line.substring(8).trim();
        } else if (line.toLowerCase().startsWith('judge:')) {
            role = 'judge';
            text = line.substring(6).trim();
        }

        // Map role to voice settings key
        const roleKey = role === 'advocate' ? 'for' : role === 'skeptic' ? 'against' : 'judge';
        const settings = voiceSettings[roleKey] || voiceSettings['judge'];

        // Get selected voice name for this role
        let voiceName = null;
        if (role === 'advocate') voiceName = document.getElementById('advocate-voice')?.value || null;
        else if (role === 'skeptic') voiceName = document.getElementById('skeptic-voice')?.value || null;
        else if (role === 'judge') voiceName = document.getElementById('judge-voice')?.value || null;

        return {
            role: role,
            text: text,
            fullLine: line,  // Keep original for display
            voiceSettings: {
                voiceName: voiceName,
                pitch: settings.pitch,
                rate: settings.rate,
                female: settings.female
            }
        };
    });

    const newEntry = {
        topic: debateState.topic,
        winner: winner,
        date: new Date().toLocaleDateString() + ' ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        transcript: debateState.history,  // Keep original format for backwards compatibility
        messages: transcriptWithVoice     // New enhanced format with voice data
    };

    // Add to top
    history.unshift(newEntry);

    // Limit to 50
    if (history.length > 50) history.pop();

    localStorage.setItem('debate_history', JSON.stringify(history));
}

// --- CHANGELOG MODAL ---
function showChangelog() {
    const modal = document.getElementById('changelog-modal');
    modal.classList.remove('hidden');
    setTimeout(() => modal.classList.add('visible'), 10);
}

function closeChangelog() {
    const modal = document.getElementById('changelog-modal');
    modal.classList.remove('visible');
    setTimeout(() => modal.classList.add('hidden'), 300);
}

// --- HISTORY AUDIO PLAYBACK ---
let isPlayingHistory = false;
let isPausedHistory = false;
let currentHistoryIndex = null;  // Tracks which history item is being viewed
let currentMessageIndex = 0;     // Tracks current message during playback
let currentHistoryMessages = []; // Cache messages for the current history item
let selectedPlaybackVoice = null; // User-selected voice override

function initPlaybackVoiceSelector() {
    const select = document.getElementById('playback-voice');
    if (!select || !voices.length) return;

    // Build options grouped by language
    const grouped = {};
    voices.forEach(v => {
        const lang = v.lang.split('-')[0];
        if (!grouped[lang]) grouped[lang] = [];
        grouped[lang].push(v);
    });

    select.innerHTML = '<option value="default">Default (per role)</option>';
    Object.keys(grouped).sort().forEach(lang => {
        const optgroup = document.createElement('optgroup');
        optgroup.label = lang.toUpperCase();
        grouped[lang].forEach(v => {
            const opt = document.createElement('option');
            opt.value = v.name;
            opt.textContent = v.name.replace('Microsoft', '').replace('Online', '').trim();
            optgroup.appendChild(opt);
        });
        select.appendChild(optgroup);
    });
}

function setPlaybackVoice() {
    const select = document.getElementById('playback-voice');
    selectedPlaybackVoice = select?.value === 'default' ? null : select?.value;
}

function playHistoryAudio() {
    if (currentHistoryIndex === null) return;

    // Block playback during active debate
    if (debateState.active) {
        updateAudioStatus('Cannot play during active debate');
        return;
    }

    const history = getHistory();
    const item = history[currentHistoryIndex];
    if (!item) return;

    // Use enhanced messages array if available, otherwise parse transcript
    currentHistoryMessages = item.messages || parseTranscriptToMessages(item.transcript);
    if (!currentHistoryMessages || currentHistoryMessages.length === 0) return;

    isPlayingHistory = true;
    isPausedHistory = false;
    currentMessageIndex = 0;

    updateAudioControlsUI('playing');
    updateAudioStatus(`Playing 1 of ${currentHistoryMessages.length}`);

    playMessagesSequentially();
}

function pauseHistoryAudio() {
    if (!isPlayingHistory || isPausedHistory) return;

    window.speechSynthesis.pause();
    isPausedHistory = true;
    updateAudioControlsUI('paused');
    updateAudioStatus(`Paused at ${currentMessageIndex + 1} of ${currentHistoryMessages.length}`);
}

function resumeHistoryAudio() {
    if (!isPlayingHistory || !isPausedHistory) return;

    window.speechSynthesis.resume();
    isPausedHistory = false;
    updateAudioControlsUI('playing');
    updateAudioStatus(`Playing ${currentMessageIndex + 1} of ${currentHistoryMessages.length}`);
}

function stopHistoryAudio() {
    window.speechSynthesis.cancel();
    isPlayingHistory = false;
    isPausedHistory = false;
    currentMessageIndex = 0;

    updateAudioControlsUI('stopped');
    updateAudioStatus('Ready to play');

    // Remove playing highlight from all messages
    document.querySelectorAll('.transcript-msg.playing').forEach(el => {
        el.classList.remove('playing');
    });
}

function updateAudioControlsUI(state) {
    const playBtn = document.getElementById('audio-play-btn');
    const pauseBtn = document.getElementById('audio-pause-btn');
    const resumeBtn = document.getElementById('audio-resume-btn');
    const stopBtn = document.getElementById('audio-stop-btn');

    if (!playBtn) return;

    // Reset all buttons
    playBtn.classList.add('hidden');
    pauseBtn.classList.add('hidden');
    resumeBtn.classList.add('hidden');
    stopBtn.disabled = true;

    switch (state) {
        case 'playing':
            pauseBtn.classList.remove('hidden');
            stopBtn.disabled = false;
            break;
        case 'paused':
            resumeBtn.classList.remove('hidden');
            stopBtn.disabled = false;
            break;
        case 'stopped':
        default:
            playBtn.classList.remove('hidden');
            break;
    }
}

function updateAudioStatus(text) {
    const status = document.getElementById('audio-status');
    if (status) status.textContent = text;
}

function parseTranscriptToMessages(transcript) {
    if (!transcript) return [];
    return transcript.map(line => {
        let role = 'judge';
        let text = line;

        if (line.toLowerCase().startsWith('advocate:')) {
            role = 'advocate';
            text = line.substring(9).trim();
        } else if (line.toLowerCase().startsWith('skeptic:')) {
            role = 'skeptic';
            text = line.substring(8).trim();
        } else if (line.toLowerCase().startsWith('judge:')) {
            role = 'judge';
            text = line.substring(6).trim();
        }

        return { role, text, voiceSettings: null };
    });
}

async function playMessagesSequentially() {
    if (!isPlayingHistory || currentMessageIndex >= currentHistoryMessages.length) {
        stopHistoryAudio();
        updateAudioStatus('Playback complete');
        return;
    }

    const msg = currentHistoryMessages[currentMessageIndex];
    highlightCurrentMessage(currentMessageIndex);
    updateAudioStatus(`Playing ${currentMessageIndex + 1} of ${currentHistoryMessages.length}`);

    await speakMessageWithHighlight(msg);

    // Check if we should continue (not stopped or paused externally)
    if (isPlayingHistory && !isPausedHistory) {
        currentMessageIndex++;
        playMessagesSequentially();
    }
}

function highlightCurrentMessage(index) {
    // Remove previous highlights
    document.querySelectorAll('.transcript-msg.playing').forEach(el => {
        el.classList.remove('playing');
    });

    // Add highlight to current message and scroll into view
    const container = document.getElementById('transcript-container');
    if (container) {
        const messages = container.querySelectorAll('.transcript-msg');
        if (messages[index]) {
            messages[index].classList.add('playing');
            messages[index].scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }
}

function speakMessageWithHighlight(msg) {
    return new Promise(resolve => {
        const cleanText = sanitizeForSpeech(msg.text);
        const utterance = new SpeechSynthesisUtterance(cleanText);

        // Use user-selected voice if set, otherwise use saved/default
        if (selectedPlaybackVoice) {
            const userVoice = voices.find(v => v.name === selectedPlaybackVoice);
            if (userVoice) utterance.voice = userVoice;
        } else {
            // Use saved voice settings if available, otherwise use defaults
            const voiceSettings = msg.voiceSettings;
            const roleKey = msg.role === 'advocate' ? 'for' : msg.role === 'skeptic' ? 'against' : 'judge';
            const defaults = window.voiceSettings?.[roleKey] || { pitch: 1.0, rate: 1.0, female: false };

            if (voiceSettings) {
                utterance.pitch = voiceSettings.pitch || defaults.pitch;
                utterance.rate = voiceSettings.rate || defaults.rate;

                if (voiceSettings.voiceName) {
                    const savedVoice = voices.find(v => v.name === voiceSettings.voiceName);
                    if (savedVoice) utterance.voice = savedVoice;
                } else {
                    const fallbackVoice = findVoice(voiceSettings.female ?? defaults.female);
                    if (fallbackVoice) utterance.voice = fallbackVoice;
                }
            } else {
                utterance.pitch = defaults.pitch;
                utterance.rate = defaults.rate;
                const fallbackVoice = findVoice(defaults.female);
                if (fallbackVoice) utterance.voice = fallbackVoice;
            }
        }

        utterance.onend = () => {
            if (!isPlayingHistory) return resolve();
            // Small pause between messages
            setTimeout(resolve, 300);
        };

        utterance.onerror = () => resolve();

        window.speechSynthesis.speak(utterance);
    });
}

function showHistory() {
    const modal = document.getElementById('history-modal');
    const listView = document.getElementById('history-list-view');
    const detailView = document.getElementById('history-detail-view');
    const list = document.getElementById('history-list');
    const emptyState = document.getElementById('history-empty');

    // Show list view, hide detail view
    listView.classList.remove('hidden');
    detailView.classList.add('hidden');

    const history = getHistory();
    list.innerHTML = '';

    if (history.length === 0) {
        emptyState.classList.remove('hidden');
        list.classList.add('hidden');
    } else {
        emptyState.classList.add('hidden');
        list.classList.remove('hidden');

        history.forEach((item, index) => {
            const entry = document.createElement('div');
            entry.className = 'history-item';
            entry.onclick = () => viewTranscript(index);

            // Winner class
            let winnerClass = 'win-draw';
            let winnerLabel = item.winner?.toUpperCase() || 'UNKNOWN';
            if (item.winner === 'advocate') winnerClass = 'win-advocate';
            else if (item.winner === 'skeptic') winnerClass = 'win-skeptic';

            // Count messages
            const msgCount = item.transcript?.length || 0;

            entry.innerHTML = `
                <div class="history-topic">${item.topic || 'Untitled Debate'}</div>
                <div class="history-meta">
                    <span class="winner-tag ${winnerClass}">${winnerLabel} WINS</span>
                    <span class="history-date">${item.date || ''}</span>
                </div>
                <div class="history-stats">
                    <span>💬 ${msgCount} messages</span>
                </div>
            `;
            list.appendChild(entry);
        });
    }

    modal.classList.remove('hidden');
    void modal.offsetWidth;
    modal.classList.add('visible');
}

function viewTranscript(index) {
    const history = getHistory();
    const item = history[index];
    if (!item) return;

    // Track current history item for audio playback
    currentHistoryIndex = index;
    stopHistoryAudio();  // Stop any playing audio and reset controls
    initPlaybackVoiceSelector(); // Populate voice dropdown

    const listView = document.getElementById('history-list-view');
    const detailView = document.getElementById('history-detail-view');
    const topicEl = document.getElementById('detail-topic');
    const metaEl = document.getElementById('detail-meta');
    const container = document.getElementById('transcript-container');

    // Switch views
    listView.classList.add('hidden');
    detailView.classList.remove('hidden');

    // Set header
    topicEl.textContent = item.topic || 'Untitled Debate';

    let winnerText = item.winner === 'advocate' ? '🟢 Advocate Wins' :
        item.winner === 'skeptic' ? '🔴 Skeptic Wins' : '⚖️ Draw';
    metaEl.textContent = `${winnerText} • ${item.date || ''}`;

    // Add View Flow Button
    const flowBtn = document.createElement('button');
    flowBtn.className = 'history-flow-btn';
    flowBtn.innerHTML = '📋 View Flow';
    flowBtn.onclick = (e) => {
        e.stopPropagation();
        // Extract transcript in format compatible with parseHistoryToFlow
        // item.transcript is already ["Role: text", ...]
        showFlowSheet(item.transcript);
    };

    // Check if button already exists to prevent duplicates
    const existingBtn = document.querySelector('.history-flow-btn');
    if (existingBtn) existingBtn.remove();



    // Render transcript with rich styling
    container.innerHTML = '';

    if (!item.transcript || item.transcript.length === 0) {
        container.innerHTML = '<div style="text-align: center; color: var(--text-secondary); padding: 40px;">No transcript available for this debate.</div>';
        return;
    }

    const avatarMap = {
        'advocate': '/static/advocate_avatar.png',
        'skeptic': '/static/skeptic_avatar.png',
        'judge': '/static/judge_avatar.png'
    };

    const roleMap = {
        'advocate': { class: 'msg-for', label: 'Advocate (FOR)' },
        'skeptic': { class: 'msg-against', label: 'Skeptic (AGAINST)' },
        'judge': { class: 'msg-judge', label: 'Judge' }
    };

    item.transcript.forEach(line => {
        // Parse the line to detect role
        // Format: "Advocate: text" or "Skeptic: text" or "Judge: text"
        let role = 'judge';
        let text = line;

        if (line.toLowerCase().startsWith('advocate:')) {
            role = 'advocate';
            text = line.substring(9).trim();
        } else if (line.toLowerCase().startsWith('skeptic:')) {
            role = 'skeptic';
            text = line.substring(8).trim();
        } else if (line.toLowerCase().startsWith('judge:')) {
            role = 'judge';
            text = line.substring(6).trim();
        }

        const roleInfo = roleMap[role];
        const msgDiv = document.createElement('div');
        msgDiv.className = `transcript-msg ${roleInfo.class}`;

        msgDiv.innerHTML = `
            <img src="${avatarMap[role]}" class="transcript-avatar" alt="${role}">
            <div class="transcript-bubble">
                <div class="transcript-role">${roleInfo.label}</div>
                <div class="transcript-text">${markdownToHtml(text)}</div>
            </div>
        `;
        container.appendChild(msgDiv);
    });

    // Scroll to top
    container.scrollTop = 0;
}

function backToHistoryList() {
    stopHistoryAudio();  // Stop any playing audio

    const listView = document.getElementById('history-list-view');
    const detailView = document.getElementById('history-detail-view');

    listView.classList.remove('hidden');
    detailView.classList.add('hidden');
}

function closeHistory() {
    stopHistoryAudio();  // Stop any playing audio

    const modal = document.getElementById('history-modal');
    modal.classList.remove('visible');
    setTimeout(() => {
        modal.classList.add('hidden');
    }, 300);
}

function clearHistory() {
    if (confirm("Are you sure you want to clear all debate history?")) {
        localStorage.removeItem('debate_history');
        showHistory(); // Refresh view to show empty state
    }
}

function showSettings() {
    const modal = document.getElementById('settings-modal');
    const topicDisplay = document.getElementById('settings-topic');
    const topicInput = document.getElementById('topic-input');
    const isDebating = debateState.active || debateState.isDebating;

    // Show topic if there's one pending
    if (topicInput.value) {
        topicDisplay.textContent = `📋 Topic: "${topicInput.value}"`;
        topicDisplay.classList.remove('hidden');
    } else {
        topicDisplay.classList.add('hidden');
    }

    // During debate: disable all inputs and hide action buttons
    const settingsInputs = modal.querySelectorAll('select, input, .voice-preview-btn');
    const settingsButtons = modal.querySelector('.settings-buttons');
    const audioToggle = modal.querySelector('.audio-toggle-section');

    // Get or create the info notice element
    let infoNotice = modal.querySelector('.settings-info-notice');
    if (!infoNotice) {
        infoNotice = document.createElement('div');
        infoNotice.className = 'settings-info-notice';
        // Insert after header
        const header = modal.querySelector('.modal-header');
        header.insertAdjacentElement('afterend', infoNotice);
    }

    if (isDebating) {
        // Disable all selects and inputs
        settingsInputs.forEach(el => el.disabled = true);
        // Hide action buttons
        if (settingsButtons) settingsButtons.classList.add('hidden');
        // Hide audio toggle
        if (audioToggle) audioToggle.classList.add('hidden');
        // Update header to indicate view-only
        modal.querySelector('.modal-header h2').textContent = '👁️ Current Settings';
        // Show explanatory notice
        infoNotice.innerHTML = `
            <span class="notice-icon">🔒</span>
            <span class="notice-text">Settings are locked during an active debate. <strong>Stop the debate</strong> to make changes.</span>
        `;
        infoNotice.classList.remove('hidden');
    } else {
        // Re-enable all
        settingsInputs.forEach(el => el.disabled = false);
        if (settingsButtons) settingsButtons.classList.remove('hidden');
        if (audioToggle) audioToggle.classList.remove('hidden');
        modal.querySelector('.modal-header h2').textContent = '⚙️ Debate Settings';
        // Hide notice
        infoNotice.classList.add('hidden');
    }

    modal.classList.remove('hidden');
    setTimeout(() => modal.classList.add('visible'), 10);
}

function closeSettings() {
    const modal = document.getElementById('settings-modal');
    modal.classList.remove('visible');
    setTimeout(() => modal.classList.add('hidden'), 300);
}

// Close modal when clicking outside
window.onclick = function (event) {
    const historyModal = document.getElementById('history-modal');
    const settingsModal = document.getElementById('settings-modal');
    const practiceModal = document.getElementById('practice-modal');
    const changelogModal = document.getElementById('changelog-modal');
    if (event.target === historyModal) {
        closeHistory();
    }
    if (event.target === settingsModal) {
        closeSettings();
    }
    if (event.target === practiceModal) {
        closePracticeModal();
    }
    if (event.target === changelogModal) {
        closeChangelog();
    }
}

function updateScoreBar(delta, reason) {
    // Score: -10 (full Skeptic) to +10 (full Advocate). 0 = tie.
    debateState.score = Math.max(-10, Math.min(10, debateState.score + delta));
    const score = debateState.score;

    const fillLeft = document.getElementById('score-fill-left');
    const fillRight = document.getElementById('score-fill-right');
    const advScore = document.getElementById('score-advocate');
    const skpScore = document.getElementById('score-skeptic');
    const deltaEl = document.getElementById('score-delta');

    // Left fill = skeptic wins (negative score), Right fill = advocate wins (positive score)
    if (fillLeft && fillRight) {
        if (score < 0) {
            fillLeft.style.width = Math.abs(score) * 5 + '%'; // Max 50% at -10
            fillRight.style.width = '0%';
        } else {
            fillRight.style.width = score * 5 + '%'; // Max 50% at +10
            fillLeft.style.width = '0%';
        }
    }

    // Update Numbers (absolute values for display)
    if (advScore) advScore.innerText = score > 0 ? '+' + score : '0';
    if (skpScore) skpScore.innerText = score < 0 ? Math.abs(score) : '0';

    // Flash Delta with reason
    if (delta !== 0 && reason && deltaEl) {
        let winner = delta > 0 ? 'FOR' : 'AGAINST';
        let points = Math.abs(delta);
        deltaEl.innerText = `${winner} +${points}: ${reason.substring(0, 60)}${reason.length > 60 ? '...' : ''}`;
        deltaEl.classList.remove('flash');
        void deltaEl.offsetWidth;
        deltaEl.classList.add('flash');
    }
}

function updateRoundDisplay(round) {
    const roundEl = document.getElementById('round-display');
    if (roundEl) {
        roundEl.textContent = `Round ${round}`;
    }
}

// Arena celebration sound effects
function playVictoryHorn() {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(220, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.1);
    osc.frequency.setValueAtTime(440, ctx.currentTime + 0.1);
    osc.frequency.exponentialRampToValueAtTime(550, ctx.currentTime + 0.3);

    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.8);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.8);
}

function playCrowdRoar() {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const bufferSize = ctx.sampleRate * 2; // 2 seconds
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);

    // Generate crowd noise (filtered white noise with modulation)
    for (let i = 0; i < bufferSize; i++) {
        const t = i / ctx.sampleRate;
        const envelope = Math.sin(Math.PI * t / 2) * Math.exp(-t * 0.5);
        data[i] = (Math.random() * 2 - 1) * envelope * 0.15;
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 800;

    source.connect(filter);
    filter.connect(ctx.destination);
    source.start();
}

// Pending topic - set when user uses fire button
let pendingDebateTopic = null;

async function triggerChaos() {
    const btn = document.querySelector('.chaos-btnGlass');
    if (!btn) return;
    btn.innerText = "🎲";

    try {
        const res = await fetch('/api/chaos_topic');
        const data = await res.json();
        document.getElementById('topic-input').value = data.topic;
        btn.innerText = "🔥";

        // Store pending topic and show settings
        pendingDebateTopic = data.topic;
        showSettings();
    } catch (e) {
        console.error("Chaos failed:", e);
        btn.innerText = "❌";
        setTimeout(() => btn.innerText = "🔥", 2000);
    }
}

// Modified to start debate after settings confirmed
function confirmAndStartDebate() {
    closeSettings();
    pendingDebateTopic = null;
    startDebate();
}

// ============================================
// CASE UPLOAD FUNCTIONS
// ============================================

function toggleCaseSection() {
    const body = document.getElementById('case-upload-body');
    const icon = document.getElementById('case-toggle-icon');
    if (body.classList.contains('hidden')) {
        body.classList.remove('hidden');
        icon.classList.add('open');
    } else {
        body.classList.add('hidden');
        icon.classList.remove('open');
    }
}

function clearCaseText() {
    const textarea = document.getElementById('case-text');
    textarea.value = '';
    document.getElementById('case-char-count').textContent = '0 chars';
}

// Character count listener
document.addEventListener('DOMContentLoaded', () => {
    const caseTextarea = document.getElementById('case-text');
    if (caseTextarea) {
        caseTextarea.addEventListener('input', () => {
            const len = caseTextarea.value.length;
            document.getElementById('case-char-count').textContent =
                len > 1000 ? `${(len / 1000).toFixed(1)}k chars` : `${len} chars`;
        });
    }
});

// ============================================
// FLOW SHEET FUNCTIONS
// ============================================

function showFlowSheet() {
    const modal = document.getElementById('flow-modal');
    const container = document.getElementById('flow-sheet-container');

    // Parse history into rows
    const rows = parseHistoryToFlow();

    if (rows.length === 0) {
        container.innerHTML = '<p class="flow-empty">Start a debate to see the flow sheet.</p>';
    } else {
        container.innerHTML = renderFlowTable(rows);
    }

    modal.classList.remove('hidden');
    setTimeout(() => modal.classList.add('visible'), 10);
}

function closeFlowSheet() {
    const modal = document.getElementById('flow-modal');
    modal.classList.remove('visible');
    setTimeout(() => {
        modal.classList.add('hidden');
    }, 300);
}

function parseHistoryToFlow() {
    const history = debateState.history || [];
    if (history.length === 0) return [];

    const rows = [];
    let currentRow = { round: 'Opening', for: '', against: '', judge: '' };
    let roundNum = 0;

    for (const entry of history) {
        const colonIdx = entry.indexOf(':');
        if (colonIdx === -1) continue;

        const role = entry.substring(0, colonIdx).trim().toLowerCase();
        const text = entry.substring(colonIdx + 1).trim();

        // Clean score delta from judge text
        const cleanText = text.replace(/\|\| SCORE_DELTA:\s*-?\d+/g, '').trim();

        if (role === 'advocate') {
            if (currentRow.for && currentRow.against) {
                // Previous row is full, start new one
                rows.push(currentRow);
                roundNum++;
                currentRow = { round: `Round ${roundNum}`, for: '', against: '', judge: '' };
            }
            currentRow.for = cleanText;
        } else if (role === 'skeptic') {
            currentRow.against = cleanText;
        } else if (role === 'judge') {
            currentRow.judge = cleanText;
            rows.push(currentRow);
            roundNum++;
            currentRow = { round: `Round ${roundNum}`, for: '', against: '', judge: '' };
        }
    }

    // Push last row if it has content
    if (currentRow.for || currentRow.against || currentRow.judge) {
        rows.push(currentRow);
    }

    return rows;
}

function renderFlowTable(rows) {
    let html = `<table class="flow-table">
        <thead><tr>
            <th>Round</th>
            <th class="col-for">🟢 FOR</th>
            <th class="col-against">🔴 AGAINST</th>
            <th class="col-judge">⚖️ Judge</th>
        </tr></thead><tbody>`;

    for (const row of rows) {
        html += `<tr>
            <td class="round-cell">${row.round}</td>
            <td>${truncate(row.for, 200)}</td>
            <td>${truncate(row.against, 200)}</td>
            <td>${truncate(row.judge, 150)}</td>
        </tr>`;
    }

    html += '</tbody></table>';
    return html;
}

function truncate(text, maxLen) {
    if (!text) return '—';
    if (text.length <= maxLen) return escapeHtml(text);
    return escapeHtml(text.substring(0, maxLen)) + '…';
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function copyFlowSheet() {
    const rows = parseHistoryToFlow();
    if (rows.length === 0) return;

    let tsv = 'Round\tFOR\tAGAINST\tJudge\n';
    for (const row of rows) {
        tsv += `${row.round}\t${row.for || ''}\t${row.against || ''}\t${row.judge || ''}\n`;
    }

    navigator.clipboard.writeText(tsv).then(() => {
        const btn = document.getElementById('flow-copy-btn');
        btn.textContent = '✅ Copied!';
        setTimeout(() => btn.textContent = '📋 Copy to Clipboard', 2000);
    });
}

function downloadFlowSheet() {
    const rows = parseHistoryToFlow();
    if (rows.length === 0) return;

    let csv = '"Round","FOR","AGAINST","Judge"\n';
    for (const row of rows) {
        csv += `"${row.round}","${(row.for || '').replace(/"/g, '""')}","${(row.against || '').replace(/"/g, '""')}","${(row.judge || '').replace(/"/g, '""')}"\n`;
    }

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `flow_sheet_${debateState.topic || 'debate'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
}

// Update tagline when model dropdowns change
function updateTaglineFromDropdowns() {
    const advocateModel = document.getElementById('advocate-model').value;
    const skepticModel = document.getElementById('skeptic-model').value;
    const tagline = document.getElementById('tagline');

    const hasHuman = advocateModel === 'human' || skepticModel === 'human';
    const allHuman = advocateModel === 'human' && skepticModel === 'human';
    const allAI = advocateModel !== 'human' && skepticModel !== 'human';

    if (allHuman) tagline.innerText = 'Human vs Human';
    else if (allAI) tagline.innerText = 'Pick a topic. Watch AI Agents Debate. See Who Wins.';
    else tagline.innerText = 'Human vs AI';
}

// Attach listeners on page load
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('advocate-model').addEventListener('change', updateTaglineFromDropdowns);
    document.getElementById('skeptic-model').addEventListener('change', updateTaglineFromDropdowns);
    setupSmartScroll(); // Initialize scroll indicator
});

// ============================================
// Practice Modal Functions
// ============================================

let practiceState = {
    caseText: '',
    mode: 'defend', // defend | attack | watch
    filename: ''
};

function showPracticeModal() {
    const modal = document.getElementById('practice-modal');
    modal.classList.remove('hidden');
    setTimeout(() => modal.classList.add('visible'), 10);
}

function closePracticeModal() {
    const modal = document.getElementById('practice-modal');
    modal.classList.remove('visible');
    setTimeout(() => modal.classList.add('hidden'), 300);
}

function selectPracticeMode(mode) {
    practiceState.mode = mode;
    document.querySelectorAll('.practice-mode-card').forEach(card => {
        const input = card.querySelector('input');
        if (input.value === mode) {
            card.classList.add('selected');
            input.checked = true;
        } else {
            card.classList.remove('selected');
            input.checked = false;
        }
    });
}

// File upload handling
async function handleCaseFile(input) {
    const file = input.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    const dropzone = document.getElementById('case-dropzone');
    const content = document.getElementById('dropzone-content');
    const loaded = document.getElementById('dropzone-loaded');

    // Show loading state
    content.innerHTML = '<span class="dropzone-icon">⏳</span><span class="dropzone-text">Extracting text...</span>';

    try {
        const res = await fetch('/api/upload_case', {
            method: 'POST',
            body: formData
        });
        const data = await res.json();

        if (data.error) {
            content.innerHTML = `<span class="dropzone-icon">❌</span><span class="dropzone-text">${data.error}</span>`;
            setTimeout(() => resetDropzone(), 3000);
            return;
        }

        // Success - show loaded state
        practiceState.caseText = data.text;
        practiceState.filename = data.filename;
        content.classList.add('hidden');
        loaded.classList.remove('hidden');
        document.getElementById('loaded-filename').textContent = data.filename;
        document.getElementById('loaded-wordcount').textContent = `(${data.word_count.toLocaleString()} words${data.truncated ? ' — truncated' : ''})`;

        // Also populate textarea as preview
        const textarea = document.getElementById('practice-case-text');
        textarea.value = data.text;
        updatePracticeWordCount();

    } catch (err) {
        content.innerHTML = `<span class="dropzone-icon">❌</span><span class="dropzone-text">Upload failed: ${err.message}</span>`;
        setTimeout(() => resetDropzone(), 3000);
    }
}

function resetDropzone() {
    const content = document.getElementById('dropzone-content');
    const loaded = document.getElementById('dropzone-loaded');
    content.innerHTML = '<span class="dropzone-icon">📁</span><span class="dropzone-text">Drop PDF, DOCX, or TXT here — or click to browse</span>';
    content.classList.remove('hidden');
    loaded.classList.add('hidden');
}

// Drag & drop
document.addEventListener('DOMContentLoaded', () => {
    const dropzone = document.getElementById('case-dropzone');
    if (!dropzone) return;

    dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.classList.add('drag-over');
    });
    dropzone.addEventListener('dragleave', () => {
        dropzone.classList.remove('drag-over');
    });
    dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.classList.remove('drag-over');
        const file = e.dataTransfer.files[0];
        if (file) {
            const input = document.getElementById('case-file-input');
            const dt = new DataTransfer();
            dt.items.add(file);
            input.files = dt.files;
            handleCaseFile(input);
        }
    });

    // Paste textarea word count
    const textarea = document.getElementById('practice-case-text');
    if (textarea) {
        textarea.addEventListener('input', () => {
            practiceState.caseText = textarea.value.trim();
            practiceState.filename = '';
            updatePracticeWordCount();
        });
    }
});

function updatePracticeWordCount() {
    const textarea = document.getElementById('practice-case-text');
    const count = textarea.value.trim() ? textarea.value.trim().split(/\s+/).length : 0;
    document.getElementById('practice-word-count').textContent = `${count.toLocaleString()} words`;
}

function clearPracticeCase() {
    practiceState.caseText = '';
    practiceState.filename = '';
    document.getElementById('practice-case-text').value = '';
    document.getElementById('practice-word-count').textContent = '0 words';
    resetDropzone();
    document.getElementById('case-file-input').value = '';
}

// Start Practice - configures the debate with case-specific settings
function startPractice() {
    const caseText = document.getElementById('practice-case-text').value.trim();
    if (!caseText) {
        alert('Please upload or paste a debate case first.');
        return;
    }

    const mode = practiceState.mode;
    const opponentModel = document.getElementById('practice-opponent-model').value;

    // Extract topic from case text (first sentence or line)
    let topic = caseText.split(/[.\n]/)[0].trim();
    if (topic.length > 150) topic = topic.substring(0, 147) + '...';
    if (topic.length < 10) topic = 'Debate Case Practice';

    // Configure settings based on practice mode
    const advocateModel = document.getElementById('advocate-model');
    const skepticModel = document.getElementById('skeptic-model');
    const advocateTone = document.getElementById('advocate-tone');
    const skepticTone = document.getElementById('skeptic-tone');

    // Auto-set Pro style for both sides
    advocateTone.value = 'pro';
    skepticTone.value = 'pro';

    // In PRACTICE mode:
    // - case_owner = 'advocate' (the FOR side always owns the uploaded case)
    // - Defend: human is FOR (advocate), AI is AGAINST (skeptic)
    // - Attack: human is AGAINST (skeptic), AI is FOR (advocate)
    // - Watch: AI vs AI
    if (mode === 'defend') {
        advocateModel.value = 'human';
        skepticModel.value = opponentModel;
    } else if (mode === 'attack') {
        advocateModel.value = opponentModel;
        skepticModel.value = 'human';
    } else { // watch
        advocateModel.value = opponentModel;
        skepticModel.value = opponentModel; // Use same model for both sides
    }

    // Set the topic
    document.getElementById('topic-input').value = topic;

    // Close the practice modal
    closePracticeModal();

    // Override startDebate's config to include case info
    // We store practice state so the config picks it up
    const caseTextEl = document.getElementById('case-text');
    if (caseTextEl) caseTextEl.value = caseText;

    // Inject case_owner into debateState config manually after startDebate creates it
    const originalStartDebate = window._originalStartDebate || startDebate;

    // Temporarily monkey-patch startDebate to add case info
    const realStartDebate = startDebate;

    // Just start it — we'll intercept config creation
    // Instead of monkey-patching, we'll store practice config globally
    window._practiceConfig = {
        caseText: caseText,
        caseOwner: 'advocate'  // FOR side always owns the case
    };

    // Trigger the debate
    handleDebateButton();
}
