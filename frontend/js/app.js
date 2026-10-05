/**
 * app.js - WeatherGPT main application
 * Phase 2: Home + Weather screens wired to live GET /api/weather
 * Phase 3: Forecast screen wired to live GET /api/forecast
 * Phase 4: Alerts screen wired to live GET /api/alerts
 * Geolocation: tries browser GPS, falls back to New Delhi.
 */

// ── Default location: New Delhi, India ────────────────────
const DEFAULT_LAT = 28.6139;
const DEFAULT_LON = 77.2090;

// ── App state ─────────────────────────────────────────────
const state = {
    latitude: DEFAULT_LAT,
    longitude: DEFAULT_LON,
    locationName: 'New Delhi, India',
    userName: '',
    weatherCache: null,        // last successful weather response
    chatLanguage: 'en',
    chatMode: 'general',
    messages: []
};

// ══════════════════════════════════════════════════════════
//  Utility helpers
// ══════════════════════════════════════════════════════════

function showLoading(containerId) {
    const el = document.getElementById(containerId);
    if (el) el.innerHTML = `
        <div class="loading-state">
            <div class="loading-spinner"></div>
            <p style="color:#636E72;font-size:14px">Loading...</p>
        </div>`;
}

function showError(containerId, message, retryFn) {
    const el = document.getElementById(containerId);
    if (!el) return;
    el.innerHTML = `
        <div class="error-state">
            <span style="font-size:36px">⚠️</span>
            <p style="color:#636E72;font-size:14px">${message}</p>
            ${retryFn ? `<button class="retry-btn" onclick="${retryFn}()">Try Again</button>` : ''}
        </div>`;
}

function getConditionIcon(condition, isDay = 1) {
    if (!condition) return isDay ? '🌤️' : '🌙';
    const c = condition.toLowerCase();
    if (c.includes('thunder'))                               return '⛈️';
    if (c.includes('heavy rain') || c.includes('violent'))  return '🌧️';
    if (c.includes('rain') || c.includes('drizzle') || c.includes('shower')) return '🌦️';
    if (c.includes('snow'))                                  return '❄️';
    if (c.includes('fog') || c.includes('mist'))            return '🌫️';
    if (c.includes('overcast') || c.includes('cloudy'))     return '☁️';
    if (c.includes('partly') || c.includes('mainly clear')) return isDay ? '⛅' : '🌙';
    if (c.includes('clear') || c.includes('sunny'))         return isDay ? '☀️' : '🌙';
    return isDay ? '🌤️' : '🌙';
}

function formatDate(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric' });
}

function getSeverityColor(severity) {
    if (severity === 'high')   return '#D63031';
    if (severity === 'medium') return '#FDCB6E';
    return '#00B894';
}

// ══════════════════════════════════════════════════════════
//  Geolocation
// ══════════════════════════════════════════════════════════

/**
 * Try to get the user's GPS position.
 * Resolves immediately with default coords if denied/unavailable.
 * @returns {Promise<{lat: number, lon: number}>}
 */
