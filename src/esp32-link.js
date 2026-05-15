/**
 * ESP32 live communication module.
 *
 * Subscribes to Zustand store changes and sends servo angles to the
 * ESP32 over HTTP whenever the user moves sliders or drags feet.
 */
import { useStore } from './store.js';

const DEBOUNCE_MS = 50; // max ~20 updates/sec

let debounceTimer = null;
let unsubscribe = null;
let inFlight = false;

// ── Timeout helper (works in all browsers, unlike AbortSignal.timeout) ─
function fetchWithTimeout(url, options = {}, timeoutMs = 3000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    return fetch(url, { ...options, signal: controller.signal })
        .finally(() => clearTimeout(timer));
}

// ── Send all 12 angles at once ─────────────────────────────────────────
async function sendAngles(ip, angles) {
    const res = await fetchWithTimeout(
        `http://${ip}/set-angles`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(angles),
        },
        2000
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}

// ── Test connection (GET /status) ──────────────────────────────────────
export async function testConnection(ip) {
    const res = await fetchWithTimeout(`http://${ip}/status`, {}, 3000);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}

// ── Quick commands ─────────────────────────────────────────────────────
export async function sendAllTo(ip, angle) {
    const endpoint = angle === 90 ? '/set-all-90' : '/set-all-0';
    const res = await fetchWithTimeout(
        `http://${ip}${endpoint}`,
        { method: 'POST' },
        3000
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}

export async function sendSingleServo(ip, leg, joint, angle) {
    const res = await fetchWithTimeout(
        `http://${ip}/set-servo`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ leg, joint, angle }),
        },
        3000
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}

// ── Live link: subscribe to store and auto-send on changes ─────────────
// Uses THROTTLE (not debounce) so continuous updates (playback, dragging)
// still send at a steady ~20Hz rate instead of waiting for silence.

let dirty = false;     // true = legs changed since last send
let throttleTimer = null;

async function flushToEsp32() {
    const { liveMode, esp32Ip, legs } = useStore.getState();
    if (!liveMode || !dirty || inFlight) return;

    dirty = false;
    inFlight = true;
    try {
        await sendAngles(esp32Ip, legs);
        useStore.getState().setEsp32Error(null);
    } catch (err) {
        useStore.getState().setEsp32Error(err.message);
    } finally {
        inFlight = false;
    }
}

export function startLiveLink() {
    stopLiveLink();

    // Mark dirty on every legs change
    unsubscribe = useStore.subscribe(
        (state) => state.legs,
        () => { dirty = true; }
    );

    // Send at fixed interval (~20Hz) whenever dirty
    throttleTimer = setInterval(flushToEsp32, DEBOUNCE_MS);
}

export function stopLiveLink() {
    if (unsubscribe) {
        unsubscribe();
        unsubscribe = null;
    }
    if (throttleTimer) {
        clearInterval(throttleTimer);
        throttleTimer = null;
    }
    dirty = false;
    inFlight = false;
}
