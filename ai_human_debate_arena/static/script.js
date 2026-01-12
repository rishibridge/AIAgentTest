// Speech synthesis state
let soundEnabled = false;
let speechQueue = [];
let isSpeaking = false;
let voices = [];

// Pacing State
let nextMessageTime = 0; // Timestamp when the next message is allowed to show

// Preset speed levels: 50-100-150-175-200-225-250-300-400-500-600-700-Instant
const SPEED_LEVELS = [50, 100, 150, 175, 200, 225, 250, 300, 400, 500, 600, 700, 999];
let currentSpeedIndex = 6; // Start at 250 WPM

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
    soundEnabled = !soundEnabled;
    const btn = document.getElementById('sound-toggle');
    btn.textContent = soundEnabled ? '🔊' : '🔇';
    btn.classList.toggle('active', soundEnabled);

    if (!soundEnabled) {
        window.speechSynthesis.cancel();
        speechQueue = [];
        isSpeaking = false;
    }
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
    resolveHumanInput: null, // Function to resolve the Promise when human submits
    resolveJudgeInput: null  // Function to resolve the Promise when human judge submits
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
    const debateBtn = document.querySelector('.controls button[onclick="startDebate()"]');
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
    const fireBtn = document.querySelector('.fire-btn');
    if (fireBtn) fireBtn.disabled = !enabled;
}

