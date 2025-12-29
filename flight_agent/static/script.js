// City to ALL Airport Codes
const CITY_AIRPORTS = {
    'dallas': ['DFW', 'DAL'],
    'london': ['LHR', 'LGW', 'STN', 'LTN'],
    'new york': ['JFK', 'EWR', 'LGA'],
    'los angeles': ['LAX', 'BUR', 'SNA', 'ONT'],
    'chicago': ['ORD', 'MDW'],
    'san francisco': ['SFO', 'OAK', 'SJC'],
    'miami': ['MIA', 'FLL'],
    'paris': ['CDG', 'ORY'],
    'tokyo': ['NRT', 'HND'],
    'sydney': ['SYD'],
    'dubai': ['DXB', 'DWC'],
    'singapore': ['SIN'],
    'hong kong': ['HKG'],
    'amsterdam': ['AMS'],
    'frankfurt': ['FRA'],
    'rome': ['FCO', 'CIA'],
    'barcelona': ['BCN'],
    'toronto': ['YYZ', 'YTZ'],
    'seattle': ['SEA'],
    'boston': ['BOS'],
    'denver': ['DEN'],
    'atlanta': ['ATL'],
    'austin': ['AUS'],
    'phoenix': ['PHX'],
    'las vegas': ['LAS'],
    'orlando': ['MCO', 'SFB'],
    'washington': ['DCA', 'IAD', 'BWI'],
    'mumbai': ['BOM'],
    'delhi': ['DEL'],
    'bangalore': ['BLR'],
    'cancun': ['CUN'],
    'mexico city': ['MEX']
};

function cityToAirports(input) {
    const lower = input.toLowerCase().trim();
    // If already a 3-letter code, return as single-item array
    if (lower.length === 3 && /^[a-z]+$/.test(lower)) {
        return [lower.toUpperCase()];
    }
    // Look up all airports for this city
    return CITY_AIRPORTS[lower] || [input.toUpperCase()];
}

// Mode Toggle
function toggleMode() {
    const mode = document.querySelector('input[name="mode"]:checked').value;
    document.getElementById('duration-sentence').classList.toggle('hidden', mode !== 'duration');
    document.getElementById('return-sentence').classList.toggle('hidden', mode !== 'return');
}

// Form Submit
document.getElementById('search-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const origins = cityToAirports(document.getElementById('origin').value);
    const destinations = cityToAirports(document.getElementById('destination').value);
    const dep_start = document.getElementById('dep_start').value;
    const dep_end = document.getElementById('dep_end').value;

    const mode = document.querySelector('input[name="mode"]:checked').value;
    let dur_min = 7, dur_max = 10, ret_start = null, ret_end = null;

    if (mode === 'duration') {
        dur_min = parseInt(document.getElementById('dur_min').value) || 7;
        dur_max = parseInt(document.getElementById('dur_max').value) || 10;
    } else {
        ret_start = document.getElementById('ret_start').value;
        ret_end = document.getElementById('ret_end').value;
    }

    const email = document.getElementById('email').value;

    // Show loading
    document.getElementById('loading').classList.remove('hidden');
    document.getElementById('results').classList.add('hidden');
    document.getElementById('progress-bar').style.width = '100%';

    const log = document.getElementById('log');
    log.innerHTML = '';

    try {
        const source = document.getElementById('source').value;

        const response = await fetch('/api/search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                origins, destinations, dep_start, dep_end,
                mode, dur_min, dur_max, ret_start, ret_end,
                email, source, stops: '1'
            })
        });

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let bestResult = null;
        let allResults = [];
        let total = 50, checked = 0;

        while (true) {
            const { value, done } = await reader.read();
            if (done) break;

            for (const line of decoder.decode(value, { stream: true }).split('\n').filter(l => l.trim())) {
                try {
                    const data = JSON.parse(line);
                    if (data.type === 'log') {
                        log.innerHTML += data.message + '<br>';
                        log.scrollTop = log.scrollHeight;

                        // Parse total from "Checking X combinations"
                        const totalMatch = data.message.match(/Checking (\d+) combinations/);
                        if (totalMatch) {
                            total = parseInt(totalMatch[1]);
                            document.getElementById('loading-text').textContent = `Searching ${total} combinations...`;
                        }

                        // Show every log message in status bar
                        const loadingText = document.getElementById('loading-text');
                        loadingText.style.animation = 'none';
                        loadingText.offsetHeight;
                        loadingText.style.animation = 'slideIn 0.3s ease-out, pulse 2s ease-in-out infinite';
                        // Strip timestamp for cleaner display
                        const cleanMsg = data.message.replace(/^\[\d{2}:\d{2}:\d{2}\]\s*/, '');
                        loadingText.textContent = cleanMsg;
                    } else if (data.type === 'result') {
                        allResults.push(data);
                        if (!bestResult || data.price_val < bestResult.price_val) {
                            bestResult = data;
                            document.getElementById('best-price').textContent = data.price_str;
                            document.getElementById('best-airline').textContent = data.airline || 'Flight';
                            document.getElementById('best-dates').textContent = data.date || '';
                            document.getElementById('best-times').textContent = data.times || '';
                            document.getElementById('best-meta').textContent = data.stops === 0 ? 'Nonstop' : `${data.stops} stop`;
                            document.getElementById('best-flight-num').textContent = data.flight_number ? `Flight ${data.flight_number}` : '';
                            // Build layover string
                            let layoverStr = '';
                            if (data.layover) layoverStr += `via ${data.layover}`;
                            if (data.layover_duration) layoverStr += ` (${data.layover_duration})`;
                            document.getElementById('best-layover').textContent = layoverStr;
                            document.getElementById('best-link').href = data.url || '#';
                        }
                    } else if (data.type === 'complete') {
                        document.getElementById('loading').classList.add('hidden');
                        if (bestResult) {
                            document.getElementById('results').classList.remove('hidden');
                            const altList = document.getElementById('alt-list');
                            altList.innerHTML = '';
                            allResults.filter(r => r !== bestResult).sort((a, b) => a.price_val - b.price_val).slice(0, 5).forEach(r => {
                                const d = document.createElement('div');
                                d.className = 'alt-item';
                                d.textContent = `${r.price_str} · ${r.date || ''}`;
                                d.onclick = () => window.open(r.url, '_blank');
                                altList.appendChild(d);
                            });
                        }
                    }
                } catch (err) { }
            }
        }
    } catch (err) {
        document.getElementById('loading').classList.add('hidden');
    }
});

// Default dates
const d = new Date();
d.setMonth(d.getMonth() + 2);
document.getElementById('dep_start').value = d.toISOString().split('T')[0];
d.setDate(d.getDate() + 7);
document.getElementById('dep_end').value = d.toISOString().split('T')[0];