function getUserLocation() {
    return new Promise((resolve) => {
        if (!navigator.geolocation) {
            resolve({ lat: DEFAULT_LAT, lon: DEFAULT_LON });
            return;
        }
        navigator.geolocation.getCurrentPosition(
            (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
            ()    => resolve({ lat: DEFAULT_LAT, lon: DEFAULT_LON }),
            { timeout: 5000, maximumAge: 60000 }
        );
    });
}

// ══════════════════════════════════════════════════════════
//  Weather data helpers
// ══════════════════════════════════════════════════════════

/**
 * Fetch weather from the backend and cache it in state.
 * Updates state.latitude / longitude if geolocation succeeded.
 * Returns the weather data object or throws on error.
 */
async function fetchWeatherData() {
    const { lat, lon } = await getUserLocation();
    state.latitude  = lat;
    state.longitude = lon;
    const data = await getWeather(lat, lon);
    state.weatherCache = data;
    state.locationName = data.location || 'Your Location';
    return data;
}

/**
 * Populate the Home screen hero card and detail grid with live data.
 * @param {Object} w - WeatherResponse from backend
 */
function populateHomeWeather(w) {
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    set('hero-icon',      getConditionIcon(w.condition, w.is_day ?? 1));
    set('hero-temp',      `${Math.round(w.temperature)}°`);
    set('hero-condition', w.condition);
    set('hero-location',  `📍 ${w.location}`);
    set('d-humidity',     `${w.humidity}%`);
    set('d-wind',         `${w.wind_speed} km/h`);
    set('d-feels',        `${Math.round(w.feels_like)}°`);
    set('d-rain',         `${w.rain_probability}%`);
}

/**
 * Populate the Weather screen hero card and detail grid with live data.
 * @param {Object} w - WeatherResponse from backend
 */
function populateWeatherScreen(w) {
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    set('w-icon',      getConditionIcon(w.condition, w.is_day ?? 1));
    set('w-temp',      `${Math.round(w.temperature)}°`);
    set('w-condition', w.condition);
    set('w-location',  `📍 ${w.location}`);
    set('w-humidity',  `${w.humidity}%`);
    set('w-wind',      `${w.wind_speed} km/h`);
    set('w-feels',     `${Math.round(w.feels_like)}°C`);
    set('w-rain',      `${w.rain_probability}%`);
}

// ══════════════════════════════════════════════════════════
//  HOME Screen
// ══════════════════════════════════════════════════════════

async function renderHomeScreen() {
    const content = document.getElementById('home-content');
    if (!content) return;

    // Update avatar initials from current user name (dynamic, not hardcoded)
    const avatarEl = document.getElementById('home-avatar-initials');
    if (avatarEl) {
        const name = state.userName ||
            (() => { try { const u = JSON.parse(localStorage.getItem('weathergpt_user') || '{}'); return u.name || ''; } catch(_) { return ''; } })();
        const initials = name
            ? name.trim().split(/\s+/).map(w => w[0] || '').slice(0, 2).join('').toUpperCase()
            : '?';
        avatarEl.textContent = initials;
    }

    // Render skeleton structure first — API fills in data
    content.innerHTML = `
        <div class="weather-hero">
            <div style="font-size:64px;margin-bottom:8px" id="hero-icon">🌤️</div>
            <div class="hero-temp" id="hero-temp">--°</div>
            <div class="hero-condition" id="hero-condition">
                <span class="loading-spinner" style="width:16px;height:16px;border-width:2px;display:inline-block;vertical-align:middle"></span>
                <span style="margin-left:6px;opacity:0.8">Fetching weather…</span>
            </div>
            <div class="hero-location" id="hero-location">📍 Detecting location…</div>
        </div>

        <div class="card">
            <div class="section-title">Current Conditions</div>
            <div class="details-grid">
                <div class="detail-item">
                    <span class="detail-label">💧 Humidity</span>
                    <span class="detail-value" id="d-humidity">--%</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">💨 Wind</span>
                    <span class="detail-value" id="d-wind">-- km/h</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">🌡️ Feels Like</span>
                    <span class="detail-value" id="d-feels">--°</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">🌧️ Rain Chance</span>
                    <span class="detail-value" id="d-rain">--%</span>
                </div>
            </div>
        </div>

        <div class="card">
            <div class="section-title">Quick Actions</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
                <button onclick="navigateTo('chat')"
                    style="background:#EBF5FF;border:none;border-radius:12px;padding:14px;cursor:pointer;font-size:13px;color:#2E86DE;font-weight:600;font-family:inherit">
                    🤖 Ask WeatherGPT
                </button>
                <button onclick="navigateTo('forecast')"
                    style="background:#EBF5FF;border:none;border-radius:12px;padding:14px;cursor:pointer;font-size:13px;color:#2E86DE;font-weight:600;font-family:inherit">
                    📅 7-Day Forecast
                </button>
                <button onclick="navigateTo('alerts')"
                    style="background:#EBF5FF;border:none;border-radius:12px;padding:14px;cursor:pointer;font-size:13px;color:#2E86DE;font-weight:600;font-family:inherit">
                    🚨 Check Alerts
                </button>
                <button onclick="navigateTo('live-map')"
                    style="background:#EBF5FF;border:none;border-radius:12px;padding:14px;cursor:pointer;font-size:13px;color:#2E86DE;font-weight:600;font-family:inherit">
                    🗺️ Live Weather Map
                </button>
                <button onclick="navigateTo('safe-route')"
                    style="grid-column: span 2; background:#F0FDF4; border:1px solid #BBF7D0; border-radius:12px; padding:12px; cursor:pointer; font-size:13px; color:#166534; font-weight:600; font-family:inherit; display:flex; align-items:center; justify-content:center; gap:8px">
                    🗺️ Safe Route (Travel Advisory)
                </button>
                <button onclick="navigateTo('climate')"
                    style="grid-column: span 2; background:#F5F3FF; border:1px solid #DDD6FE; border-radius:12px; padding:12px; cursor:pointer; font-size:13px; color:#6D28D9; font-weight:600; font-family:inherit; display:flex; align-items:center; justify-content:center; gap:8px">
                    📊 Climate Trends & Historical Insights
                </button>
                <button onclick="navigateTo('predict')"
                    style="grid-column: span 2; background:#FFF7ED; border:1px solid #FED7AA; border-radius:12px; padding:12px; cursor:pointer; font-size:13px; color:#C2410C; font-weight:600; font-family:inherit; display:flex; align-items:center; justify-content:center; gap:8px">
                    🌲 ML Hazard Risk Predictor
                </button>
                <button onclick="navigateTo('emergency')"
                    style="grid-column: span 2; background:#FFF1F2; border:1px solid #FECDD3; border-radius:12px; padding:12px; cursor:pointer; font-size:13px; color:#BE123C; font-weight:600; font-family:inherit; display:flex; align-items:center; justify-content:center; gap:8px">
                    🚨 Emergency INFO
                </button>
            </div>
        </div>`;

    // Fetch live data and populate
    try {
        const data = state.weatherCache
            ? (() => { populateHomeWeather(state.weatherCache); return null; })()
            : await fetchWeatherData();
        if (data) populateHomeWeather(data);
    } catch (err) {
        const condEl = document.getElementById('hero-condition');
        if (condEl) condEl.textContent = 'Unable to load weather';
        const locEl = document.getElementById('hero-location');
        if (locEl) locEl.innerHTML = `📍 ${state.locationName} &nbsp;
            <button onclick="refreshHomeWeather()"
                style="background:rgba(255,255,255,0.3);border:1px solid rgba(255,255,255,0.5);
                       border-radius:12px;padding:2px 10px;color:white;cursor:pointer;font-size:12px;font-family:inherit">
                Retry
            </button>`;
    }
}

/** Called by the Retry button and top-bar refresh on Home. */
async function refreshHomeWeather() {
    state.weatherCache = null;
    await renderHomeScreen();
}

// ══════════════════════════════════════════════════════════
//  WEATHER Screen
// ══════════════════════════════════════════════════════════

async function renderWeatherScreen() {
    const content = document.getElementById('weather-content');
    if (!content) return;

    // Render skeleton
    content.innerHTML = `
        <div class="weather-hero">
            <div style="font-size:64px;margin-bottom:8px" id="w-icon">🌤️</div>
            <div class="hero-temp" id="w-temp">--°</div>
            <div class="hero-condition" id="w-condition">
                <span class="loading-spinner" style="width:16px;height:16px;border-width:2px;display:inline-block;vertical-align:middle"></span>
                <span style="margin-left:6px;opacity:0.8">Fetching weather…</span>
            </div>
            <div class="hero-location" id="w-location">📍 Detecting location…</div>
        </div>

        <div class="card">
            <div class="section-title">Details</div>
            <div class="details-grid">
                <div class="detail-item">
                    <span class="detail-label">💧 Humidity</span>
                    <span class="detail-value" id="w-humidity">--%</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">💨 Wind Speed</span>
                    <span class="detail-value" id="w-wind">-- km/h</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">🌡️ Feels Like</span>
                    <span class="detail-value" id="w-feels">--°C</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">🌧️ Rain Prob.</span>
                    <span class="detail-value" id="w-rain">--%</span>
                </div>
            </div>
        </div>

        <div style="text-align:center;padding:12px">
            <button onclick="loadWeatherScreen()" class="retry-btn">🔄 Refresh</button>
        </div>`;

    // Fetch live data
    try {
        const data = state.weatherCache ? state.weatherCache : await fetchWeatherData();
        populateWeatherScreen(data);
    } catch (err) {
        const condEl = document.getElementById('w-condition');
        if (condEl) condEl.textContent = 'Unable to load weather';
        const locEl = document.getElementById('w-location');
        if (locEl) locEl.innerHTML = `📍 ${state.locationName} &nbsp;
            <button onclick="loadWeatherScreen()"
                style="background:rgba(255,255,255,0.3);border:1px solid rgba(255,255,255,0.5);
                       border-radius:12px;padding:2px 10px;color:white;cursor:pointer;font-size:12px;font-family:inherit">
                Retry
            </button>`;
    }
}

// ══════════════════════════════════════════════════════════
//  FORECAST Screen
// ══════════════════════════════════════════════════════════

async function renderForecastScreen() {
    const content = document.getElementById('forecast-content');
    if (!content) return;

    // Show loading skeleton immediately
    content.innerHTML = `
        <div class="card">
            <div class="section-title" id="forecast-location-title">7-Day Forecast</div>
            <div id="forecast-list">
                <div class="loading-state">
                    <div class="loading-spinner"></div>
                    <p style="color:#636E72;font-size:14px">Loading forecast...</p>
                </div>
            </div>
        </div>`;

    try {
        // Use coordinates already set by geolocation in Phase 2
        const data = await getForecast(state.latitude, state.longitude, 7);

        // Update location title
        const titleEl = document.getElementById('forecast-location-title');
        if (titleEl) titleEl.textContent = `7-Day Forecast — ${data.location}`;

        const listEl = document.getElementById('forecast-list');
        if (!listEl) return;

        // Empty response guard
        if (!data.days || data.days.length === 0) {
            listEl.innerHTML = `
                <div class="empty-state">
                    <span style="font-size:36px">📭</span>
                    <p style="color:#636E72;font-size:14px">No forecast data available.</p>
                    <button class="retry-btn" onclick="loadForecastScreen()">Try Again</button>
                </div>`;
            return;
        }

        // Render one row per forecast day
        // Fields used (verified from ForecastDay schema):
        //   day.date (YYYY-MM-DD), day.condition, day.max_temp, day.min_temp,
        //   day.rain_probability, day.wind_speed, day.precipitation_mm
        listEl.innerHTML = `<div class="forecast-list">
            ${data.days.map(day => `
                <div class="forecast-item">
                    <div class="forecast-date">${formatDate(day.date)}</div>
                    <div class="forecast-condition">
                        <span style="margin-right:6px">${getConditionIcon(day.condition)}</span>
                        ${day.condition}
                    </div>
                    <div class="forecast-temp">
                        <span style="color:#D63031">${Math.round(day.max_temp)}°</span>
                        <span style="color:#636E72;margin:0 2px">/</span>
                        <span style="color:#74B9FF">${Math.round(day.min_temp)}°</span>
                    </div>
                </div>
                <div style="padding:0 16px 10px;display:flex;gap:16px;font-size:12px;color:#636E72">
                    <span>🌧️ ${day.rain_probability}%</span>
                    <span>💨 ${day.wind_speed} km/h</span>
                    <span>💧 ${day.precipitation_mm} mm</span>
                </div>
            `).join('')}
        </div>`;

    } catch (err) {
        const listEl = document.getElementById('forecast-list');
        if (listEl) {
            listEl.innerHTML = `
                <div class="error-state">
                    <span style="font-size:36px">⚠️</span>
                    <p style="color:#636E72;font-size:14px">Unable to load forecast. Please check that the WeatherGPT backend is running.</p>
                    <button class="retry-btn" onclick="loadForecastScreen()">Try Again</button>
                </div>`;
        }
    }
}

// ══════════════════════════════════════════════════════════
//  CHAT Screen
// ══════════════════════════════════════════════════════════

function renderChatScreen() {
    const screen = document.getElementById('screen-chat');
    if (!screen) return;

    const optionsBar = screen.querySelector('.chat-options-bar');
    if (!optionsBar) return;

    const modes = ['general', 'farmer', 'traveller', 'citizen'];
    const langs = [['en','EN'], ['hi','हि'], ['bn','বা'], ['ta','த'], ['mr','म']];

    optionsBar.innerHTML = `
        <span style="font-size:12px;color:#636E72;align-self:center;white-space:nowrap">Mode:</span>
        ${modes.map(m =>
            `<button class="option-chip${state.chatMode === m ? ' active' : ''}"
                     onclick="setChatMode('${m}')">${m}</button>`
        ).join('')}
        <span style="font-size:12px;color:#636E72;align-self:center;margin-left:8px;white-space:nowrap">Lang:</span>
        ${langs.map(([code, label]) =>
            `<button class="option-chip${state.chatLanguage === code ? ' active' : ''}"
                     onclick="setChatLanguage('${code}')">${label}</button>`
        ).join('')}`;
}

function setChatMode(mode) {
    state.chatMode = mode;
    renderChatScreen();
}

function setChatLanguage(lang) {
    state.chatLanguage = lang;
    renderChatScreen();
}

function appendMessage(text, role) {
    const container = document.getElementById('chat-messages');
    if (!container) return;
    const bubble = document.createElement('div');
    bubble.className = `chat-bubble ${role}`;
    bubble.textContent = text;
    container.appendChild(bubble);
    container.scrollTop = container.scrollHeight;
}

async function sendMessage() {
    const input = document.getElementById('chat-input-field');
    if (!input) return;
    const message = input.value.trim();
    if (!message) return;

    input.value = '';
    appendMessage(message, 'user');
    state.messages.push({ role: 'user', text: message });

    const container = document.getElementById('chat-messages');
    const typing = document.createElement('div');
    typing.className = 'chat-bubble assistant';
    typing.id = 'typing-indicator';
    typing.innerHTML = '<span style="opacity:0.6">WeatherGPT is thinking...</span>';
    container.appendChild(typing);
    container.scrollTop = container.scrollHeight;

    try {
        const result = await sendChatMessage(
            message, state.latitude, state.longitude,
            state.chatLanguage, state.chatMode
        );
        typing.remove();
        appendMessage(result.answer, 'assistant');
        state.messages.push({ role: 'assistant', text: result.answer });
    } catch (err) {
        typing.remove();
        const errMsg = 'Sorry, I couldn\'t get a response right now. Please check that the WeatherGPT backend is running.';
        appendMessage(errMsg, 'assistant');
        state.messages.push({ role: 'assistant', text: errMsg });
    }
}

// ══════════════════════════════════════════════════════════
//  ALERTS Screen
// ══════════════════════════════════════════════════════════

async function renderAlertsScreen() {
    const content = document.getElementById('alerts-content');
    if (!content) return;

    // Show loading state immediately
    content.innerHTML = `
        <div id="alerts-container">
            <div class="loading-state">
                <div class="loading-spinner"></div>
                <p style="color:#636E72;font-size:14px">Checking weather alerts…</p>
            </div>
        </div>`;

    try {
        // AlertResponse fields: has_alert (bool), severity (str|null), type (str|null), message (str|null)
        const data = await getAlerts(state.latitude, state.longitude);
        const container = document.getElementById('alerts-container');
        if (!container) return;

        if (!data.has_alert) {
            // All clear — no active alerts
            container.innerHTML = `
                <div class="alert-card none">
                    <div class="alert-type">✅ All Clear</div>
                    <div class="alert-message">
                        No weather alerts for your location right now.
                        Conditions are normal — have a great day!
                    </div>
                </div>
                <div style="text-align:center;padding:12px">
                    <button onclick="loadAlertsScreen()" class="retry-btn">🔄 Refresh</button>
                </div>`;
            return;
        }

        // Active alert — determine card class and icon from severity
        const severity = data.severity || 'low';
        const severityIcon = severity === 'high' ? '🚨' : severity === 'medium' ? '⚠️' : 'ℹ️';

        // Format alert type: "heavy_rain" → "Heavy Rain"
        const alertType = data.type
            ? data.type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
            : 'Weather Alert';

        container.innerHTML = `
            <div class="alert-card ${severity}">
                <div class="alert-type">${severityIcon} ${alertType}</div>
                <div style="display:inline-block;background:${getSeverityColor(severity)};
                    color:white;font-size:11px;font-weight:600;padding:2px 10px;
                    border-radius:10px;margin-bottom:10px;text-transform:uppercase;
                    letter-spacing:0.5px">${severity} severity</div>
                <div class="alert-message">${data.message || 'Please take appropriate precautions.'}</div>
            </div>
            <div class="card" style="background:#F8FBFF">
                <div class="section-title" style="font-size:14px;margin-bottom:8px">What to do</div>
                <div style="font-size:13px;color:#636E72;line-height:1.6">
                    ${getAlertAdvice(data.type)}
                </div>
            </div>
            <div style="text-align:center;padding:12px">
                <button onclick="loadAlertsScreen()" class="retry-btn">🔄 Refresh</button>
            </div>`;

    } catch (err) {
        const container = document.getElementById('alerts-container');
        if (container) {
            container.innerHTML = `
                <div class="error-state">
                    <span style="font-size:36px">⚠️</span>
                    <p style="color:#636E72;font-size:14px">Unable to check alerts. Please make sure the WeatherGPT backend is running.</p>
                    <button class="retry-btn" onclick="loadAlertsScreen()">Try Again</button>
                </div>`;
        }
    }
}

/**
 * Return simple advice text for a given alert type.
 * @param {string|null} type
 * @returns {string}
 */
function getAlertAdvice(type) {
    const advice = {
        heavy_rain:   '• Avoid unnecessary travel<br>• Carry a waterproof umbrella<br>• Watch for waterlogging and road flooding<br>• Keep drains clear near your home',
        rain:         '• Carry an umbrella when going out<br>• Drive carefully on wet roads<br>• Avoid low-lying areas prone to flooding',
        strong_wind:  '• Secure loose outdoor items<br>• Avoid standing under trees or tall structures<br>• Drive carefully — avoid highways if wind is severe',
        extreme_heat: '• Stay indoors during peak afternoon hours<br>• Drink plenty of water throughout the day<br>• Wear light, breathable clothing<br>• Avoid strenuous outdoor activities',
        cold_wave:    '• Dress in warm layers<br>• Keep elderly family members warm<br>• Avoid prolonged exposure to cold outdoors',
    };
    return advice[type] || '• Stay informed about the weather<br>• Follow local authority advisories<br>• Keep emergency contacts handy';
}

// ══════════════════════════════════════════════════════════
//  SAFE ROUTE Screen (Page 10)
// ══════════════════════════════════════════════════════════

async function renderSafeRouteScreen() {
    const content = document.getElementById('safe-route-content');
    if (!content) return;

    // Show initial loading
    content.innerHTML = `
        <div class="loading-state">
            <div class="loading-spinner"></div>
            <p style="color:#636E72;font-size:14px">Checking regional weather & route safety status…</p>
        </div>`;

    // Fetch real local alerts and weather to display genuine regional telemetry
    let weatherData = state.weatherCache;
    let alertsData = null;

    try {
        if (!weatherData) {
            weatherData = await getWeather(state.latitude, state.longitude).catch(() => null);
        }
        alertsData = await getAlerts(state.latitude, state.longitude).catch(() => null);
    } catch (_) {}

    const locName = weatherData ? weatherData.location : state.locationName;
    const tempStr = weatherData ? `${Math.round(weatherData.temperature)}°C` : '--';
    const condStr = weatherData ? weatherData.condition : 'Standard conditions';
    const condIcon = weatherData ? getConditionIcon(weatherData.condition) : '🌤️';

    let alertSummaryHtml = '';
    if (alertsData && alertsData.has_alert) {
        const sevColor = getSeverityColor(alertsData.severity || 'low');
        alertSummaryHtml = `
            <div style="background:#FFF5F5; border-left:4px solid ${sevColor}; border-radius:10px; padding:12px 14px; margin-top:12px">
                <div style="font-weight:700; color:#D63031; font-size:13px; margin-bottom:4px">
                    🚨 Active Local Warning: ${alertsData.type ? alertsData.type.replace(/_/g, ' ') : 'Weather Alert'}
                </div>
                <div style="font-size:12px; color:#4A5568; line-height:1.5">${alertsData.message || 'Take necessary precautions.'}</div>
            </div>`;
    } else {
        alertSummaryHtml = `
            <div style="background:#F0FDF4; border-left:4px solid #00B894; border-radius:10px; padding:12px 14px; margin-top:12px">
                <div style="font-weight:700; color:#00B894; font-size:13px; margin-bottom:4px">
                    ✅ Regional Travel Advisory: All Clear
                </div>
                <div style="font-size:12px; color:#4A5568; line-height:1.5">No critical weather hazards or storm warnings detected in your immediate region.</div>
            </div>`;
    }

    content.innerHTML = `
        <div class="card" style="border:1px solid #E2E8F0; box-shadow:0 4px 12px rgba(0,0,0,0.04)">
            <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:8px">
                <span style="font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.5px; color:#4A5568; background:#EDF2F7; padding:3px 10px; border-radius:12px">
                    SIH26068 · Disaster Navigation
                </span>
                <span style="font-size:11px; font-weight:700; color:#DD6B20; background:#FEEBC8; padding:3px 10px; border-radius:12px">
                    Provider Pending
                </span>
            </div>
            <h2 style="font-size:18px; font-weight:700; color:#1A202C; margin-bottom:6px">Weather-Aware Safe Route</h2>
            <p style="font-size:13px; color:#718096; line-height:1.5">
                Evaluates travel corridor safety by intersecting road transit paths with real-time meteorological hazard telemetry.
            </p>
        </div>

        <!-- Capability & Architecture Notice -->
        <div class="card" style="border-left:4px solid #3182CE; background:#EBF8FF">
            <div style="font-weight:700; color:#2B6CB0; font-size:14px; margin-bottom:6px; display:flex; align-items:center; gap:6px">
                <span>ℹ️</span> Routing Engine Integration Status
            </div>
            <p style="font-size:13px; color:#2D3748; line-height:1.6; margin-bottom:10px">
                Turn-by-turn road navigation, coordinate path generation, and odometer distances require an external geospatial routing provider (such as <strong>OSRM</strong>, <strong>Mapbox Directions</strong>, or <strong>Google Directions API</strong>).
            </p>
            <p style="font-size:12px; color:#4A5568; line-height:1.5; font-style:italic">
                In accordance with project integrity standards, WeatherGPT does not fabricate synthetic road vectors, fake transit durations, or mock distances.
            </p>
        </div>

        <!-- Local Origin Conditions (Real Backend Data) -->
        <div class="card">
            <div class="section-title">📍 Current Location Conditions</div>
            <div style="display:flex; align-items:center; justify-content:space-between; margin-top:8px">
                <div>
                    <div style="font-weight:600; color:#2D3748; font-size:15px">${locName}</div>
                    <div style="font-size:12px; color:#718096">Departure Area Telemetry</div>
                </div>
                <div style="text-align:right">
                    <span style="font-size:24px">${condIcon}</span>
                    <span style="font-size:18px; font-weight:700; color:#2D3748; margin-left:4px">${tempStr}</span>
                    <div style="font-size:12px; color:#718096">${condStr}</div>
                </div>
            </div>
            ${alertSummaryHtml}
        </div>

        <!-- Available Meteorological Engines in WeatherGPT -->
        <div class="card">
            <div class="section-title">🛡️ WeatherGPT Safety Capabilities</div>
            <div style="display:flex; flex-direction:column; gap:10px; margin-top:10px">
                <div style="display:flex; gap:10px; align-items:flex-start">
                    <span style="font-size:18px">🚨</span>
                    <div>
                        <div style="font-size:13px; font-weight:600; color:#2D3748">Live Disaster Alerts Engine</div>
                        <div style="font-size:12px; color:#718096">Rule-based detection for heavy rain, gale winds, and severe storms.</div>
                    </div>
                </div>
                <div style="display:flex; gap:10px; align-items:flex-start">
                    <span style="font-size:18px">🌲</span>
                    <div>
                        <div style="font-size:13px; font-weight:600; color:#2D3748">ML Hazard Risk Classifier (Random Forest)</div>
                        <div style="font-size:12px; color:#718096">9-feature environmental risk evaluation (<code>/api/predict</code>).</div>
                    </div>
                </div>
                <div style="display:flex; gap:10px; align-items:flex-start">
                    <span style="font-size:18px">📅</span>
                    <div>
                        <div style="font-size:13px; font-weight:600; color:#2D3748">7-Day Corridor Forecast</div>
                        <div style="font-size:12px; color:#718096">Multi-day precipitation and wind forecasting for departure scheduling.</div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Interactive AI Travel Advisory Consultation -->
        <div class="card" style="background:#FAF5FF; border:1px solid #E9D8FD">
            <div style="font-weight:700; color:#6B46C1; font-size:14px; margin-bottom:6px; display:flex; align-items:center; gap:6px">
                <span>🤖</span> Consult WeatherGPT Traveller AI
            </div>
            <p style="font-size:12px; color:#553C9A; line-height:1.5; margin-bottom:12px">
                You can ask WeatherGPT's specialized <strong>Traveller Mode</strong> to analyze road safety, travel precautions, and weather hazards for any journey.
            </p>
            <button onclick="startTravellerConsultation()"
                style="width:100%; background:#805AD5; color:white; border:none; border-radius:10px; padding:12px; font-weight:600; font-size:13px; cursor:pointer; font-family:inherit; transition:background 0.2s">
                Ask AI Assistant (Traveller Mode) ➔
            </button>
        </div>

        <div style="text-align:center; padding:8px 0 20px 0">
            <button onclick="navigateTo('home')" class="retry-btn" style="background:#EDF2F7; color:#4A5568">
                ← Back to Dashboard
            </button>
        </div>
    `;
}

function startTravellerConsultation() {
    setChatMode('traveller');
    navigateTo('chat');
}

// ══════════════════════════════════════════════════════════
//  CLIMATE TRENDS Screen (Page 11)
// ══════════════════════════════════════════════════════════

let currentClimateDays = 30;

function loadClimateScreen() {
    renderClimateScreen(currentClimateDays);
}

function setClimateTimeframe(days) {
    currentClimateDays = days;
    renderClimateScreen(days);
}

async function renderClimateScreen(days = 30) {
    const content = document.getElementById('climate-content');
    if (!content) return;

    currentClimateDays = days;
    const lat = state.latitude;
    const lon = state.longitude;
    const locName = state.locationName || 'Current Location';

    // Calculate human-readable date range
    const endD = new Date();
    endD.setDate(endD.getDate() - 1);
    const startD = new Date();
    startD.setDate(startD.getDate() - days);
    const dOpts = { month: 'short', day: 'numeric', year: 'numeric' };
    const rangeText = `${startD.toLocaleDateString('en-US', dOpts)} – ${endD.toLocaleDateString('en-US', dOpts)}`;

    // Render skeleton with active timeframe selector immediately
    content.innerHTML = `
        <div class="timeframe-tabs">
            <button class="timeframe-tab-btn ${days === 7 ? 'active' : ''}" onclick="setClimateTimeframe(7)">7 Days</button>
            <button class="timeframe-tab-btn ${days === 30 ? 'active' : ''}" onclick="setClimateTimeframe(30)">30 Days</button>
            <button class="timeframe-tab-btn ${days === 90 ? 'active' : ''}" onclick="setClimateTimeframe(90)">90 Days</button>
        </div>
        <div id="climate-body">
            <div class="loading-state">
                <div class="loading-spinner"></div>
                <p style="color:#636E72;font-size:14px">Fetching historical climate analytics for past ${days} days…</p>
            </div>
        </div>`;

    try {
        const data = await getClimate(lat, lon, days);
        const bodyEl = document.getElementById('climate-body');
        if (!bodyEl) return;

        const resolvedLocation = data.location || locName;
        const dryDays = Math.max(0, days - data.rainy_days);
        const rainFreqPercent = Math.round((data.rainy_days / days) * 100);
        const tempRange = Math.round((data.avg_max_temp - data.avg_min_temp) * 10) / 10;

        bodyEl.innerHTML = `
            <!-- Location & Range Card -->
            <div class="card" style="border:1px solid #E2E8F0; box-shadow:0 4px 12px rgba(0,0,0,0.04)">
                <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:8px">
                    <span style="font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.5px; color:#6B21A8; background:#F3E8FF; padding:3px 10px; border-radius:12px">
                        Historical Climate Archive
                    </span>
                    <span style="font-size:11px; font-weight:600; color:#059669; background:#ECFDF5; padding:3px 10px; border-radius:12px">
                        Verified Data
                    </span>
                </div>
                <h2 style="font-size:18px; font-weight:700; color:#1A202C; margin-bottom:4px">📍 ${resolvedLocation}</h2>
                <div style="font-size:13px; color:#4A5568; font-weight:500; margin-bottom:4px">
                    Past ${days} Days · <span style="color:#718096">${rangeText}</span>
                </div>
                <div style="font-size:11px; color:#94A3B8">
                    Data sourced from Open-Meteo Historical Archive API (lat: ${data.latitude.toFixed(2)}, lon: ${data.longitude.toFixed(2)})
                </div>
            </div>

            <!-- Plain-Language Climate Summary -->
            <div class="card" style="background:#F0FDF4; border-left:4px solid #10B981">
                <div style="font-weight:700; color:#047857; font-size:14px; margin-bottom:6px; display:flex; align-items:center; gap:6px">
                    <span>📋</span> Historical Climate Summary
                </div>
                <p style="font-size:13px; color:#1F2937; line-height:1.6">
                    ${data.summary}
                </p>
            </div>

            <!-- 4-Stat Historical Metrics Grid -->
            <div class="card">
                <div class="section-title">📊 Key Climate Metrics</div>
                <div class="climate-stat-grid">
                    <div class="climate-stat-card">
                        <div class="climate-stat-label"><span>🌡️</span> Avg High Temp</div>
                        <div class="climate-stat-value">${data.avg_max_temp}°C</div>
                        <div class="climate-stat-sub">Daily average maximum</div>
                    </div>
                    <div class="climate-stat-card">
                        <div class="climate-stat-label"><span>❄️</span> Avg Low Temp</div>
                        <div class="climate-stat-value">${data.avg_min_temp}°C</div>
                        <div class="climate-stat-sub">Daily average minimum</div>
                    </div>
                    <div class="climate-stat-card">
                        <div class="climate-stat-label"><span>🌧️</span> Total Rainfall</div>
                        <div class="climate-stat-value">${data.total_rainfall_mm} <span style="font-size:14px;font-weight:500">mm</span></div>
                        <div class="climate-stat-sub">Cumulative precipitation</div>
                    </div>
                    <div class="climate-stat-card">
                        <div class="climate-stat-label"><span>💧</span> Rainy Days</div>
                        <div class="climate-stat-value">${data.rainy_days} <span style="font-size:13px;font-weight:500">/ ${days}d</span></div>
                        <div class="climate-stat-sub">Precipitation > 1.0 mm</div>
                    </div>
                </div>
            </div>

            <!-- Historical Distribution Context -->
            <div class="card">
                <div class="section-title">📈 Pattern Distribution</div>
                <div style="display:flex; flex-direction:column; gap:10px; margin-top:8px">
                    <div style="display:flex; justify-content:space-between; align-items:center; font-size:13px">
                        <span style="color:#64748B">Rain Frequency</span>
                        <span style="font-weight:700; color:#1E293B">${rainFreqPercent}% of days</span>
                    </div>
                    <div style="display:flex; justify-content:space-between; align-items:center; font-size:13px">
                        <span style="color:#64748B">Dry Period Days</span>
                        <span style="font-weight:700; color:#1E293B">${dryDays} days</span>
                    </div>
                    <div style="display:flex; justify-content:space-between; align-items:center; font-size:13px">
                        <span style="color:#64748B">Daily Temp Spread (High vs Low)</span>
                        <span style="font-weight:700; color:#1E293B">${tempRange}°C spread</span>
                    </div>
                </div>
            </div>

            <!-- Consult AI Assistant Action -->
            <div class="card" style="background:#FAF5FF; border:1px solid #E9D8FD">
                <div style="font-weight:700; color:#6B46C1; font-size:14px; margin-bottom:6px; display:flex; align-items:center; gap:6px">
                    <span>🤖</span> Ask WeatherGPT About This Climate
                </div>
                <p style="font-size:12px; color:#553C9A; line-height:1.5; margin-bottom:12px">
                    Need advice on how this past climate pattern affects your farming, travel, or health? Consult the AI Assistant.
                </p>
                <button onclick="navigateTo('chat')"
                    style="width:100%; background:#805AD5; color:white; border:none; border-radius:10px; padding:12px; font-weight:600; font-size:13px; cursor:pointer; font-family:inherit; transition:background 0.2s">
                    Ask AI Assistant ➔
                </button>
            </div>

            <div style="text-align:center; padding:8px 0 20px 0">
                <button onclick="navigateTo('home')" class="retry-btn" style="background:#EDF2F7; color:#4A5568">
                    ← Back to Dashboard
                </button>
            </div>
        `;
    } catch (err) {
        const bodyEl = document.getElementById('climate-body');
        if (bodyEl) {
            bodyEl.innerHTML = `
                <div class="error-state">
                    <span style="font-size:36px">⚠️</span>
                    <p style="color:#636E72;font-size:14px">${err.message || 'Unable to fetch historical climate archive data. Please ensure the WeatherGPT backend is running.'}</p>
                    <button class="retry-btn" onclick="renderClimateScreen(${days})">Try Again</button>
                </div>`;
        }
    }
}

// ══════════════════════════════════════════════════════════
//  Screen-change handler + named refresh helpers
// ══════════════════════════════════════════════════════════

function loadWeatherScreen() {
    state.weatherCache = null;   // force fresh fetch on manual refresh
    renderWeatherScreen();
}

/** Called by the Refresh button on the Forecast screen. Forces a fresh API fetch. */
function loadForecastScreen() { renderForecastScreen(); }
/** Called by the Refresh button on the Alerts screen. Forces a fresh API call. */
function loadAlertsScreen() { renderAlertsScreen(); }
/** Called by the Refresh button on the Safe Route screen. Forces a fresh refresh. */
function loadSafeRouteScreen() { renderSafeRouteScreen(); }

document.addEventListener('screenChanged', (e) => {
    const screen = e.detail.screen;
    if (screen === 'home')       renderHomeScreen();
    if (screen === 'weather')    renderWeatherScreen();
    if (screen === 'live-map')   renderLiveMapScreen();
    if (screen === 'forecast')   renderForecastScreen();
    if (screen === 'chat')       renderChatScreen();
    if (screen === 'alerts')     renderAlertsScreen();
    if (screen === 'safe-route') renderSafeRouteScreen();
    if (screen === 'climate')    renderClimateScreen(currentClimateDays);
    if (screen === 'predict')    renderPredictScreen();
    if (screen === 'emergency')  renderEmergencyScreen();
    if (screen === 'explain')    renderExplainScreen();
    if (screen === 'dashboard')  renderDashboardScreen();
    if (screen === 'profile')    renderProfileScreen();
});

// ══════════════════════════════════════════════════════════
//  Splash Screen (Page 1) Controller
// ══════════════════════════════════════════════════════════

let splashDismissed = false;

function dismissSplash() {
    if (splashDismissed || window.currentScreen !== 'splash') return;
    splashDismissed = true;
    const splashEl = document.getElementById('screen-splash');
    if (splashEl) {
        splashEl.classList.add('fade-out');
        setTimeout(() => {
            navigateTo('create-account');
        }, 320);
    } else {
        navigateTo('create-account');
    }
}

// ══════════════════════════════════════════════════════════
//  Create Account Screen (Page 2) Controller
// ══════════════════════════════════════════════════════════

function selectPersona(el, persona) {
    document.querySelectorAll('.persona-chip').forEach(c => c.classList.remove('selected'));
    el.classList.add('selected');
    const input = document.getElementById('ca-persona');
    if (input) input.value = persona;
}

function togglePasswordVisibility(fieldId, btn) {
    const input = document.getElementById(fieldId);
    if (!input) return;
    if (input.type === 'password') {
        input.type = 'text';
        btn.textContent = '🙈';
    } else {
        input.type = 'password';
        btn.textContent = '👁️';
    }
}

function handleCreateAccount(e) {
    e.preventDefault();
    const nameInput = document.getElementById('ca-name');
    const emailInput = document.getElementById('ca-email');
    const pwdInput = document.getElementById('ca-password');
    const personaInput = document.getElementById('ca-persona');
    const termsInput = document.getElementById('ca-terms');

    const name = nameInput ? nameInput.value.trim() : '';
    const email = emailInput ? emailInput.value.trim() : '';
    const pwd = pwdInput ? pwdInput.value : '';
    const persona = personaInput ? personaInput.value : 'citizen';

    if (!name || name.length < 2) {
        showAuthError('Please enter your full name (at least 2 characters).');
        return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
        showAuthError('Please enter a valid email address.');
        return;
    }

    if (!pwd || pwd.length < 6) {
        showAuthError('Password must be at least 6 characters long.');
        return;
    }

    if (termsInput && !termsInput.checked) {
        showAuthError('You must agree to the Terms of Service to create an account.');
        return;
    }

    // Success: save user preference and navigate to Home screen
    state.userName = name;
    if (persona && ['general', 'farmer', 'traveller', 'citizen'].includes(persona)) {
        state.chatMode = persona;
    }

    const errorEl = document.getElementById('create-account-error');
    if (errorEl) errorEl.style.display = 'none';

    // Store in localStorage if available
    try {
        localStorage.setItem('weathergpt_user', JSON.stringify({ name, email, persona }));
    } catch (_) {}

    // Smoothly proceed to Home screen
    navigateTo('home');
}

function showAuthError(msg) {
    const errorEl = document.getElementById('create-account-error');
    if (errorEl) {
        errorEl.textContent = msg;
        errorEl.style.display = 'block';
    } else {
        alert(msg);
    }
}

// ══════════════════════════════════════════════════════════
//  Page 3 — Login / Sign Up Controller
// ══════════════════════════════════════════════════════════

function switchAuthTab(tab) {
    const loginTabBtn = document.getElementById('tab-btn-login');
    const signupTabBtn = document.getElementById('tab-btn-signup');
    const loginPane = document.getElementById('login-pane');
    const signupPane = document.getElementById('signup-pane');
    const titleEl = document.getElementById('auth-page-title');
    const subtitleEl = document.getElementById('auth-page-subtitle');
    const loginErr = document.getElementById('login-error');
    const signupErr = document.getElementById('signup-error');

    if (loginErr) loginErr.style.display = 'none';
    if (signupErr) signupErr.style.display = 'none';

    if (tab === 'signup') {
        if (loginTabBtn) loginTabBtn.classList.remove('active');
        if (signupTabBtn) signupTabBtn.classList.add('active');
        if (loginPane) loginPane.style.display = 'none';
        if (signupPane) signupPane.style.display = 'block';
        if (titleEl) titleEl.textContent = 'Create Your Account';
        if (subtitleEl) subtitleEl.textContent = 'Sign up to receive personalized AI weather advisories and disaster alerts.';

        // Pre-fill existing name/email if user entered them on Page 2
        try {
            const saved = localStorage.getItem('weathergpt_user');
            if (saved) {
                const u = JSON.parse(saved);
                const sName = document.getElementById('signup-name');
                const sEmail = document.getElementById('signup-email');
                if (sName && !sName.value && u.name) sName.value = u.name;
                if (sEmail && !sEmail.value && u.email) sEmail.value = u.email;
            }
        } catch (_) {}
    } else {
        if (loginTabBtn) loginTabBtn.classList.add('active');
        if (signupTabBtn) signupTabBtn.classList.remove('active');
        if (loginPane) loginPane.style.display = 'block';
        if (signupPane) signupPane.style.display = 'none';
        if (titleEl) titleEl.textContent = 'Welcome Back';
        if (subtitleEl) subtitleEl.textContent = 'Log in to access your personalized weather forecasts, AI advisories, and disaster alerts.';
    }
}

function fillDemoCredentials() {
    const emailInput = document.getElementById('login-email');
    const pwdInput = document.getElementById('login-password');
    if (emailInput) emailInput.value = 'demo@weathergpt.com';
    if (pwdInput) pwdInput.value = 'weather123';
    const errorEl = document.getElementById('login-error');
    if (errorEl) errorEl.style.display = 'none';
}

function handleForgotPassword(e) {
    e.preventDefault();
    const emailInput = document.getElementById('login-email');
    const email = emailInput ? emailInput.value.trim() : '';
    if (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        alert(`Demo Notice: Password reset instructions have been simulated for ${email}.`);
    } else {
        alert('Demo Notice: Please enter your email address to receive password reset instructions.');
    }
}

function handleLogin(e) {
    e.preventDefault();
    const emailInput = document.getElementById('login-email');
    const pwdInput = document.getElementById('login-password');
    const errorEl = document.getElementById('login-error');
    const submitBtn = document.getElementById('login-submit-btn');

    const email = emailInput ? emailInput.value.trim() : '';
    const pwd = pwdInput ? pwdInput.value : '';

    // Validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
        showLoginError('Please enter a valid email address.');
        return;
    }

    if (!pwd || pwd.trim().length === 0) {
        showLoginError('Please enter your password.');
        return;
    }

    if (pwd.length < 6) {
        showLoginError('Password must be at least 6 characters long.');
        return;
    }

    // Clear error
    if (errorEl) errorEl.style.display = 'none';

    // Demo submission loading indicator
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="loading-spinner" style="width:14px;height:14px;border-width:2px;display:inline-block;vertical-align:middle;margin-right:6px"></span> Logging in...';
    }

    setTimeout(() => {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<span>Log In</span>';
        }

        // Restore / set user preferences
        try {
            const saved = localStorage.getItem('weathergpt_user');
            if (saved) {
                const u = JSON.parse(saved);
                if (u && u.name) state.userName = u.name;
                if (u && u.persona) state.chatMode = u.persona;
            } else if (!state.userName) {
                const prefix = email.split('@')[0];
                state.userName = prefix.charAt(0).toUpperCase() + prefix.slice(1);
            }
        } catch (_) {}

        navigateTo('home');
    }, 400);
}