async function startDebate() {
    console.log("Starting debate..."); // Debug Log
    const topicInput = document.getElementById('topic-input');
    const topic = topicInput.value || "Is Buddhism a religion?";

    // Config
    const config = {
        advocateTone: document.getElementById('advocate-tone').value,
        skepticTone: document.getElementById('skeptic-tone').value,
        advocateModel: document.getElementById('advocate-model').value,
        skepticModel: document.getElementById('skeptic-model').value,
        judgeModel: document.getElementById('judge-model').value
    };

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
        resolveHumanInput: null,
        isDebating: true,
        score: 0 // Range: -10 (Skeptic) to +10 (Advocate)
    };

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
    document.getElementById('score-container').style.display = 'block';
    document.getElementById('crown-advocate').style.display = 'none';
    document.getElementById('crown-skeptic').style.display = 'none';
    updateScoreBar(0, "Debate Start");

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
            debateState.isDebating = false;
            // Score bar stays visible until next debate
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

        // Skeptic Opening
        await executeTurn('skeptic', true, false, false);
        await new Promise(r => setTimeout(r, 1500));

        removeLoadingMessages();

        // MAIN LOOP
        let debateEnded = false;
        debateState.round = 1;

        while (!debateEnded && debateState.round <= maxRounds) {
            // Advocate Turn - typewriter effect handles pacing
            await executeTurn('advocate', false, false, false);
            await new Promise(r => setTimeout(r, 500)); // Small buffer between turns

            // Skeptic Turn - typewriter effect handles pacing
            await executeTurn('skeptic', false, false, false);
            await new Promise(r => setTimeout(r, 500)); // Small buffer between turns

            // Judge Evaluation - Human judges from round 1, AI from round 2
            const shouldJudge = config.judgeModel === 'human' || debateState.round >= 2;

            if (shouldJudge) {
                let debateEnded = false;
                let winner = null;

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

                    // Check for Termination
                    const text = judgeRes.toUpperCase();
                    if (text.includes("ADVOCATE WINS")) {
                        winner = 'advocate';
                        debateEnded = true;
                    } else if (text.includes("SKEPTIC WINS")) {
                        winner = 'skeptic';
                        debateEnded = true;
                    } else if (text.includes("DEADLOCK") || text.includes("VERDICT")) {
                        winner = 'draw';
                        debateEnded = true;
                    }
                }

                if (debateEnded) {
                    // Winner Celebration
                    if (winner) triggerWinAnimation(winner);
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
        }

        // FINAL VERDICT (If loop maxed out or forced ending)
        if (!debateEnded) {
            if (config.judgeModel === 'human') {
                // HUMAN FINAL VERDICT - show binary choice
                const verdictResult = await handleHumanJudge(true);
                winner = verdictResult.winner;
            } else {
                await executeTurn('judge', false, true, false); // is_final=true
                winner = 'draw'; // Default fallback
            }
        }

        // WINNER CELEBRATION
        if (winner) {
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

    try {
        const payload = {
            role: role,
            topic: topic,
            history: history,
            context_data: contextData,
            model_provider: model,
            tone: tone,
            is_opening: isOpening,
            is_final: isFinal,
            is_evaluation: isEvaluation
        };

        const res = await fetch('/api/turn', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

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

        speakText(text, roleMap[role]);
        // Scroll is handled by typewriter function

        return text;

    } catch (e) {
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
        innerHTML = `
            <div class="msg-header-row">
                <img src="${avatarMap[data.role]}" class="msg-avatar">
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
        msgDiv.innerHTML = `
            <div class="msg-header-row">
                <img src="${avatarMap[data.role]}" class="msg-avatar">
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

    // CHARACTER-BY-CHARACTER TYPING with real-time WPM
    const text = data.text;
    let currentText = '';

    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        currentText += char;

        // Apply markdown formatting to accumulated text
        target.innerHTML = markdownToHtml(currentText);

        // Auto-scroll every 30 characters
        if (i % 30 === 0) {
            handleScrollPostRender(true);
        }

        // Calculate delay based on CURRENT WPM (real-time reading for instant changes)
        // Average word = 5 chars, so chars per minute = WPM * 5
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

    // Final scroll
    handleScrollPostRender(true);
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

// --- WINNER ANIMATION (CONFETTI) ---
function triggerWinAnimation(winner) {
    if (!window.confetti) return;

    let origin = { x: 0.5, y: 0.5 };
    let colors = ['#ffffff', '#ff0000'];

    if (winner === 'advocate') {
        origin = { x: 0.0, y: 0.5 }; // Shoot from Left
        colors = ['#22c55e', '#ffffff']; // Green & White
    } else if (winner === 'skeptic') {
        origin = { x: 1.0, y: 0.5 }; // Shoot from Right
        colors = ['#ef4444', '#ffffff']; // Red & White
    } else {
        colors = ['#eab308', '#ffffff']; // Gold (Draw)
    }

    // Fire!
    confetti({
        particleCount: 150,
        spread: 100,
        origin: origin,
        colors: colors,
        zIndex: 3000
    });
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
    const newEntry = {
        topic: debateState.topic, // Fix: Use global state topic
        winner: winner,
        date: new Date().toLocaleDateString() + ' ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        transcript: debateState.history
    };

    // Add to top
    history.unshift(newEntry);

    // Limit to 50
    if (history.length > 50) history.pop();

    localStorage.setItem('debate_history', JSON.stringify(history));
}

function showHistory() {
    const modal = document.getElementById('history-modal');
    const list = document.getElementById('history-list');

    const history = getHistory();
    list.innerHTML = '';

    if (history.length === 0) {
        list.innerHTML = '<div class="history-empty">No debates recorded yet.</div>';
        return;
    }

    history.forEach((item, index) => {
        const entry = document.createElement('div');
        entry.className = 'history-item';

        // Highlight winner color
        let winnerClass = '';
        if (item.winner === 'advocate') winnerClass = 'win-advocate';
        else if (item.winner === 'skeptic') winnerClass = 'win-skeptic';

        // Check if transcript exists (backward compatibility)
        const hasTranscript = item.transcript && item.transcript.length > 0;

        entry.innerHTML = `
            <div class="history-info">
                <div class="history-topic">${item.topic}</div>
                <div class="history-meta">
                    <span class="winner-tag ${winnerClass}">${item.winner.toUpperCase()}</span> 
                    <span class="history-date">${item.date}</span>
                </div>
            </div>
            ${hasTranscript ? `<button class="view-transcript-btn" onclick="viewTranscript(${index})">View Talk</button>` : ''}
        `;
        list.appendChild(entry);
    });

    modal.classList.remove('hidden');
    // Force reflow
    void modal.offsetWidth;
    modal.classList.add('visible');
}

function viewTranscript(index) {
    const history = getHistory();
    const item = history[index];
    if (!item || !item.transcript) return;

    const list = document.getElementById('history-list');

    // Create Transcript View
    const transcriptHTML = `
        <div class="transcript-view">
            <div class="transcript-header">
                <h3>${item.topic}</h3>
                <button onclick="showHistory()" class="back-btn">Back</button>
            </div>
            <div class="transcript-content">
                ${item.transcript.map(line => {
        // Simple formatting
        return `<div class="t-line">${line}</div>`;
    }).join('')}
            </div>
        </div>
     `;

    list.innerHTML = transcriptHTML;
}



function closeHistory() {
    const modal = document.getElementById('history-modal');
    modal.classList.remove('visible');
    setTimeout(() => {
        modal.classList.add('hidden');
    }, 300);
}

function clearHistory() {
    if (confirm("Are you sure you want to clear your debate history?")) {
        localStorage.removeItem('debate_history');
        showHistory(); // refresh view
    }
}

// Close modal when clicking outside
window.onclick = function (event) {
    const modal = document.getElementById('history-modal');
    if (event.target === modal) {
        closeHistory();
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
        let winner = delta > 0 ? 'Advocate' : 'Skeptic';
        let points = Math.abs(delta);
        deltaEl.innerText = `${winner} +${points}: ${reason.substring(0, 60)}${reason.length > 60 ? '...' : ''}`;
        deltaEl.classList.remove('flash');
        void deltaEl.offsetWidth;
        deltaEl.classList.add('flash');
    }
}

function triggerWinAnimation(winner) {
    const fillLeft = document.getElementById('score-fill-left');
    const fillRight = document.getElementById('score-fill-right');
    const crownAdvocate = document.getElementById('crown-advocate');
    const crownSkeptic = document.getElementById('crown-skeptic');

    // Fill bar to 100% for winner (if bar exists)
    if (winner === 'advocate') {
        if (fillRight) fillRight.style.width = '50%';
        if (fillLeft) fillLeft.style.width = '0%';
        if (crownAdvocate) crownAdvocate.style.display = 'inline';
        debateState.score = 10;
    } else if (winner === 'skeptic') {
        if (fillLeft) fillLeft.style.width = '50%';
        if (fillRight) fillRight.style.width = '0%';
        if (crownSkeptic) crownSkeptic.style.display = 'inline';
        debateState.score = -10;
    }

    // Update score display
    const advScoreEl = document.getElementById('score-advocate');
    const skpScoreEl = document.getElementById('score-skeptic');
    if (advScoreEl) advScoreEl.innerText = debateState.score > 0 ? '+' + debateState.score : '0';
    if (skpScoreEl) skpScoreEl.innerText = debateState.score < 0 ? Math.abs(debateState.score) : '0';

    // Confetti (if library loaded)
    if (typeof confetti !== 'undefined') {
        confetti({
            particleCount: 150,
            spread: 70,
            origin: { y: 0.6 }
        });
    }
}

async function triggerChaos() {
    const btn = document.querySelector('.chaos-btn');
    btn.innerText = "🎲";

    try {
        const res = await fetch('/api/chaos_topic');
        const data = await res.json();
        document.getElementById('topic-input').value = data.topic;
        btn.innerText = "🔥";
        startDebate();
    } catch (e) {
        console.error("Chaos failed:", e);
        btn.innerText = "❌";
        setTimeout(() => btn.innerText = "🔥", 2000);
    }
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
