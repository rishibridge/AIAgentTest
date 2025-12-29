// Speech synthesis state
let soundEnabled = false;
let speechQueue = [];
let isSpeaking = false;
let voices = [];

// Pacing State
let nextMessageTime = 0; // Timestamp when the next message is allowed to show
const WORDS_PER_MINUTE = 250; // Average reading speed

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
    const wordCount = text.trim().split(/\s+/).length;
    // Calculate reading time in milliseconds
    const readingTimeMs = (wordCount / WORDS_PER_MINUTE) * 60 * 1000;
    // Add a small buffer (1s)
    return readingTimeMs + 1000;
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

    if (isContentHidden) {
        indicator.classList.add('visible');
    } else {
        indicator.classList.remove('visible');
    }
}


async function startDebate() {
    const topicInput = document.getElementById('topic-input');
    const advocateToneSelect = document.getElementById('advocate-tone');
    const skepticToneSelect = document.getElementById('skeptic-tone');
    const advocateModel = document.getElementById('advocate-model');
    const skepticModel = document.getElementById('skeptic-model');
    const judgeModel = document.getElementById('judge-model');

    const topic = topicInput.value || "Is Buddhism a religion?";
    const advocateTone = advocateToneSelect.value;
    const skepticTone = skepticToneSelect.value;

    // Update global state for UI rendering
    currentAdvocateTone = advocateTone.charAt(0).toUpperCase() + advocateTone.slice(1);
    currentSkepticTone = skepticTone.charAt(0).toUpperCase() + skepticTone.slice(1);

    const advocate = advocateModel ? advocateModel.value : 'gemini';
    const skeptic = skepticModel ? skepticModel.value : 'kimi';
    const judge = judgeModel ? judgeModel.value : 'deepseek';
    const stream = document.getElementById('discussion-stream');
    const container = document.getElementById('main-discussion');

    // Clear previous discussion and speech queue
    stream.innerHTML = '';
    window.speechSynthesis.cancel();
    speechQueue = [];
    isSpeaking = false;
    nextMessageTime = 0; // Reset pacing

    if (!document.querySelector('.new-messages-indicator')) {
        setupSmartScroll();
    }
    document.querySelector('.new-messages-indicator').classList.remove('visible');

    // Visual Activation
    document.querySelector('.header-logo').classList.add('debating');

    const response = await fetch(`/api/debate?topic=${encodeURIComponent(topic)}&advocate_tone=${encodeURIComponent(advocateTone)}&skeptic_tone=${encodeURIComponent(skepticTone)}&advocate_model=${encodeURIComponent(advocate)}&skeptic_model=${encodeURIComponent(skeptic)}&judge_model=${encodeURIComponent(judge)}`);
    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
        const { value, done } = await reader.read();
        if (done) {
            // Debate finished, back to sleep
            document.querySelector('.header-logo').classList.remove('debating');
            break;
        }

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
            if (!line) continue;
            try {
                const event = JSON.parse(line);
                if (event.state === 'loading') {
                    // Capture position BEFORE rendering
                    const wasAtBottom = isUserAtBottom();

                    renderLoadingMessage(event);

                    // Apply scroll if needed
                    handleScrollPostRender(wasAtBottom);

                } else if (event.role === 'for' || event.role === 'against' || event.role === 'judge') {
                    // Pacing check - DISABLED by request
                    // if (event.text.length > 50) { 
                    //      await enforcePacing();
                    // }

                    // Capture position BEFORE rendering (crucial for smart scroll)
                    const wasAtBottom = isUserAtBottom();

                    removeLoadingMessages();
                    renderMessage(event);
                    speakText(event.text, event.role);

                    // Apply scroll if needed
                    handleScrollPostRender(wasAtBottom);

                    // Update pacing for NEXT message
                    updatePacing(event.text);
                }
            } catch (e) { console.error("Parse error", e); }
        }
    }
}

function markdownToHtml(text) {
    return text
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')  // Bold **text**
        .replace(/\*(.+?)\*/g, '<em>$1</em>')              // Italic *text*
        .replace(/__(.+?)__/g, '<strong>$1</strong>')      // Bold __text__
        .replace(/_(.+?)_/g, '<em>$1</em>')                // Italic _text_
        .replace(/`(.+?)`/g, '<code>$1</code>')            // Inline code
        .replace(/\n\s*\n/g, '\n')                         // Collapse multiple newlines
        .replace(/\n/g, '<br>');                           // Newlines to <br>
}

function renderMessage(data) {
    const stream = document.getElementById('discussion-stream');

    const msgDiv = document.createElement('div');
    msgDiv.className = `message msg-${data.role}`;
    if (data.state === 'verdict') msgDiv.classList.add('verdict-box');

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
            <div class="msg-sidebar">
                <img src="${avatarMap[data.role]}" class="msg-avatar">
                <div class="role-label">${nameMap[data.role]}</div>
                ${styleLabel}
                ${data.round ? `<div class="round-label">${data.round}</div>` : ''}
            </div>
            <div class="bubble">${cleanText}</div>
        `;
    }

    msgDiv.innerHTML = innerHTML;
    stream.appendChild(msgDiv);
}

function renderLoadingMessage(data) {
    const stream = document.getElementById('discussion-stream');

    // Remove any existing loading message first
    removeLoadingMessages();

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