function showLoginError(msg) {
    const errorEl = document.getElementById('login-error');
    if (errorEl) {
        errorEl.textContent = msg;
        errorEl.style.display = 'block';
    } else {
        alert(msg);
    }
}

function handleSignup(e) {
    e.preventDefault();
    const nameInput = document.getElementById('signup-name');
    const emailInput = document.getElementById('signup-email');
    const pwdInput = document.getElementById('signup-password');
    const confirmPwdInput = document.getElementById('signup-confirm-password');
    const errorEl = document.getElementById('signup-error');
    const submitBtn = document.getElementById('signup-submit-btn');

    const name = nameInput ? nameInput.value.trim() : '';
    const email = emailInput ? emailInput.value.trim() : '';
    const pwd = pwdInput ? pwdInput.value : '';
    const confirmPwd = confirmPwdInput ? confirmPwdInput.value : '';

    if (!name || name.length < 2) {
        showSignupError('Please enter your full name (at least 2 characters).');
        return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
        showSignupError('Please enter a valid email address.');
        return;
    }

    if (!pwd || pwd.length < 6) {
        showSignupError('Password must be at least 6 characters long.');
        return;
    }

    if (pwd !== confirmPwd) {
        showSignupError('Passwords do not match. Please verify your password confirmation.');
        return;
    }

    if (errorEl) errorEl.style.display = 'none';

    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="loading-spinner" style="width:14px;height:14px;border-width:2px;display:inline-block;vertical-align:middle;margin-right:6px"></span> Creating Account...';
    }

    setTimeout(() => {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<span>Create Account</span>';
        }

        state.userName = name;
        // Preserve persona if already selected or fallback to current mode
        const persona = state.chatMode || 'citizen';

        try {
            localStorage.setItem('weathergpt_user', JSON.stringify({ name, email, persona }));
        } catch (_) {}

        navigateTo('home');
    }, 400);
}

function showSignupError(msg) {
    const errorEl = document.getElementById('signup-error');
    if (errorEl) {
        errorEl.textContent = msg;
        errorEl.style.display = 'block';
    } else {
        alert(msg);
    }
}

// ══════════════════════════════════════════════════════════
//  Init
// ══════════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {
    initNavigation();

    // Check if user requested a specific screen via URL hash (e.g. #home, #weather, #chat)
    const initialHash = window.location.hash.replace('#', '');
    if (initialHash && SCREENS.includes(initialHash) && initialHash !== 'splash') {
        navigateTo(initialHash);
    } else {
        navigateTo('splash');
        // Automatic short transition from Splash Screen to Create Account Screen
        setTimeout(() => {
            dismissSplash();
        }, 2200);
    }
});

