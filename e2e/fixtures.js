// Shared setup for the end-to-end tests: a playlist and guide made up for the
// tests, a stand-in for the Samsung player, and a network policy that lets
// through only localhost and the test playlist address.
'use strict';

const PLAYLIST_URL = 'https://example.com/playlists/demo.m3u';
const GUIDE_URL = 'https://raw.githubusercontent.com/miglworld/MyTvApp/guide/guide.json';
const PRESET_PT = 'https://iptv-org.github.io/iptv/countries/pt.m3u';
const PRESET_ALL = 'https://iptv-org.github.io/iptv/index.country.m3u';

function playlistText(extraChannels) {
    const rows = [
        ['News', 'Aurora News', 'aurora.demo'],
        ['News', 'Meridian 24', 'meridian.demo'],
        ['Sports', 'Atlas Sport 1', 'atlas.demo'],
        ['Movies', 'Cinema Nova', 'cinema.demo'],
    ];
    const lines = ['#EXTM3U'];
    for (const [group, name, id] of rows) {
        lines.push(`#EXTINF:-1 tvg-id="${id}" group-title="${group}",${name}`);
        lines.push(`https://stream.example.invalid/${id}.m3u8`);
    }
    for (const extra of extraChannels || []) {
        lines.push(extra);
        lines.push('https://stream.example.invalid/extra.m3u8');
    }
    return lines.join('\n') + '\n';
}

// A guide with programmes around the present, for the channels above.
function guideJson() {
    const now = Math.floor(Date.now() / 60000);
    const start = Math.floor(now / 60) * 60 - 60;
    const channels = {};
    for (const key of ['aurora.demo', 'meridian.demo', 'atlas.demo', 'cinema.demo']) {
        channels[key] = [
            [start, 60, 'Morning Briefing', 'The day in brief.'],
            [start + 60, 90, 'World Report', 'Stories from home and abroad.'],
            [start + 150, 60, 'Business Hour', 'Markets and companies.'],
        ];
    }
    return JSON.stringify({ generated: Math.floor(Date.now() / 1000), hours: 48, channels });
}

// Stands in for the Samsung player: it reports that it plays, and never fetches.
const PLAYER_STAND_IN = `
(function () {
    var L = null, t = null;
    window.webapis = { avplay: {
        open: function () {}, setDisplayRect: function () {}, setListener: function (x) { L = x; },
        setStreamingProperty: function () {}, setBufferingParam: function () {}, setDisplayMethod: function () {},
        prepareAsync: function (ok) { setTimeout(ok, 50); },
        play: function () { clearInterval(t); t = setInterval(function () { if (L) L.oncurrentplaytime(1); }, 200); },
        stop: function () { clearInterval(t); }, close: function () {}, getState: function () { return 'PLAYING'; },
        pause: function () {}, getCurrentStreamInfo: function () { return []; }, getStreamingProperty: function () { return '0'; }
    } };
})();`;

// Before the app runs: the test playlist is switched on, updates are off, and
// the player stand-in is in place. Runs on every page load of the test.
function seedScript(options) {
    const opts = JSON.stringify(options || {});
    return `
    (function () {
        var o = ${opts};
        if (!localStorage.getItem('e2e_seeded')) {
            localStorage.setItem('e2e_seeded', '1');
            localStorage.setItem('iptv_playlists', JSON.stringify([{ id: 'pl_e2e', name: 'Test TV', url: o.playlistUrl || '${PLAYLIST_URL}' }]));
            localStorage.setItem('iptv_active_playlist_id', JSON.stringify(['pl_e2e']));
            localStorage.setItem('iptv_auto_update', '0');
            localStorage.setItem('iptv_fast_start', '1');
        }
    })();
    ${PLAYER_STAND_IN}`;
}

// Routes every request of a page. Localhost and the test addresses are answered
// here; anything else is aborted and recorded as a policy violation.
async function lockNetwork(page, extra) {
    const violations = [];
    const handled = Object.assign({
        [PLAYLIST_URL]: { status: 200, body: playlistText(), type: 'audio/x-mpegurl' },
        [GUIDE_URL]: { status: 200, body: guideJson(), type: 'application/json' },
        // The two one-press playlists in Settings, answered with fixtures so
        // adding them is tested without reaching iptv-org.
        [PRESET_PT]: { status: 200, body: playlistText(['#EXTINF:-1 tvg-id="pt.demo" group-title="General",Preset PT']), type: 'audio/x-mpegurl' },
        [PRESET_ALL]: { status: 200, body: playlistText(['#EXTINF:-1 tvg-id="all.demo" group-title="General",Preset All']), type: 'audio/x-mpegurl' },
    }, extra || {});
    await page.route('**/*', (route) => {
        const url = route.request().url();
        if (url.startsWith('http://127.0.0.1:8765/') || url.startsWith('http://localhost:8765/')) {
            return route.continue();
        }
        const canned = handled[url];
        if (canned) {
            return route.fulfill({ status: canned.status, body: canned.body, contentType: canned.type, headers: { 'Access-Control-Allow-Origin': '*' } });
        }
        violations.push(url);
        return route.abort('blockedbyclient');
    });
    return violations;
}

// Presses a remote key: the app reads keyCode, so the event carries one.
async function press(page, keyCode) {
    await page.evaluate((code) => {
        document.dispatchEvent(new KeyboardEvent('keydown', { keyCode: code, which: code, bubbles: true, cancelable: true }));
    }, keyCode);
    await page.waitForTimeout(120);
}
const KEY = { LEFT: 37, UP: 38, RIGHT: 39, DOWN: 40, OK: 13, BACK: 10009 };

// Errors the page raised. The app's own console.error lines for a failed
// playback are expected and are not counted; anything else is.
function watchPage(page) {
    const errors = [];
    page.on('pageerror', (e) => errors.push('uncaught: ' + e.message));
    page.on('console', (m) => {
        if (m.type() !== 'error') return;
        const t = m.text();
        if (/Playback engine failed|HLS\.js fatal error/.test(t)) return;
        if (/Failed to load resource: the server responded with a status of 404/.test(t)) return;
        errors.push('console: ' + t);
    });
    return errors;
}

module.exports = { PLAYLIST_URL, GUIDE_URL, playlistText, guideJson, seedScript, lockNetwork, press, KEY, watchPage };