// ══════════════════════════════════════════════════════════
//  ML HAZARD RISK PREDICTOR Screen (Page 12)
// ══════════════════════════════════════════════════════════

/**
 * Stores the last successful prediction context so Page 14 can
 * explain it without re-calling /api/predict.
 * Set by submitPrediction() after a successful predictRisk() call.
 * Read by renderExplainScreen() on Page 14.
 * @type {{ features: Object, result: Object } | null}
 */
let lastPredictionContext = null;

/**
 * Render the ML Risk Predictor screen.
 * Auto-fills fields from live weather if available, otherwise shows blank form.
 */
async function renderPredictScreen() {
    const content = document.getElementById('predict-content');
    if (!content) return;

    // Show loading skeleton
    content.innerHTML = `
        <div class="loading-state">
            <div class="loading-spinner"></div>
            <p style="color:#636E72;font-size:14px">Loading predictor…</p>
        </div>`;

    // Try to get live weather to pre-fill the form
    let w = state.weatherCache;
    if (!w) {
        try {
            w = await fetchWeatherData();
        } catch (_) {
            w = null;
        }
    }

    // Pre-fill values from weather API where we have a direct mapping;
    // fields without a direct API mapping start at sensible defaults.
    const pre = {
        temperature:      w ? Math.round(w.temperature * 10) / 10 : '',
        humidity:         w ? w.humidity : '',
        rainfall_mm:      '',          // not in weather response — user fills in
        wind_speed_kmh:   w ? w.wind_speed : '',
        rain_probability: w ? w.rain_probability : '',
        cloud_cover:      '',          // not in weather response — user fills in
        visibility_km:    '',          // not in weather response — user fills in
        precipitation_mm: '',          // not in weather response — user fills in
        uv_index:         '',          // not in weather response — user fills in
    };

    const locLabel = w ? `Auto-filled from live weather · ${w.location}` : 'Enter values manually';
    const filledCount = Object.values(pre).filter(v => v !== '').length;

    content.innerHTML = `
        <!-- Header card -->
        <div class="card" style="border:1px solid #E2E8F0; box-shadow:0 4px 12px rgba(0,0,0,0.04)">
            <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:8px">
                <span style="font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.5px; color:#92400E; background:#FEF3C7; padding:3px 10px; border-radius:12px">
                    ML · Random Forest
                </span>
                <span style="font-size:11px; font-weight:600; color:#059669; background:#ECFDF5; padding:3px 10px; border-radius:12px">
                    Live Model
                </span>
            </div>
            <h2 style="font-size:18px; font-weight:700; color:#1A202C; margin-bottom:4px">🌲 Hazard Risk Predictor</h2>
            <p style="font-size:13px; color:#718096; line-height:1.5">
                A 9-feature Random Forest classifier evaluates current weather conditions and returns a Low / Medium / High disaster risk assessment.
            </p>
        </div>

        <!-- Auto-fill status -->
        <div style="background:${w ? '#ECFDF5' : '#FFF7ED'}; border:1px solid ${w ? '#A7F3D0' : '#FED7AA'}; border-radius:12px; padding:12px 14px; margin-bottom:4px; font-size:12px; color:${w ? '#065F46' : '#92400E'}; display:flex; align-items:center; gap:8px">
            <span style="font-size:16px">${w ? '✅' : '⚠️'}</span>
            <span>${locLabel}</span>
        </div>

        <!-- Input form -->
        <div class="card">
            <div class="section-title" style="margin-bottom:14px">Weather Input Features</div>
            <form id="predict-form" onsubmit="submitPrediction(event)">

                <div class="details-grid" style="gap:14px">

                    <div style="display:flex; flex-direction:column; gap:4px">
                        <label style="font-size:12px; font-weight:600; color:#4A5568">🌡️ Temperature (°C)</label>
                        <input type="number" step="0.1" id="p-temperature" value="${pre.temperature}"
                               placeholder="e.g. 32.5" required
                               style="border:1.5px solid #E0E8F0; border-radius:10px; padding:9px 12px; font-size:14px; font-family:inherit; background:#F8FBFF; color:#1A1A2E; outline:none; width:100%; box-sizing:border-box" />
                    </div>

                    <div style="display:flex; flex-direction:column; gap:4px">
                        <label style="font-size:12px; font-weight:600; color:#4A5568">💧 Humidity (%)</label>
                        <input type="number" step="1" min="0" max="100" id="p-humidity" value="${pre.humidity}"
                               placeholder="e.g. 75" required
                               style="border:1.5px solid #E0E8F0; border-radius:10px; padding:9px 12px; font-size:14px; font-family:inherit; background:#F8FBFF; color:#1A1A2E; outline:none; width:100%; box-sizing:border-box" />
                    </div>

                    <div style="display:flex; flex-direction:column; gap:4px">
                        <label style="font-size:12px; font-weight:600; color:#4A5568">🌧️ Rainfall (mm)</label>
                        <input type="number" step="0.1" min="0" id="p-rainfall-mm" value="${pre.rainfall_mm}"
                               placeholder="e.g. 12.0" required
                               style="border:1.5px solid #E0E8F0; border-radius:10px; padding:9px 12px; font-size:14px; font-family:inherit; background:#F8FBFF; color:#1A1A2E; outline:none; width:100%; box-sizing:border-box" />
                    </div>

                    <div style="display:flex; flex-direction:column; gap:4px">
                        <label style="font-size:12px; font-weight:600; color:#4A5568">💨 Wind Speed (km/h)</label>
                        <input type="number" step="0.1" min="0" id="p-wind-speed" value="${pre.wind_speed_kmh}"
                               placeholder="e.g. 18.0" required
                               style="border:1.5px solid #E0E8F0; border-radius:10px; padding:9px 12px; font-size:14px; font-family:inherit; background:#F8FBFF; color:#1A1A2E; outline:none; width:100%; box-sizing:border-box" />
                    </div>

                    <div style="display:flex; flex-direction:column; gap:4px">
                        <label style="font-size:12px; font-weight:600; color:#4A5568">☔ Rain Probability (%)</label>
                        <input type="number" step="1" min="0" max="100" id="p-rain-prob" value="${pre.rain_probability}"
                               placeholder="e.g. 60" required
                               style="border:1.5px solid #E0E8F0; border-radius:10px; padding:9px 12px; font-size:14px; font-family:inherit; background:#F8FBFF; color:#1A1A2E; outline:none; width:100%; box-sizing:border-box" />
                    </div>

                    <div style="display:flex; flex-direction:column; gap:4px">
                        <label style="font-size:12px; font-weight:600; color:#4A5568">☁️ Cloud Cover (%)</label>
                        <input type="number" step="1" min="0" max="100" id="p-cloud-cover" value="${pre.cloud_cover}"
                               placeholder="e.g. 80" required
                               style="border:1.5px solid #E0E8F0; border-radius:10px; padding:9px 12px; font-size:14px; font-family:inherit; background:#F8FBFF; color:#1A1A2E; outline:none; width:100%; box-sizing:border-box" />
                    </div>

                    <div style="display:flex; flex-direction:column; gap:4px">
                        <label style="font-size:12px; font-weight:600; color:#4A5568">👁️ Visibility (km)</label>
                        <input type="number" step="0.1" min="0" id="p-visibility" value="${pre.visibility_km}"
                               placeholder="e.g. 5.0" required
                               style="border:1.5px solid #E0E8F0; border-radius:10px; padding:9px 12px; font-size:14px; font-family:inherit; background:#F8FBFF; color:#1A1A2E; outline:none; width:100%; box-sizing:border-box" />
                    </div>

                    <div style="display:flex; flex-direction:column; gap:4px">
                        <label style="font-size:12px; font-weight:600; color:#4A5568">💦 Precipitation (mm)</label>
                        <input type="number" step="0.1" min="0" id="p-precipitation" value="${pre.precipitation_mm}"
                               placeholder="e.g. 8.5" required
                               style="border:1.5px solid #E0E8F0; border-radius:10px; padding:9px 12px; font-size:14px; font-family:inherit; background:#F8FBFF; color:#1A1A2E; outline:none; width:100%; box-sizing:border-box" />
                    </div>

                    <div style="display:flex; flex-direction:column; gap:4px; grid-column: span 2">
                        <label style="font-size:12px; font-weight:600; color:#4A5568">☀️ UV Index</label>
                        <input type="number" step="0.1" min="0" id="p-uv-index" value="${pre.uv_index}"
                               placeholder="e.g. 7.0" required
                               style="border:1.5px solid #E0E8F0; border-radius:10px; padding:9px 12px; font-size:14px; font-family:inherit; background:#F8FBFF; color:#1A1A2E; outline:none; width:100%; box-sizing:border-box" />
                    </div>
                </div>

                <!-- Error message area -->
                <div id="predict-error"
                     style="display:none; background:#FFEAEA; color:#D63031; padding:10px 14px; border-radius:10px; font-size:13px; font-weight:500; margin-top:14px; border-left:3px solid #D63031">
                </div>

                <!-- Submit button -->
                <button type="submit" id="predict-submit-btn"
                        style="margin-top:16px; width:100%; padding:14px; background:linear-gradient(135deg, #C2410C 0%, #EA580C 100%); color:white; border:none; border-radius:12px; font-size:15px; font-weight:700; font-family:inherit; cursor:pointer; box-shadow:0 4px 14px rgba(194,65,12,0.3); transition:transform 0.15s, box-shadow 0.15s">
                    Run Risk Prediction ➔
                </button>
            </form>
        </div>

        <!-- Result area (populated after submit) -->
        <div id="predict-result"></div>

        <div style="text-align:center; padding:8px 0 20px 0">
            <button onclick="navigateTo('home')" class="retry-btn" style="background:#EDF2F7; color:#4A5568">
                ← Back to Dashboard
            </button>
        </div>
    `;
}

/**
 * Handle the prediction form submit.
 * Reads the 9 input fields, calls POST /api/predict, and renders the result card.
 * @param {Event} e
 */
async function submitPrediction(e) {
    e.preventDefault();

    const get = (id) => parseFloat(document.getElementById(id).value);
    const errorEl  = document.getElementById('predict-error');
    const resultEl = document.getElementById('predict-result');
    const submitBtn = document.getElementById('predict-submit-btn');

    if (errorEl)  errorEl.style.display = 'none';
    if (resultEl) resultEl.innerHTML = '';

    const payload = {
        temperature:      get('p-temperature'),
        humidity:         get('p-humidity'),
        rainfall_mm:      get('p-rainfall-mm'),
        wind_speed_kmh:   get('p-wind-speed'),
        rain_probability: get('p-rain-prob'),
        cloud_cover:      get('p-cloud-cover'),
        visibility_km:    get('p-visibility'),
        precipitation_mm: get('p-precipitation'),
        uv_index:         get('p-uv-index'),
    };

    // Basic NaN guard
    for (const [key, val] of Object.entries(payload)) {
        if (isNaN(val)) {
            if (errorEl) {
                errorEl.textContent = `Invalid value for "${key.replace(/_/g, ' ')}". Please enter a number.`;
                errorEl.style.display = 'block';
            }
            return;
        }
    }

    // Show loading state on button
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="loading-spinner" style="width:14px;height:14px;border-width:2px;display:inline-block;vertical-align:middle;margin-right:8px"></span> Analysing…';
    }

    try {
        const data = await predictRisk(payload);

        // Store context for Page 14 — exact submitted features + result
        // Page 14 reads this; /api/predict is NOT called again there.
        lastPredictionContext = { features: payload, result: data };

        // Determine colours and icon based on risk_level
        const riskConfig = {
            0: { color: '#059669', bg: '#ECFDF5', border: '#6EE7B7', icon: '✅', label: 'Low Risk'    },
            1: { color: '#D97706', bg: '#FFFBEB', border: '#FCD34D', icon: '⚠️', label: 'Medium Risk' },
            2: { color: '#DC2626', bg: '#FEF2F2', border: '#FCA5A5', icon: '🚨', label: 'High Risk'   },
        };
        const cfg = riskConfig[data.risk_level] || riskConfig[0];
        const confidencePct = Math.round(data.confidence * 100);

        if (resultEl) {
            resultEl.innerHTML = `
                <!-- Risk Result Card -->
                <div class="card" style="background:${cfg.bg}; border:2px solid ${cfg.border}; box-shadow:0 4px 16px rgba(0,0,0,0.06)">
                    <div style="display:flex; align-items:center; gap:12px; margin-bottom:12px">
                        <span style="font-size:40px; line-height:1">${cfg.icon}</span>
                        <div>
                            <div style="font-size:22px; font-weight:800; color:${cfg.color}">${data.risk_label} Risk</div>
                            <div style="font-size:12px; color:#6B7280; margin-top:2px">Model confidence: ${confidencePct}%</div>
                        </div>
                    </div>

                    <!-- Confidence bar -->
                    <div style="background:rgba(0,0,0,0.08); border-radius:6px; height:8px; overflow:hidden; margin-bottom:14px">
                        <div style="width:${confidencePct}%; height:100%; background:${cfg.color}; border-radius:6px; transition:width 0.6s ease"></div>
                    </div>

                    <!-- Plain-language message -->
                    <p style="font-size:14px; color:#1F2937; line-height:1.6; margin-bottom:0">
                        ${data.message}
                    </p>
                </div>

                <!-- Disclaimer -->
                <div class="card" style="background:#F8FAFC; border-left:4px solid #94A3B8">
                    <div style="font-size:12px; font-weight:700; color:#64748B; margin-bottom:4px; text-transform:uppercase; letter-spacing:0.5px">⚠️ Model Disclaimer</div>
                    <p style="font-size:12px; color:#64748B; line-height:1.5; margin:0">${data.disclaimer}</p>
                </div>

                <!-- Explain This Prediction -->
                <div class="card" style="background:#FAF5FF; border:1px solid #E9D8FD">
                    <div style="font-weight:700; color:#6B46C1; font-size:14px; margin-bottom:6px; display:flex; align-items:center; gap:6px">
                        <span>🔍</span> Understand This Result
                    </div>
                    <p style="font-size:12px; color:#553C9A; line-height:1.5; margin-bottom:12px">
                        Get a plain-language explanation of what these weather values mean and why the model returned this risk level.
                    </p>
                    <button onclick="navigateTo('explain')"
                        style="width:100%; background:#805AD5; color:white; border:none; border-radius:10px; padding:12px; font-weight:600; font-size:13px; cursor:pointer; font-family:inherit">
                        🔍 Explain This Prediction ➔
                    </button>
                </div>
            `;

            // Scroll result into view
            resultEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }

    } catch (err) {
        if (errorEl) {
            errorEl.textContent = err.message || 'Unable to run prediction. Please ensure the WeatherGPT backend is running.';
            errorEl.style.display = 'block';
        }
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = 'Run Risk Prediction ➔';
        }
    }
}

// ══════════════════════════════════════════════════════════
//  EMERGENCY INFO Screen (Page 13)
// ══════════════════════════════════════════════════════════

/**
 * Render the Emergency INFO screen.
 * - Fetches live alert severity via existing getAlerts() — no hardcoded risk.
 * - Emergency numbers are static India national numbers (publicly known).
 * - Nearby locations use Google Maps deep-links with real detected coords.
 * - No fake hospital/relief-center names or distances.
 */
async function renderEmergencyScreen() {
    const content = document.getElementById('emergency-content');
    if (!content) return;

    // Show loading state immediately
    content.innerHTML = `
        <div class="loading-state">
            <div class="loading-spinner"></div>
            <p style="color:#636E72;font-size:14px">Checking current risk level…</p>
        </div>`;

    // ── 1. Fetch live alert data (reuses existing getAlerts + state coords) ──
    let alertData = null;
    let alertFetchError = false;
    try {
        alertData = await getAlerts(state.latitude, state.longitude);
    } catch (_) {
        alertFetchError = true;
    }

    // ── 2. Derive risk display values from real alert response ──────────────
    let riskLabel, riskColor, riskBg, riskBorder, riskIcon, riskDetail;

    if (alertFetchError) {
        riskLabel  = 'Unknown';
        riskColor  = '#64748B';
        riskBg     = '#F8FAFC';
        riskBorder = '#CBD5E1';
        riskIcon   = '❓';
        riskDetail = 'Could not retrieve current alert data. Please ensure the WeatherGPT backend is running.';
    } else if (!alertData.has_alert) {
        riskLabel  = 'Low';
        riskColor  = '#059669';
        riskBg     = '#ECFDF5';
        riskBorder = '#6EE7B7';
        riskIcon   = '✅';
        riskDetail = 'No active weather alert for your location. Conditions are normal.';
    } else {
        const sev = alertData.severity || 'low';
        if (sev === 'high') {
            riskLabel  = 'High';
            riskColor  = '#DC2626';
            riskBg     = '#FEF2F2';
            riskBorder = '#FCA5A5';
            riskIcon   = '🚨';
        } else if (sev === 'medium') {
            riskLabel  = 'Medium';
            riskColor  = '#D97706';
            riskBg     = '#FFFBEB';
            riskBorder = '#FCD34D';
            riskIcon   = '⚠️';
        } else {
            riskLabel  = 'Low';
            riskColor  = '#059669';
            riskBg     = '#ECFDF5';
            riskBorder = '#6EE7B7';
            riskIcon   = '✅';
        }
        const alertType = alertData.type
            ? alertData.type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
            : 'Weather Alert';
        riskDetail = `${alertType}${alertData.message ? ' — ' + alertData.message : ''}`;
    }

    // ── 3. Build Google Maps deep-link URLs using real detected coordinates ──
    const lat = state.latitude;
    const lon = state.longitude;
    const mapsHospitalUrl  = `https://www.google.com/maps/search/hospital/@${lat},${lon},14z`;
    const mapsReliefUrl    = `https://www.google.com/maps/search/relief+center+disaster+shelter/@${lat},${lon},14z`;
    const locationKnown    = !(lat === 28.6139 && lon === 77.2090);   // false = fell back to New Delhi default
    const locationLabel    = locationKnown
        ? `${lat.toFixed(4)}°N, ${lon.toFixed(4)}°E`
        : `Default — New Delhi (${lat.toFixed(4)}, ${lon.toFixed(4)})`;
    const locationNote     = locationKnown
        ? 'Using your detected GPS location.'
        : 'GPS unavailable — using default location (New Delhi). Searches may not reflect your actual surroundings.';

    // ── 4. Render full page ──────────────────────────────────────────────────
    content.innerHTML = `

        <!-- Current Risk Card -->
        <div class="card" style="background:${riskBg}; border:2px solid ${riskBorder}; box-shadow:0 4px 16px rgba(0,0,0,0.05)">
            <div style="font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.6px; color:${riskColor}; margin-bottom:10px">
                Current Risk Level
            </div>
            <div style="display:flex; align-items:center; gap:14px; margin-bottom:10px">
                <span style="font-size:42px; line-height:1">${riskIcon}</span>
                <div>
                    <div style="font-size:26px; font-weight:800; color:${riskColor}; line-height:1.1">${riskLabel}</div>
                    <div style="font-size:11px; color:#64748B; margin-top:3px">Live via WeatherGPT Alerts API</div>
                </div>
            </div>
            <p style="font-size:13px; color:#374151; line-height:1.5; margin:0">${riskDetail}</p>
            ${alertFetchError ? `
            <button onclick="renderEmergencyScreen()" class="retry-btn" style="margin-top:12px; font-size:13px">
                🔄 Retry
            </button>` : ''}
        </div>

        <!-- Emergency Numbers -->
        <div class="card">
            <div class="section-title" style="margin-bottom:14px">📞 Emergency Numbers</div>
            <div style="display:flex; flex-direction:column; gap:10px">

                <div style="display:flex; align-items:center; justify-content:space-between; background:#FFF1F2; border:1px solid #FECDD3; border-radius:12px; padding:14px 16px">
                    <div style="display:flex; align-items:center; gap:10px">
                        <span style="font-size:22px">🚔</span>
                        <div>
                            <div style="font-size:14px; font-weight:700; color:#1A1A2E">Police</div>
                            <div style="font-size:11px; color:#636E72">National emergency</div>
                        </div>
                    </div>
                    <a href="tel:100"
                       style="background:#DC2626; color:white; text-decoration:none; font-size:18px; font-weight:800; padding:8px 18px; border-radius:10px; letter-spacing:1px">
                        100
                    </a>
                </div>

                <div style="display:flex; align-items:center; justify-content:space-between; background:#FFF7ED; border:1px solid #FED7AA; border-radius:12px; padding:14px 16px">
                    <div style="display:flex; align-items:center; gap:10px">
                        <span style="font-size:22px">🚒</span>
                        <div>
                            <div style="font-size:14px; font-weight:700; color:#1A1A2E">Fire Brigade</div>
                            <div style="font-size:11px; color:#636E72">Fire emergency</div>
                        </div>
                    </div>
                    <a href="tel:101"
                       style="background:#EA580C; color:white; text-decoration:none; font-size:18px; font-weight:800; padding:8px 18px; border-radius:10px; letter-spacing:1px">
                        101
                    </a>
                </div>

                <div style="display:flex; align-items:center; justify-content:space-between; background:#F0FDF4; border:1px solid #BBF7D0; border-radius:12px; padding:14px 16px">
                    <div style="display:flex; align-items:center; gap:10px">
                        <span style="font-size:22px">🚑</span>
                        <div>
                            <div style="font-size:14px; font-weight:700; color:#1A1A2E">Ambulance</div>
                            <div style="font-size:11px; color:#636E72">Medical emergency</div>
                        </div>
                    </div>
                    <a href="tel:102"
                       style="background:#059669; color:white; text-decoration:none; font-size:18px; font-weight:800; padding:8px 18px; border-radius:10px; letter-spacing:1px">
                        102
                    </a>
                </div>

                <div style="display:flex; align-items:center; justify-content:space-between; background:#EFF6FF; border:1px solid #BFDBFE; border-radius:12px; padding:14px 16px">
                    <div style="display:flex; align-items:center; gap:10px">
                        <span style="font-size:22px">🆘</span>
                        <div>
                            <div style="font-size:14px; font-weight:700; color:#1A1A2E">Disaster Helpline</div>
                            <div style="font-size:11px; color:#636E72">NDMA national helpline</div>
                        </div>
                    </div>
                    <a href="tel:1078"
                       style="background:#1D4ED8; color:white; text-decoration:none; font-size:18px; font-weight:800; padding:8px 18px; border-radius:10px; letter-spacing:1px">
                        1078
                    </a>
                </div>

            </div>
        </div>

        <!-- Nearby Safe Locations -->
        <div class="card">
            <div class="section-title" style="margin-bottom:6px">📍 Nearby Safe Locations</div>
            <p style="font-size:12px; color:#64748B; margin-bottom:4px; line-height:1.5">${locationNote}</p>
            <div style="font-size:11px; font-weight:600; color:#94A3B8; background:#F8FAFC; border-radius:8px; padding:6px 10px; margin-bottom:14px; font-family:monospace">
                ${locationLabel}
            </div>

            <!-- Honest notice: no integrated POI database -->
            <div style="background:#FFF7ED; border-left:4px solid #F59E0B; border-radius:10px; padding:10px 14px; margin-bottom:14px; font-size:12px; color:#92400E; line-height:1.5">
                <strong>ℹ️ Note:</strong> WeatherGPT does not yet have an integrated hospital or relief-center database. The buttons below open Google Maps with your detected coordinates so you can find real nearby locations.
            </div>

            <div style="display:flex; flex-direction:column; gap:10px">

                <a href="${mapsHospitalUrl}" target="_blank" rel="noopener noreferrer"
                   style="display:flex; align-items:center; justify-content:space-between; background:#F0FDF4; border:1px solid #BBF7D0; border-radius:12px; padding:14px 16px; text-decoration:none">
                    <div style="display:flex; align-items:center; gap:10px">
                        <span style="font-size:24px">🏥</span>
                        <div>
                            <div style="font-size:14px; font-weight:700; color:#1A1A2E">Find Nearest Hospital</div>
                            <div style="font-size:11px; color:#636E72">Opens Google Maps near you</div>
                        </div>
                    </div>
                    <span style="font-size:18px; color:#059669">↗</span>
                </a>

                <a href="${mapsReliefUrl}" target="_blank" rel="noopener noreferrer"
                   style="display:flex; align-items:center; justify-content:space-between; background:#EFF6FF; border:1px solid #BFDBFE; border-radius:12px; padding:14px 16px; text-decoration:none">
                    <div style="display:flex; align-items:center; gap:10px">
                        <span style="font-size:24px">🏕️</span>
                        <div>
                            <div style="font-size:14px; font-weight:700; color:#1A1A2E">Find Relief Center</div>
                            <div style="font-size:11px; color:#636E72">Opens Google Maps near you</div>
                        </div>
                    </div>
                    <span style="font-size:18px; color:#1D4ED8">↗</span>
                </a>

            </div>
        </div>

        <!-- Share Location -->
        <div class="card">
            <div class="section-title" style="margin-bottom:6px">📤 Share My Location</div>
            <p style="font-size:13px; color:#636E72; line-height:1.5; margin-bottom:14px">
                Share your current coordinates and a Google Maps link with emergency contacts or rescue teams.
            </p>
            <button onclick="shareLocation()"
                    style="width:100%; padding:14px; background:linear-gradient(135deg, #BE123C 0%, #DC2626 100%); color:white; border:none; border-radius:12px; font-size:15px; font-weight:700; font-family:inherit; cursor:pointer; box-shadow:0 4px 14px rgba(190,18,60,0.3); transition:transform 0.15s">
                📤 Share My Location
            </button>
            <div id="share-status" style="display:none; margin-top:10px; padding:10px 14px; border-radius:10px; font-size:13px; text-align:center"></div>
        </div>

        <div style="text-align:center; padding:8px 0 20px 0">
            <button onclick="navigateTo('home')" class="retry-btn" style="background:#EDF2F7; color:#4A5568">
                ← Back to Dashboard
            </button>
        </div>
    `;
}

/**
 * Share the user's current location via Web Share API (mobile),
 * clipboard fallback (desktop), or plain text display (last resort).
 * Does NOT expose any API key or private data.
 */
async function shareLocation() {
    const lat = state.latitude;
    const lon = state.longitude;
    const mapsUrl = `https://maps.google.com/?q=${lat},${lon}`;
    const shareText = `🚨 My current location:\nLat: ${lat.toFixed(5)}, Lon: ${lon.toFixed(5)}\nGoogle Maps: ${mapsUrl}`;

    const statusEl = document.getElementById('share-status');

    function showShareStatus(msg, ok) {
        if (!statusEl) return;
        statusEl.textContent = msg;
        statusEl.style.display = 'block';
        statusEl.style.background = ok ? '#ECFDF5' : '#FEF3C7';
        statusEl.style.color = ok ? '#065F46' : '#92400E';
        statusEl.style.border = `1px solid ${ok ? '#6EE7B7' : '#FCD34D'}`;
    }

    // Preferred: native Web Share API (works on mobile browsers)
    if (navigator.share) {
        try {
            await navigator.share({
                title: '🚨 My Emergency Location — WeatherGPT',
                text: shareText,
                url: mapsUrl,
            });
            showShareStatus('✅ Location shared successfully.', true);
            return;
        } catch (err) {
            if (err.name === 'AbortError') {
                // User cancelled — no error needed
                return;
            }
            // Fall through to clipboard fallback
        }
    }

    // Fallback: clipboard copy
    if (navigator.clipboard && navigator.clipboard.writeText) {
        try {
            await navigator.clipboard.writeText(shareText);
            showShareStatus('📋 Location copied to clipboard! Paste it into a message to share.', true);
            return;
        } catch (_) {
            // Fall through to last-resort display
        }
    }

    // Last resort: display the text for manual copy
    showShareStatus(`📍 Copy this manually:\n${shareText}`, false);
}

// ══════════════════════════════════════════════════════════
//  EXPLAIN PREDICTION Screen (Page 14)
// ══════════════════════════════════════════════════════════

/**
 * Derive Key Factors from the actual submitted feature values.
 * Only shows factors whose threshold is genuinely met.
 * Never shows Low Pressure System or Monsoon Activity — not in backend data.
 * @param {Object} f - the features object from lastPredictionContext
 * @returns {Array<{icon:string, label:string, value:string}>}
 */
function deriveExplainFactors(f) {
    const factors = [];

    if (f.rain_probability >= 80)
        factors.push({ icon: '☔', label: 'Very High Rain Probability', value: `${f.rain_probability}%` });
    else if (f.rain_probability >= 50)
        factors.push({ icon: '🌧️', label: 'High Rain Probability', value: `${f.rain_probability}%` });

    if (f.rainfall_mm >= 30)
        factors.push({ icon: '🌧️', label: 'Heavy Rainfall', value: `${f.rainfall_mm} mm` });
    else if (f.rainfall_mm >= 10)
        factors.push({ icon: '🌦️', label: 'Moderate Rainfall', value: `${f.rainfall_mm} mm` });

    if (f.humidity >= 85)
        factors.push({ icon: '💧', label: 'Very High Humidity', value: `${f.humidity}%` });
    else if (f.humidity >= 70)
        factors.push({ icon: '💧', label: 'High Humidity', value: `${f.humidity}%` });

    if (f.wind_speed_kmh >= 60)
        factors.push({ icon: '💨', label: 'Gale-Force Winds', value: `${f.wind_speed_kmh} km/h` });
    else if (f.wind_speed_kmh >= 40)
        factors.push({ icon: '💨', label: 'Strong Winds', value: `${f.wind_speed_kmh} km/h` });

    if (f.temperature >= 42)
        factors.push({ icon: '🌡️', label: 'Extreme Heat', value: `${f.temperature}°C` });
    else if (f.temperature >= 38)
        factors.push({ icon: '🌡️', label: 'Very High Temperature', value: `${f.temperature}°C` });

    if (f.temperature <= 5)
        factors.push({ icon: '🥶', label: 'Cold Conditions', value: `${f.temperature}°C` });
    else if (f.temperature <= 10)
        factors.push({ icon: '🥶', label: 'Cool Conditions', value: `${f.temperature}°C` });

    if (f.precipitation_mm >= 20)
        factors.push({ icon: '💦', label: 'Heavy Precipitation', value: `${f.precipitation_mm} mm` });
    else if (f.precipitation_mm >= 10)
        factors.push({ icon: '💦', label: 'Moderate Precipitation', value: `${f.precipitation_mm} mm` });

    if (f.cloud_cover >= 88)
        factors.push({ icon: '☁️', label: 'Complete Cloud Cover', value: `${f.cloud_cover}%` });
    else if (f.cloud_cover >= 75)
        factors.push({ icon: '☁️', label: 'Dense Cloud Cover', value: `${f.cloud_cover}%` });

    if (f.visibility_km <= 1.5)
        factors.push({ icon: '👁️', label: 'Very Low Visibility', value: `${f.visibility_km} km` });
    else if (f.visibility_km <= 3)
        factors.push({ icon: '👁️', label: 'Reduced Visibility', value: `${f.visibility_km} km` });

    if (f.uv_index <= 1.5)
        factors.push({ icon: '🌑', label: 'Low UV / Storm Light Conditions', value: `UV ${f.uv_index}` });

    return factors;
}

/**
 * Render the Explain Prediction screen (Page 14).
 *
 * Reads lastPredictionContext — set by submitPrediction() on Page 12.
 * Does NOT call /api/predict again.
 * Sends a structured question to /api/chat (existing endpoint) for AI explanation.
 * The AI is explicitly told it is interpreting the ML result, not producing its own forecast.
 */
async function renderExplainScreen() {
    const content = document.getElementById('explain-content');
    if (!content) return;

    // ── No-context state: user navigated here without running a prediction ──
    if (!lastPredictionContext) {
        content.innerHTML = `
            <div class="card" style="text-align:center; padding:32px 20px">
                <div style="font-size:48px; margin-bottom:16px">🔍</div>
                <h2 style="font-size:18px; font-weight:700; color:#1A202C; margin-bottom:8px">No Prediction to Explain</h2>
                <p style="font-size:13px; color:#718096; line-height:1.5; margin-bottom:20px">
                    Run a prediction on the ML Risk Predictor first, then tap
                    "Explain This Prediction" to see a detailed explanation here.
                </p>
                <button onclick="navigateTo('predict')"
                    style="background:linear-gradient(135deg, #C2410C 0%, #EA580C 100%); color:white; border:none; border-radius:12px; padding:12px 28px; font-size:14px; font-weight:700; font-family:inherit; cursor:pointer">
                    🌲 Run a Prediction First ➔
                </button>
            </div>`;
        return;
    }

    const { features: f, result: r } = lastPredictionContext;
    const confidencePct = Math.round(r.confidence * 100);

    // Risk colour config — same mapping as Page 12
    const riskConfig = {
        0: { color: '#059669', bg: '#ECFDF5', border: '#6EE7B7', icon: '✅' },
        1: { color: '#D97706', bg: '#FFFBEB', border: '#FCD34D', icon: '⚠️' },
        2: { color: '#DC2626', bg: '#FEF2F2', border: '#FCA5A5', icon: '🚨' },
    };
    const cfg = riskConfig[r.risk_level] || riskConfig[0];

    // Derive Key Factors from actual submitted values
    const factors = deriveExplainFactors(f);

    // ── Show loading state with prediction summary already visible ──────────
    content.innerHTML = `

        <!-- Prediction Summary Badge -->
        <div class="card" style="background:${cfg.bg}; border:2px solid ${cfg.border}">
            <div style="font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.6px; color:${cfg.color}; margin-bottom:8px">
                ML Prediction Result Being Explained
            </div>
            <div style="display:flex; align-items:center; gap:12px; margin-bottom:10px">
                <span style="font-size:36px">${cfg.icon}</span>
                <div>
                    <div style="font-size:22px; font-weight:800; color:${cfg.color}">${r.risk_label} Risk</div>
                    <div style="font-size:12px; color:#6B7280; margin-top:2px">Model confidence: ${confidencePct}%</div>
                </div>
            </div>
            <div style="background:rgba(0,0,0,0.08); border-radius:6px; height:6px; overflow:hidden">
                <div style="width:${confidencePct}%; height:100%; background:${cfg.color}; border-radius:6px"></div>
            </div>
        </div>

        <!-- AI Explanation (loading) -->
        <div class="card" id="explain-ai-card">
            <div style="font-size:13px; font-weight:700; color:#6B46C1; margin-bottom:12px; display:flex; align-items:center; gap:6px">
                <span>🤖</span> AI Explanation
            </div>
            <div class="loading-state" style="padding:20px 0">
                <div class="loading-spinner"></div>
                <p style="color:#636E72;font-size:13px;margin-top:8px">Generating explanation…</p>
            </div>
        </div>

        <!-- Key Factors from actual submitted values -->
        <div class="card">
            <div class="section-title" style="margin-bottom:12px">📊 Key Factors from Your Input</div>
            ${factors.length > 0
                ? `<div style="display:flex; flex-direction:column; gap:8px" id="explain-factors">
                    ${factors.map(fc => `
                        <div style="display:flex; align-items:center; justify-content:space-between; background:#F8FBFF; border:1px solid #E2E8F0; border-radius:10px; padding:10px 14px">
                            <div style="display:flex; align-items:center; gap:8px; font-size:13px; color:#1A202C; font-weight:600">
                                <span style="font-size:18px">${fc.icon}</span>
                                ${fc.label}
                            </div>
                            <span style="font-size:13px; font-weight:700; color:${cfg.color}">${fc.value}</span>
                        </div>`
                    ).join('')}
                   </div>`
                : `<div style="background:#ECFDF5; border:1px solid #6EE7B7; border-radius:10px; padding:12px 14px; font-size:13px; color:#065F46; font-weight:600">
                       ✅ All submitted values within normal range — model predicted Low Risk.
                   </div>`
            }
            <p style="font-size:11px; color:#94A3B8; margin-top:10px; line-height:1.4">
                Factors derived from your exact submitted values. Only conditions meeting significance thresholds are shown.
            </p>
        </div>

        <!-- Submitted Feature Values (full table) -->
        <div class="card">
            <div class="section-title" style="margin-bottom:12px">🔢 Submitted Feature Values</div>
            <div class="details-grid">
                <div class="detail-item"><span class="detail-label">🌡️ Temperature</span><span class="detail-value">${f.temperature}°C</span></div>
                <div class="detail-item"><span class="detail-label">💧 Humidity</span><span class="detail-value">${f.humidity}%</span></div>
                <div class="detail-item"><span class="detail-label">🌧️ Rainfall</span><span class="detail-value">${f.rainfall_mm} mm</span></div>
                <div class="detail-item"><span class="detail-label">💨 Wind Speed</span><span class="detail-value">${f.wind_speed_kmh} km/h</span></div>
                <div class="detail-item"><span class="detail-label">☔ Rain Prob.</span><span class="detail-value">${f.rain_probability}%</span></div>
                <div class="detail-item"><span class="detail-label">☁️ Cloud Cover</span><span class="detail-value">${f.cloud_cover}%</span></div>
                <div class="detail-item"><span class="detail-label">👁️ Visibility</span><span class="detail-value">${f.visibility_km} km</span></div>
                <div class="detail-item"><span class="detail-label">💦 Precipitation</span><span class="detail-value">${f.precipitation_mm} mm</span></div>
                <div class="detail-item"><span class="detail-label">☀️ UV Index</span><span class="detail-value">${f.uv_index}</span></div>
            </div>
        </div>

        <!-- Disclaimer -->
        <div class="card" style="background:#F8FAFC; border-left:4px solid #94A3B8">
            <div style="font-size:12px; font-weight:700; color:#64748B; margin-bottom:4px; text-transform:uppercase; letter-spacing:0.5px">⚠️ About This Explanation</div>
            <p style="font-size:12px; color:#64748B; line-height:1.5; margin:0">
                The AI explanation above is a human-readable interpretation of the prediction result and input weather factors.
                It is <strong>not</strong> the Random Forest model's internal reasoning.
                The model's prediction is based on patterns learned from synthetic training data.
                ${r.disclaimer}
            </p>
        </div>

        <!-- Ask AI Chat -->
        <div class="card" style="background:#EBF5FF; border:1px solid #BFDBFE">
            <div style="font-weight:700; color:#1D4ED8; font-size:14px; margin-bottom:6px">🤖 Ask WeatherGPT More</div>
            <p style="font-size:12px; color:#1E40AF; line-height:1.5; margin-bottom:12px">
                Want to know how this risk level affects your farming, travel, or daily plans? Ask the AI Assistant.
            </p>
            <button onclick="navigateTo('chat')"
                style="width:100%; background:#1D4ED8; color:white; border:none; border-radius:10px; padding:12px; font-weight:600; font-size:13px; cursor:pointer; font-family:inherit">
                Ask AI Assistant ➔
            </button>
        </div>

        <div style="text-align:center; padding:8px 0 20px 0">
            <button onclick="navigateTo('predict')" class="retry-btn" style="background:#EDF2F7; color:#4A5568">
                ← Back to Prediction
            </button>
        </div>
    `;

    // ── Now fetch AI explanation asynchronously ─────────────────────────────
    // Build a targeted question from exact feature values and prediction result.
    // Explicitly tells Gemini it is interpreting an ML result, not forecasting.
    const question = (
        `A Random Forest ML model was given these 9 weather feature values and returned a prediction of "${r.risk_label} Risk" with ${confidencePct}% confidence. ` +
        `The submitted values were: Temperature ${f.temperature}°C, Humidity ${f.humidity}%, Rainfall ${f.rainfall_mm} mm, ` +
        `Wind Speed ${f.wind_speed_kmh} km/h, Rain Probability ${f.rain_probability}%, Cloud Cover ${f.cloud_cover}%, ` +
        `Visibility ${f.visibility_km} km, Precipitation ${f.precipitation_mm} mm, UV Index ${f.uv_index}. ` +
        `Please explain in 3 to 4 sentences what these specific input values indicate about the weather conditions, ` +
        `and why this particular combination of factors would lead a machine learning model to predict a ${r.risk_label} risk level. ` +
        `Important: you are providing a human-readable interpretation of the ML model's prediction result and its input features. ` +
        `Do not present this as your own independent weather forecast.`
    );

    const aiCardEl = document.getElementById('explain-ai-card');

    try {
        const chatResult = await sendChatMessage(
            question,
            state.latitude,
            state.longitude,
            state.chatLanguage || 'en',
            'general'
        );

        if (aiCardEl) {
            aiCardEl.innerHTML = `
                <div style="font-size:13px; font-weight:700; color:#6B46C1; margin-bottom:12px; display:flex; align-items:center; gap:6px">
                    <span>🤖</span> AI Explanation
                </div>
                <p style="font-size:14px; color:#1F2937; line-height:1.7; margin:0">
                    ${chatResult.answer.replace(/\n/g, '<br>')}
                </p>`;
        }

    } catch (err) {
        if (aiCardEl) {
            aiCardEl.innerHTML = `
                <div style="font-size:13px; font-weight:700; color:#6B46C1; margin-bottom:8px; display:flex; align-items:center; gap:6px">
                    <span>🤖</span> AI Explanation
                </div>
                <div style="background:#FFF7ED; border-left:3px solid #F59E0B; border-radius:8px; padding:10px 14px; font-size:13px; color:#92400E; line-height:1.5; margin-bottom:12px">
                    AI explanation unavailable. The Key Factors and feature values above are derived directly from your submitted values and remain accurate.
                    <br><small style="opacity:0.8">${err.message || 'Check that the backend and GEMINI_API_KEY are configured.'}</small>
                </div>
                <button onclick="renderExplainScreen()" class="retry-btn" style="font-size:13px">
                    🔄 Retry Explanation
                </button>`;
        }
    }
}

// ══════════════════════════════════════════════════════════
//  DASHBOARD Screen (Page 15)
// ══════════════════════════════════════════════════════════

/**
 * Get a time-aware greeting using the current local hour.
 * @returns {string}
 */
function getDashboardGreeting() {
    const h = new Date().getHours();
    if (h >= 5  && h < 12) return 'Good morning';
    if (h >= 12 && h < 17) return 'Good afternoon';
    if (h >= 17 && h < 21) return 'Good evening';
    return 'Good night';
}

/**
 * Format a forecast date string into a short day label.
 * Today → "Today", otherwise → "Mon", "Tue", etc.
 * @param {string} dateStr  YYYY-MM-DD
 * @returns {string}
 */
function dashboardDayLabel(dateStr) {
    const today = new Date().toISOString().slice(0, 10);
    if (dateStr === today) return 'Today';
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-IN', { weekday: 'short' });
}

/**
 * Render the full Dashboard screen.
 * Uses existing getWeather(), getForecast(), getAlerts(), fetchWeatherData(),
 * getConditionIcon(), state — no new APIs, no fake data.
 */
async function renderDashboardScreen() {
    const content = document.getElementById('dashboard-content');
    if (!content) return;

    // ── Loading state ─────────────────────────────────────
    content.innerHTML = `
        <div class="dashboard-screen">
            <div class="dashboard-header">
                <div class="dashboard-header-top">
                    <div class="dashboard-brand">
                        <span style="color:white">Weather</span><span class="brand-gpt">GPT</span>
                    </div>
                    <button class="dashboard-refresh-btn" onclick="renderDashboardScreen()" aria-label="Refresh">🔄</button>
                </div>
                <div class="dashboard-greeting">Loading…</div>
                <div class="dashboard-location">📍 Detecting location…</div>
            </div>
            <div class="dashboard-body">
                <div class="loading-state" style="padding:40px 0">
                    <div class="loading-spinner"></div>
                    <p style="color:#636E72;font-size:14px;margin-top:10px">Fetching weather…</p>
                </div>
            </div>
        </div>`;

    // ── Fetch data ────────────────────────────────────────
    let w = null, forecastData = null, alertData = null;
    let fetchError = false;

    try {
        w = state.weatherCache ? state.weatherCache : await fetchWeatherData();
        [forecastData, alertData] = await Promise.all([
            getForecast(state.latitude, state.longitude, 7).catch(() => null),
            getAlerts(state.latitude, state.longitude).catch(() => null),
        ]);
    } catch (err) {
        fetchError = true;
    }

    if (fetchError || !w) {
        content.innerHTML = `
            <div class="dashboard-screen">
                <div class="dashboard-header">
                    <div class="dashboard-header-top">
                        <div class="dashboard-brand">
                            <span style="color:white">Weather</span><span class="brand-gpt">GPT</span>
                        </div>
                        <button class="dashboard-refresh-btn" onclick="renderDashboardScreen()">🔄</button>
                    </div>
                    <div class="dashboard-greeting">${getDashboardGreeting()}${state.userName ? ', ' + state.userName + '!' : '!'}</div>
                    <div class="dashboard-location">📍 ${state.locationName}</div>
                </div>
                <div class="dashboard-body">
                    <div class="error-state">
                        <span style="font-size:36px">⚠️</span>
                        <p style="color:#636E72;font-size:14px">Unable to load weather data. Please ensure the backend is running.</p>
                        <button class="retry-btn" onclick="renderDashboardScreen()">Try Again</button>
                    </div>
                </div>
            </div>`;
        return;
    }

    // ── Derived display values ────────────────────────────
    const greeting   = getDashboardGreeting();
    const userName   = state.userName || 'there';
    const locName    = w.location || state.locationName;
    const condIcon   = getConditionIcon(w.condition, w.is_day ?? 1);
    const tempRound  = Math.round(w.temperature);
    const feelsRound = Math.round(w.feels_like);

    // ── Advisory card config from alert data ─────────────
    let advisoryClass, advisoryIcon, advisoryTitle, advisoryMsg;
    if (!alertData || !alertData.has_alert) {
        advisoryClass = 'advisory-none';
        advisoryIcon  = '✅';
        advisoryTitle = 'All Clear';
        advisoryMsg   = 'No active weather alerts for your location. Conditions look safe.';
    } else {
        const sev = alertData.severity || 'low';
        advisoryClass = `advisory-${sev}`;
        if (sev === 'high')        { advisoryIcon = '🚨'; }
        else if (sev === 'medium') { advisoryIcon = '⚠️'; }
        else                       { advisoryIcon = 'ℹ️'; }
        const alertType = alertData.type
            ? alertData.type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
            : 'Weather Alert';
        advisoryTitle = `${alertType} — ${sev.charAt(0).toUpperCase() + sev.slice(1)} Severity`;
        advisoryMsg   = alertData.message || 'Take appropriate precautions.';
    }

    // ── Forecast strip HTML ──────────────────────────────
    let forecastHTML = '';
    if (forecastData && forecastData.days && forecastData.days.length > 0) {
        forecastHTML = forecastData.days.slice(0, 7).map((day, idx) => {
            const label   = dashboardDayLabel(day.date);
            const icon    = getConditionIcon(day.condition, 1);
            const maxTemp = Math.round(day.max_temp);
            const minTemp = Math.round(day.min_temp);
            const rain    = day.rain_probability;
            const isToday = idx === 0;
            return `
                <div class="dashboard-forecast-card${isToday ? ' today' : ''}">
                    <div class="dashboard-forecast-day">${label}</div>
                    <div class="dashboard-forecast-icon">${icon}</div>
                    <div class="dashboard-forecast-temp">${maxTemp}°<span style="opacity:0.6;font-size:11px">/${minTemp}°</span></div>
                    <div class="dashboard-forecast-rain">💧${rain}%</div>
                </div>`;
        }).join('');
    } else {
        forecastHTML = `<p style="color:#94A3B8;font-size:13px;padding:12px 0">Forecast unavailable.</p>`;
    }

    // ── Render full dashboard ────────────────────────────
    content.innerHTML = `
        <div class="dashboard-screen">

            <!-- Header -->
            <div class="dashboard-header">
                <div class="dashboard-header-top">
                    <div class="dashboard-brand">
                        <span style="color:white">Weather</span><span class="brand-gpt">GPT</span>
                    </div>
                    <button class="dashboard-refresh-btn" onclick="renderDashboardScreen()" aria-label="Refresh">🔄</button>
                </div>
                <div class="dashboard-greeting">${greeting}, ${userName}! 👋</div>
                <div class="dashboard-location">📍 ${locName}</div>
            </div>

            <!-- Scrollable body -->
            <div class="dashboard-body">

                <!-- Current Weather Card -->
                <div class="dashboard-weather-card">
                    <div class="dashboard-weather-main">
                        <div class="dashboard-temp-block">
                            <div class="dashboard-temp">${tempRound}°</div>
                            <div class="dashboard-condition">${w.condition}</div>
                            <div class="dashboard-feels">Feels like ${feelsRound}°C</div>
                        </div>
                        <div class="dashboard-weather-icon">${condIcon}</div>
                    </div>
                    <div class="dashboard-weather-details">
                        <div class="dashboard-detail-item">
                            <span class="dashboard-detail-icon">💧</span>
                            <div class="dashboard-detail-info">
                                <span class="dashboard-detail-label">Humidity</span>
                                <span class="dashboard-detail-value">${w.humidity}%</span>
                            </div>
                        </div>
                        <div class="dashboard-detail-item">
                            <span class="dashboard-detail-icon">💨</span>
                            <div class="dashboard-detail-info">
                                <span class="dashboard-detail-label">Wind</span>
                                <span class="dashboard-detail-value">${w.wind_speed} km/h</span>
                            </div>
                        </div>
                        <div class="dashboard-detail-item">
                            <span class="dashboard-detail-icon">🌧️</span>
                            <div class="dashboard-detail-info">
                                <span class="dashboard-detail-label">Rain Chance</span>
                                <span class="dashboard-detail-value">${w.rain_probability}%</span>
                            </div>
                        </div>
                        <div class="dashboard-detail-item">
                            <span class="dashboard-detail-icon">🌡️</span>
                            <div class="dashboard-detail-info">
                                <span class="dashboard-detail-label">Feels Like</span>
                                <span class="dashboard-detail-value">${feelsRound}°C</span>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Weather Advisory / Risk Card -->
                <div class="dashboard-advisory ${advisoryClass}">
                    <div class="dashboard-advisory-icon">${advisoryIcon}</div>
                    <div class="dashboard-advisory-content">
                        <div class="dashboard-advisory-title">${advisoryTitle}</div>
                        <div class="dashboard-advisory-msg">${advisoryMsg}</div>
                    </div>
                </div>

                <!-- 7-Day Forecast Strip -->
                <div>
                    <div class="dashboard-forecast-header">
                        <span class="dashboard-forecast-title">7-Day Forecast</span>
                        <button class="dashboard-forecast-viewall" onclick="navigateTo('forecast')">View All →</button>
                    </div>
                    <div class="dashboard-forecast-strip">
                        ${forecastHTML}
                    </div>
                </div>

                <!-- Quick Actions -->
                <div>
                    <div class="dashboard-section-label" style="margin-bottom:10px">Quick Actions</div>
                    <div class="dashboard-actions-grid">
                        <button class="dashboard-action-btn" onclick="navigateTo('chat')">
                            <span class="dashboard-action-icon">🤖</span>
                            <span class="dashboard-action-label">AI Assistant</span>
                            <span class="dashboard-action-sub">Ask anything</span>
                        </button>
                        <button class="dashboard-action-btn" onclick="navigateTo('alerts')">
                            <span class="dashboard-action-icon">🚨</span>
                            <span class="dashboard-action-label">Alerts</span>
                            <span class="dashboard-action-sub">Live warnings</span>
                        </button>
                        <button class="dashboard-action-btn" onclick="navigateTo('predict')">
                            <span class="dashboard-action-icon">🌲</span>
                            <span class="dashboard-action-label">Risk Predictor</span>
                            <span class="dashboard-action-sub">ML model</span>
                        </button>
                        <button class="dashboard-action-btn" onclick="navigateTo('climate')">
                            <span class="dashboard-action-icon">📊</span>
                            <span class="dashboard-action-label">Climate</span>
                            <span class="dashboard-action-sub">Historical data</span>
                        </button>
                        <button class="dashboard-action-btn" onclick="navigateTo('safe-route')">
                            <span class="dashboard-action-icon">🗺️</span>
                            <span class="dashboard-action-label">Safe Route</span>
                            <span class="dashboard-action-sub">Travel advisory</span>
                        </button>
                        <button class="dashboard-action-btn" onclick="navigateTo('emergency')">
                            <span class="dashboard-action-icon">🆘</span>
                            <span class="dashboard-action-label">Emergency</span>
                            <span class="dashboard-action-sub">Contacts & map</span>
                        </button>
                        <button class="dashboard-action-btn" onclick="navigateTo('weather')">
                            <span class="dashboard-action-icon">🌡️</span>
                            <span class="dashboard-action-label">Live Weather</span>
                            <span class="dashboard-action-sub">Full details</span>
                        </button>
                        <button class="dashboard-action-btn" onclick="navigateTo('home')">
                            <span class="dashboard-action-icon">🏠</span>
                            <span class="dashboard-action-label">Home</span>
                            <span class="dashboard-action-sub">Classic view</span>
                        </button>
                        <button class="dashboard-action-btn" onclick="navigateTo('profile')">
                            <span class="dashboard-action-icon">👤</span>
                            <span class="dashboard-action-label">Profile</span>
                            <span class="dashboard-action-sub">Settings & info</span>
                        </button>
                    </div>
                </div>

            </div><!-- /.dashboard-body -->
        </div><!-- /.dashboard-screen -->
    `;
}

// ══════════════════════════════════════════════════════════
//  PROFILE / SETTINGS Screen (Page 16 — FINAL PAGE)
// ══════════════════════════════════════════════════════════

/**
 * Load profile settings from localStorage.
 * Returns a settings object with defaults for any missing keys.
 * @returns {Object}
 */
function loadProfileSettings() {
    const defaults = {
        tempUnit: 'C',          // 'C' | 'F'
        notificationsOn: true,
        alertRain: true,
        alertFlood: true,
        alertSevere: true,
    };
    try {
        const saved = localStorage.getItem('weathergpt_settings');
        if (saved) {
            return Object.assign({}, defaults, JSON.parse(saved));
        }
    } catch (_) {}
    return defaults;
}

/**
 * Persist profile settings to localStorage.
 * @param {Object} settings
 */
function saveProfileSettings(settings) {
    try {
        localStorage.setItem('weathergpt_settings', JSON.stringify(settings));
    } catch (_) {}
}

/**
 * Convert Celsius to Fahrenheit for display when unit = 'F'.
 * Does NOT alter backend values — frontend-only conversion.
 * @param {number} c - temperature in Celsius
 * @param {string} unit - 'C' or 'F'
 * @returns {string}
 */
function formatTempUnit(c, unit) {
    if (unit === 'F') return `${Math.round(c * 9 / 5 + 32)}°F`;
    return `${Math.round(c)}°C`;
}

/**
 * Render the Profile / Settings screen (Page 16).
 * Reads user data from state + localStorage.
 * All settings are stored frontend-only in localStorage('weathergpt_settings').
 * No backend changes. No fake user data.
 */
function renderProfileScreen() {
    const content = document.getElementById('profile-content');
    if (!content) return;

    // ── Load user data from state + localStorage ──────────
    let savedUser = {};
    try {
        const raw = localStorage.getItem('weathergpt_user');
        if (raw) savedUser = JSON.parse(raw);
    } catch (_) {}

    const userName  = state.userName || savedUser.name || 'WeatherGPT User';
    const userEmail = savedUser.email || 'guest@weathergpt.com';
    const persona   = savedUser.persona || state.chatMode || 'general';
    const locName   = state.locationName || 'Location not set';
    const lat       = state.latitude.toFixed(4);
    const lon       = state.longitude.toFixed(4);

    // Persona display label
    const personaLabels = {
        citizen:   '🚶 Citizen',
        farmer:    '🌾 Farmer',
        traveller: '🚗 Traveller',
        general:   '💼 Professional',
    };
    const personaLabel = personaLabels[persona] || '💼 Professional';

    // User initials for avatar
    const initials = userName
        .split(' ')
        .map(w => w[0] || '')
        .slice(0, 2)
        .join('')
        .toUpperCase() || '?';

    // ── Load settings ─────────────────────────────────────
    const settings = loadProfileSettings();

    // Helper to render a checked toggle
    const tog = (id, checked) => `
        <label class="profile-toggle" aria-label="${id}">
            <input type="checkbox" id="${id}" ${checked ? 'checked' : ''}
                   onchange="onProfileToggle('${id}', this.checked)">
            <span class="profile-toggle-slider"></span>
        </label>`;

    // Helper to render unit pill
    const pill = (unit, label) =>
        `<button class="profile-unit-pill${settings.tempUnit === unit ? ' active' : ''}"
                 onclick="onTempUnit('${unit}')">${label}</button>`;

    // ── Render ────────────────────────────────────────────
    content.innerHTML = `
        <div class="profile-screen">

            <!-- Header -->
            <div class="profile-header-card">
                <div class="profile-top-bar">
                    <button class="profile-back-btn" onclick="history.back()" aria-label="Back">←</button>
                    <span class="profile-title-text">Profile & Settings</span>
                    <div style="width:38px"></div>
                </div>

                <div class="profile-avatar">${initials}</div>
                <div class="profile-name">${userName}</div>
                <div class="profile-email">${userEmail}</div>
                <div class="profile-persona-badge">${personaLabel}</div>
            </div>

            <!-- Body -->
            <div class="profile-body">

                <!-- Location Settings -->
                <div class="profile-card">
                    <div class="profile-card-title">Location</div>
                    <div class="profile-row">
                        <div class="profile-row-left">
                            <div class="profile-row-icon">📍</div>
                            <div class="profile-row-info">
                                <span class="profile-row-label">${locName}</span>
                                <span class="profile-row-sub">${lat}°N, ${lon}°E · auto-detected</span>
                            </div>
                        </div>
                        <button onclick="refreshLocation()"
                            style="background:#EBF5FF; border:none; border-radius:10px; padding:6px 14px; font-size:12px; font-weight:600; color:#2E86DE; cursor:pointer; font-family:inherit; flex-shrink:0">
                            Refresh
                        </button>
                    </div>
                </div>

                <!-- Weather Alert Preferences -->
                <div class="profile-card">
                    <div class="profile-card-title">Weather Alert Preferences</div>
                    <div class="profile-row">
                        <div class="profile-row-left">
                            <div class="profile-row-icon">🌧️</div>
                            <div class="profile-row-info">
                                <span class="profile-row-label">Rain Alerts</span>
                                <span class="profile-row-sub">Heavy rain & drizzle warnings</span>
                            </div>
                        </div>
                        ${tog('pref-rain', settings.alertRain)}
                    </div>
                    <div class="profile-row">
                        <div class="profile-row-left">
                            <div class="profile-row-icon">🌊</div>
                            <div class="profile-row-info">
                                <span class="profile-row-label">Flood Alerts</span>
                                <span class="profile-row-sub">Flash flood & waterlogging</span>
                            </div>
                        </div>
                        ${tog('pref-flood', settings.alertFlood)}
                    </div>
                    <div class="profile-row">
                        <div class="profile-row-left">
                            <div class="profile-row-icon">⛈️</div>
                            <div class="profile-row-info">
                                <span class="profile-row-label">Severe Weather</span>
                                <span class="profile-row-sub">Storms, gales & extreme heat</span>
                            </div>
                        </div>
                        ${tog('pref-severe', settings.alertSevere)}
                    </div>
                </div>

                <!-- Units -->
                <div class="profile-card">
                    <div class="profile-card-title">Units</div>
                    <div class="profile-row">
                        <div class="profile-row-left">
                            <div class="profile-row-icon">🌡️</div>
                            <div class="profile-row-info">
                                <span class="profile-row-label">Temperature Unit</span>
                                <span class="profile-row-sub" id="unit-sub-label">
                                    ${settings.tempUnit === 'F' ? 'Displaying in Fahrenheit' : 'Displaying in Celsius'}
                                </span>
                            </div>
                        </div>
                        <div class="profile-unit-pills">
                            ${pill('C', '°C')}
                            ${pill('F', '°F')}
                        </div>
                    </div>
                    ${state.weatherCache ? `
                    <div style="background:#F0F4FF; border-top:1px solid #E2EDFF; padding:12px 16px; font-size:12px; color:#64748B">
                        Current temperature:
                        <strong style="color:#0F172A">${formatTempUnit(state.weatherCache.temperature, settings.tempUnit)}</strong>
                        · Feels like
                        <strong style="color:#0F172A">${formatTempUnit(state.weatherCache.feels_like, settings.tempUnit)}</strong>
                    </div>` : ''}
                </div>

                <!-- Notifications -->
                <div class="profile-card">
                    <div class="profile-card-title">Notifications</div>
                    <div class="profile-row">
                        <div class="profile-row-left">
                            <div class="profile-row-icon">🔔</div>
                            <div class="profile-row-info">
                                <span class="profile-row-label">Notifications</span>
                                <span class="profile-row-sub">Weather updates and alerts</span>
                            </div>
                        </div>
                        ${tog('pref-notif', settings.notificationsOn)}
                    </div>
                </div>

                <!-- About WeatherGPT -->
                <div class="profile-card">
                    <div class="profile-card-title">About</div>
                    <div class="profile-row" style="flex-direction:column; align-items:center; text-align:center; padding:20px 16px">
                        <div class="profile-about-logo">🌤️</div>
                        <div class="profile-about-name">
                            <span style="color:#1A1A2E">Weather</span><span style="color:#FF4757">GPT</span>
                        </div>
                        <div class="profile-about-tagline">
                            AI-powered weather intelligence platform.<br>
                            Powered by Open-Meteo, WeatherAPI &amp; Google Gemini.
                        </div>
                        <div class="profile-about-version">v0.1.0 — Prototype · SIH26068</div>
                    </div>
                    <div class="profile-row" style="cursor:pointer" onclick="navigateTo('chat')">
                        <div class="profile-row-left">
                            <div class="profile-row-icon">🤖</div>
                            <div class="profile-row-info">
                                <span class="profile-row-label">About WeatherGPT</span>
                                <span class="profile-row-sub">Ask the AI assistant about this app</span>
                            </div>
                        </div>
                        <span style="color:#94A3B8;font-size:18px">›</span>
                    </div>
                </div>

                <!-- Logout -->
                <button class="profile-logout-btn" onclick="handleProfileLogout()">
                    🚪 Log Out
                </button>

            </div><!-- /.profile-body -->
        </div><!-- /.profile-screen -->
    `;
}

/**
 * Handle toggle changes on the Profile screen.
 * Saves the updated setting to localStorage immediately.
 * @param {string} id - the checkbox element ID
 * @param {boolean} checked
 */
function onProfileToggle(id, checked) {
    const settings = loadProfileSettings();
    const map = {
        'pref-rain':   'alertRain',
        'pref-flood':  'alertFlood',
        'pref-severe': 'alertSevere',
        'pref-notif':  'notificationsOn',
    };
    const key = map[id];
    if (key) {
        settings[key] = checked;
        saveProfileSettings(settings);
    }
}

/**
 * Handle temperature unit selection.
 * Re-renders the profile screen to reflect the new unit selection.
 * @param {string} unit - 'C' or 'F'
 */
function onTempUnit(unit) {
    const settings = loadProfileSettings();
    settings.tempUnit = unit;
    saveProfileSettings(settings);
    // Re-render the profile screen so pills and preview update
    renderProfileScreen();
}

/**
 * Refresh location: clears weatherCache and re-fetches geolocation.
 * Then navigates back to the profile screen with updated data.
 */
async function refreshLocation() {
    const btn = document.querySelector('.profile-body button');
    state.weatherCache = null;
    try {
        await fetchWeatherData();
    } catch (_) {}
    renderProfileScreen();
}

/**
 * Handle logout from the Profile screen.
 * Frontend-only: clears localStorage user data and navigates to splash.
 * No server-side auth — matches the existing frontend-only auth model.
 */
function handleProfileLogout() {
    if (!confirm('Log out of WeatherGPT?')) return;

    // Clear user data from localStorage
    try {
        localStorage.removeItem('weathergpt_user');
    } catch (_) {}

    // Reset in-memory state
    state.userName   = '';
    state.chatMode   = 'general';
    state.chatLanguage = 'en';
    state.weatherCache = null;
    state.messages   = [];

    // Navigate back to the auth entry point
    navigateTo('create-account');
}

// ══════════════════════════════════════════════════════════
//  LIVE WEATHER MAP Screen
//
//  Uses Leaflet.js (open-source, no API key) with OpenStreetMap
//  tiles to render a real map centered on the user's detected
//  GPS location.
//
//  Weather data: existing getWeather() → GET /api/weather
//  Alert data:   existing getAlerts()  → GET /api/alerts
//  Risk level:   derived from alert severity — NOT from the
//                synthetic ML model (which is prototype-only
//                and does not provide geographic risk maps).
//
//  IMD integration note:
//    IMD district warnings are not yet connected.
//    This screen is designed to accept an IMD data adapter
//    without further structural changes — replace the
//    getAlerts() call with an IMD-backed endpoint when available.
//
//  DO NOT fabricate geographic risk polygons.
//  DO NOT color Indian states without real per-state data.
// ══════════════════════════════════════════════════════════

/** Module-level Leaflet map instance — kept so we can invalidateSize on re-entry. */
let _lmapInstance = null;

/**
 * Map alert severity string → IMD-style risk label and CSS class.
 * Returns { label, cls } where cls matches .lmap-risk-badge.* and
 * .lmap-legend-dot.* in style.css.
 */
function _lmapRiskFromAlert(alertData) {
    if (!alertData || !alertData.has_alert) {
        return { label: 'SAFE', cls: 'safe' };
    }
    const sev = (alertData.severity || 'low').toLowerCase();
    if (sev === 'high')   return { label: 'HIGH',   cls: 'high'   };
    if (sev === 'medium') return { label: 'MEDIUM', cls: 'medium' };
    return                       { label: 'LOW',    cls: 'low'    };
}

/**
 * Map risk class → Leaflet marker color hex.
 * Uses the same palette as the CSS risk badges.
 */
function _lmapMarkerColor(cls) {
    return { high: '#E53935', medium: '#FB8C00', low: '#FDD835', safe: '#43A047' }[cls] || '#2E86DE';
}

/**
 * Build a custom Leaflet DivIcon circle marker for the current location.
 * Size: 22px — visible but not obtrusive.
 */
function _lmapCreateMarkerIcon(color) {
    return L.divIcon({
        className: '',
        html: `<div style="
            width:22px;height:22px;border-radius:50%;
            background:${color};
            border:3px solid white;
            box-shadow:0 2px 8px rgba(0,0,0,0.35);
        "></div>`,
        iconSize:   [22, 22],
        iconAnchor: [11, 11],
        popupAnchor:[0, -14],
    });
}

/**
 * Render the Live Weather Map screen.
 *
 * Layout (top → bottom):
 *   1. Risk legend bar  (HIGH / MEDIUM / LOW / SAFE)
 *   2. Leaflet OSM tile map  (fills remaining height)
 *      – Location marker with color-coded risk
 *      – Popup with real weather values
 *   3. Floating info card  (location · temp · condition · risk)
 *   4. Data-source note
 *
 * All values come from real backend APIs — no fabricated data.
 */
async function renderLiveMapScreen() {
    const content = document.getElementById('live-map-content');
    if (!content) return;

    // ── Show loading skeleton ────────────────────────────
    content.innerHTML = `
        <div class="lmap-screen">
            <div class="lmap-legend">
                <span class="lmap-legend-item"><span class="lmap-legend-dot high"></span>HIGH</span>
                <span class="lmap-legend-item"><span class="lmap-legend-dot medium"></span>MEDIUM</span>
                <span class="lmap-legend-item"><span class="lmap-legend-dot low"></span>LOW</span>
                <span class="lmap-legend-item"><span class="lmap-legend-dot safe"></span>SAFE</span>
            </div>
            <div class="lmap-status">
                <div class="loading-spinner"></div>
                <p>Fetching location & weather…</p>
            </div>
        </div>`;

    // ── Fetch data (reuse existing helpers & state) ──────
    let w = null, alertData = null;
    try {
        w = state.weatherCache ? state.weatherCache : await fetchWeatherData();
        alertData = await getAlerts(state.latitude, state.longitude).catch(() => null);
    } catch (err) {
        content.innerHTML = `
            <div class="lmap-screen">
                <div class="lmap-legend">
                    <span class="lmap-legend-item"><span class="lmap-legend-dot high"></span>HIGH</span>
                    <span class="lmap-legend-item"><span class="lmap-legend-dot medium"></span>MEDIUM</span>
                    <span class="lmap-legend-item"><span class="lmap-legend-dot low"></span>LOW</span>
                    <span class="lmap-legend-item"><span class="lmap-legend-dot safe"></span>SAFE</span>
                </div>
                <div class="lmap-status">
                    <span style="font-size:36px">⚠️</span>
                    <p>Unable to load weather data.<br>Please ensure the backend is running.</p>
                    <button class="retry-btn" onclick="renderLiveMapScreen()">Try Again</button>
                </div>
            </div>`;
        return;
    }

    // ── Derive display values ────────────────────────────
    const lat       = state.latitude;
    const lon       = state.longitude;
    const locName   = w.location || state.locationName;
    const tempStr   = `${Math.round(w.temperature)}°C`;
    const condIcon  = getConditionIcon(w.condition, w.is_day ?? 1);
    const risk      = _lmapRiskFromAlert(alertData);
    const mColor    = _lmapMarkerColor(risk.cls);
    const alertMsg  = (alertData && alertData.has_alert && alertData.message)
                        ? alertData.message
                        : 'No active weather alert.';

    // ── Build the screen structure ───────────────────────
    const mapDivId = 'lmap-leaflet-div';
    content.innerHTML = `
        <div class="lmap-screen">
            <!-- Legend -->
            <div class="lmap-legend">
                <span class="lmap-legend-item"><span class="lmap-legend-dot high"></span>HIGH</span>
                <span class="lmap-legend-item"><span class="lmap-legend-dot medium"></span>MEDIUM</span>
                <span class="lmap-legend-item"><span class="lmap-legend-dot low"></span>LOW</span>
                <span class="lmap-legend-item"><span class="lmap-legend-dot safe"></span>SAFE</span>
            </div>

            <!-- Map tile area -->
            <div class="lmap-tile" style="position:relative">
                <div id="${mapDivId}" style="width:100%;height:100%"></div>

                <!-- Floating info card -->
                <div class="lmap-info-card">
                    <div class="lmap-info-icon">${condIcon}</div>
                    <div class="lmap-info-body">
                        <div class="lmap-info-location">📍 ${locName}</div>
                        <div class="lmap-info-row">
                            <span class="lmap-info-chip">🌡️ ${tempStr}</span>
                            <span class="lmap-info-chip">💧 ${w.humidity}%</span>
                            <span class="lmap-info-chip">💨 ${w.wind_speed} km/h</span>
                            <span class="lmap-info-chip">🌧️ ${w.rain_probability}%</span>
                        </div>
                    </div>
                    <div class="lmap-risk-badge ${risk.cls}">${risk.label}</div>
                </div>
            </div>

            <!-- Data-source footer -->
            <div class="lmap-source-note">
                Map: © OpenStreetMap contributors · Weather: Open-Meteo / WeatherAPI.com ·
                Risk from live alert data · IMD integration: pending
            </div>
        </div>`;

    // ── Initialise or refresh Leaflet map ────────────────
    // Use setTimeout 50ms so the screen's flex layout has fully settled.
    setTimeout(() => {
        const mapEl = document.getElementById(mapDivId);
        if (!mapEl) return;
        if (typeof L === 'undefined') return;

        // Destroy previous instance if re-entering the screen
        if (_lmapInstance) {
            try { _lmapInstance.remove(); } catch (_) {}
            _lmapInstance = null;
        }

        // Create Leaflet map
        const map = L.map(mapEl, {
            center: [lat, lon],
            zoom: 12,
            zoomControl: true,
            attributionControl: true,
        });

        // OpenStreetMap tiles — free, no key required
        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        }).addTo(map);

        // Build detailed popup from real data only
        const detailedPopup = _lmapBuildDetailedPopup(w, risk, mColor, alertData);

        // Location marker
        const icon   = _lmapCreateMarkerIcon(mColor);
        const marker = L.marker([lat, lon], { icon }).addTo(map);
        marker.bindPopup(detailedPopup, { maxWidth: 300, minWidth: 240 });
        marker.openPopup();

        _lmapInstance = map;
        map.invalidateSize();
    }, 50);
}

// ══════════════════════════════════════════════════════════
//  LIVE MAP — Detailed Popup Helpers
// ══════════════════════════════════════════════════════════

/**
 * Generate a plain-language "Why this risk?" explanation
 * derived ONLY from real weather values returned by the API.
 *
 * Features available: temperature, humidity, wind_speed,
 *   rain_probability, condition, is_day.
 * Features NOT available (not in WeatherResponse):
 *   rainfall_mm, cloud_cover, visibility_km,
 *   precipitation_mm, uv_index.
 *
 * @param {Object} w       - WeatherResponse
 * @param {Object} risk    - { label, cls } from _lmapRiskFromAlert
 * @param {Object} alertData - AlertResponse (may be null)
 * @returns {string}
 */
function _lmapBuildWhyExplanation(w, risk, alertData) {
    const factors = [];

    if (w.rain_probability >= 80)
        factors.push(`very high rain probability (${w.rain_probability}%)`);
    else if (w.rain_probability >= 50)
        factors.push(`elevated rain probability (${w.rain_probability}%)`);

    if (w.humidity >= 85)
        factors.push(`very high humidity (${w.humidity}%)`);
    else if (w.humidity >= 70)
        factors.push(`high humidity (${w.humidity}%)`);

    if (w.wind_speed >= 60)
        factors.push(`gale-force winds (${w.wind_speed} km/h)`);
    else if (w.wind_speed >= 40)
        factors.push(`strong winds (${w.wind_speed} km/h)`);

    if (w.temperature >= 42)
        factors.push(`extreme heat (${Math.round(w.temperature)}°C)`);
    else if (w.temperature <= 5)
        factors.push(`cold conditions (${Math.round(w.temperature)}°C)`);

    const cond = (w.condition || '').toLowerCase();
    if (cond.includes('thunder'))  factors.push('thunderstorm activity');
    else if (cond.includes('heavy rain') || cond.includes('violent'))
        factors.push('heavy rainfall');
    else if (cond.includes('fog') || cond.includes('mist'))
        factors.push('reduced visibility due to fog/mist');

    if (factors.length === 0) {
        return 'Current weather conditions are stable with no significant risk factors detected from available data.';
    }

    const factorList = factors.length === 1
        ? factors[0]
        : factors.slice(0, -1).join(', ') + ' and ' + factors[factors.length - 1];

    return `Risk elevated due to ${factorList}. Monitor conditions and follow local advisories.`;
}

/**
 * Build the detailed Leaflet popup HTML for the current-location marker.
 *
 * Risk level: from alert severity (real backend data).
 * /api/predict is NOT called — only 4 of 9 required features are
 * available from WeatherResponse; fabricating the other 5 is not permitted.
 *
 * @param {Object} w         - WeatherResponse (real API data)
 * @param {Object} risk      - { label, cls } from _lmapRiskFromAlert
 * @param {string} mColor    - hex color string matching risk
 * @param {Object} alertData - AlertResponse (may be null)
 * @returns {string}         - HTML string for Leaflet popup
 */
function _lmapBuildDetailedPopup(w, risk, mColor, alertData) {
    const tempStr    = `${Math.round(w.temperature)}°C`;
    const feelsStr   = `${Math.round(w.feels_like)}°C`;
    const locName    = w.location || state.locationName;
    const condIcon   = getConditionIcon(w.condition, w.is_day ?? 1);
    const riskBadgeTxtColor = risk.cls === 'low' ? '#374151' : 'white';
    const why        = _lmapBuildWhyExplanation(w, risk, alertData);

    // Alert message (if active)
    const alertMsg = alertData && alertData.has_alert && alertData.message
        ? alertData.message
        : null;

    return `
<div style="font-family:system-ui,-apple-system,sans-serif;max-width:280px;min-width:240px">

    <!-- Location + risk badge -->
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
        <div>
            <div style="font-size:11px;color:#6B7280;font-weight:600;text-transform:uppercase;letter-spacing:0.4px">📍 Location</div>
            <div style="font-size:14px;font-weight:700;color:#0F172A;line-height:1.2;margin-top:2px">${locName}</div>
        </div>
        <div style="padding:5px 12px;border-radius:20px;font-size:12px;font-weight:800;color:${riskBadgeTxtColor};background:${mColor};text-transform:uppercase;letter-spacing:0.5px;white-space:nowrap;margin-left:10px">
            ${risk.label} RISK
        </div>
    </div>

    <!-- Divider -->
    <div style="border-top:1px solid #F1F5F9;margin-bottom:10px"></div>

    <!-- Live Weather Conditions -->
    <div style="font-size:11px;color:#6B7280;font-weight:700;text-transform:uppercase;letter-spacing:0.4px;margin-bottom:6px">
        Live Weather Conditions
    </div>
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
        <span style="font-size:28px;line-height:1">${condIcon}</span>
        <div>
            <div style="font-size:13px;font-weight:600;color:#374151">${w.condition}</div>
            <div style="font-size:11px;color:#94A3B8">Feels like ${feelsStr}</div>
        </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:10px">
        <div style="background:#F8FAFF;border-radius:8px;padding:6px 10px">
            <div style="font-size:10px;color:#94A3B8;font-weight:600">🌡️ TEMPERATURE</div>
            <div style="font-size:14px;font-weight:700;color:#0F172A">${tempStr}</div>
        </div>
        <div style="background:#F8FAFF;border-radius:8px;padding:6px 10px">
            <div style="font-size:10px;color:#94A3B8;font-weight:600">💧 HUMIDITY</div>
            <div style="font-size:14px;font-weight:700;color:#0F172A">${w.humidity}%</div>
        </div>
        <div style="background:#F8FAFF;border-radius:8px;padding:6px 10px">
            <div style="font-size:10px;color:#94A3B8;font-weight:600">💨 WIND</div>
            <div style="font-size:14px;font-weight:700;color:#0F172A">${w.wind_speed} km/h</div>
        </div>
        <div style="background:#F8FAFF;border-radius:8px;padding:6px 10px">
            <div style="font-size:10px;color:#94A3B8;font-weight:600">🌧️ RAIN PROB.</div>
            <div style="font-size:14px;font-weight:700;color:#0F172A">${w.rain_probability}%</div>
        </div>
    </div>

    <!-- Divider -->
    <div style="border-top:1px solid #F1F5F9;margin-bottom:10px"></div>

    <!-- Risk Prediction -->
    <div style="font-size:11px;color:#6B7280;font-weight:700;text-transform:uppercase;letter-spacing:0.4px;margin-bottom:6px">
        Risk Assessment
    </div>
    <div style="display:flex;align-items:center;justify-content:space-between;background:#F8FAFF;border-radius:10px;padding:8px 12px;margin-bottom:6px">
        <div>
            <div style="font-size:10px;color:#94A3B8;font-weight:600">RISK LEVEL</div>
            <div style="font-size:15px;font-weight:800;color:${mColor}">${risk.label}</div>
        </div>
        <div style="text-align:right">
            <div style="font-size:10px;color:#94A3B8;font-weight:600">SOURCE</div>
            <div style="font-size:11px;font-weight:600;color:#374151">Live Alert API</div>
        </div>
    </div>
    <div style="background:#FFF9F0;border:1px solid #FDE68A;border-radius:8px;padding:6px 10px;margin-bottom:8px;font-size:11px;color:#92400E">
        ⚠️ Full ML prediction requires 9 weather features. Only 4 of 9 are available from the weather API
        (temperature, humidity, wind speed, rain probability). Risk shown is from the live alerts engine.
    </div>

    ${alertMsg ? `
    <!-- Alert message -->
    <div style="background:#FEF2F2;border-left:3px solid ${mColor};border-radius:6px;padding:6px 10px;margin-bottom:8px;font-size:11px;color:#374151;line-height:1.4">
        ${alertMsg}
    </div>` : ''}

    <!-- Divider -->
    <div style="border-top:1px solid #F1F5F9;margin-bottom:8px"></div>

    <!-- Why? -->
    <div style="font-size:11px;color:#6B7280;font-weight:700;text-transform:uppercase;letter-spacing:0.4px;margin-bottom:4px">
        Why?
    </div>
    <div style="font-size:12px;color:#374151;line-height:1.5;margin-bottom:10px">
        ${why}
    </div>

    <!-- Disclaimer -->
    <div style="background:#F8FAFC;border-radius:6px;padding:6px 8px;font-size:10px;color:#94A3B8;line-height:1.4;text-align:center">
        Risk from live alert data · Weather: Open-Meteo / WeatherAPI.com<br>
        ML prediction requires additional environmental inputs not currently available.
    </div>

</div>`;
}
