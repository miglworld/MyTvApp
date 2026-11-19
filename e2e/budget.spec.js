// Speed budgets. The app must start and react fast enough on a TV, whose
// processor is much slower than a laptop's. Chromium is slowed to stand in
// for one, and the playlist is about the size of the all-countries list. Key
// and screen times are the median of several runs. Launch is the slowest run:
// the first load of a session is cold, and a TV starts cold.
//
// The slowdown is set to the same speed on every machine: the speed of the
// owner's Mac slowed six times. A short fixed workload is timed first, and the
// slowdown is scaled by how much faster or slower this machine runs it than
// the Mac did (REFERENCE_WORK_MS). A slower machine (such as a GitHub runner)
// is slowed less, a faster one more, so the budget is equally strict on both.
// The slowdown is never below 1: no machine is measured faster than it is.
//
// Budgets: starting until the first channel is drawn must take at most
// LAUNCH_BUDGET_MS; pressing a key or opening a screen until it has changed
// must take at most RESPONSE_BUDGET_MS.
'use strict';
const { test, expect } = require('@playwright/test');
const { seedScript, lockNetwork, press, KEY } = require('./fixtures');

const LAUNCH_BUDGET_MS = 500;
const RESPONSE_BUDGET_MS = 300;
// The owner's Mac, unthrottled, ran calibrationWork() in about 31.5 ms
// (median of 7, measured 2026-11-19). Change only with the owner's yes.
const REFERENCE_WORK_MS = 31.5;
const REFERENCE_SLOWDOWN = 6;
const CHANNELS = 13000;
const RUNS = 3;
const PLAYLIST_URL = 'https://example.com/playlists/demo.m3u';

function bigPlaylist(count) {
    const lines = ['#EXTM3U'];
    for (let i = 0; i < count; i++) {
        lines.push('#EXTINF:-1 tvg-id="Ch' + i + '.xx" tvg-logo="https://logo.example/' + i + '.png" group-title="Group ' + (i % 180) + '",Channel ' + i + ' (1080p)');
        lines.push('https://stream.example.invalid/' + i + '/index.m3u8');
    }
    return lines.join('\n');
}

// A fixed CPU workload like the app's own: reading playlist lines with a
// regular expression and building small objects. Runs in the page, unthrottled.
// Returns the median time in ms of 7 runs, after 2 warm-up runs.
function calibrationWork() {
    function work() {
        var re = /([a-z-]+)="([^"]*)"/g, out = 0;
        for (var i = 0; i < 100000; i++) {
            var line = '#EXTINF:-1 tvg-id="Ch' + i + '.xx" group-title="Group ' + (i % 180) + '",Channel ' + i + ' (1080p)';
            var m; re.lastIndex = 0;
            while ((m = re.exec(line)) !== null) out += m[2].length;
            out += JSON.stringify({ name: line.slice(line.indexOf(',') + 1).replace(/\s*\(\d+p\)$/, ''), n: i }).length;
        }
        return out;
    }
    work(); work();
    var t = [];
    for (var k = 0; k < 7; k++) { var a = performance.now(); work(); t.push(performance.now() - a); }
    t.sort(function (x, y) { return x - y; });
    return t[3];
}

function median(values) {
    const sorted = values.slice().sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)];
}

test('the app starts within budget and responds to keys and screens within budget', async ({ page }) => {
    const body = bigPlaylist(CHANNELS);
    await page.addInitScript(seedScript());
    await page.addInitScript(() => {
        const o = new MutationObserver(() => {
            if (!window.__firstRow && document.querySelector('.live-row')) {
                window.__firstRow = performance.now();
                o.disconnect();
            }
        });
        o.observe(document, { childList: true, subtree: true });
    });
    await lockNetwork(page, { [PLAYLIST_URL]: { status: 200, type: 'audio/x-mpegurl', body } });
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    const workMs = await page.evaluate(calibrationWork);
    const slowdown = Math.max(1, REFERENCE_SLOWDOWN * REFERENCE_WORK_MS / workMs);

    const launch = [], keys = [], settings = [];
    for (let run = 0; run < RUNS; run++) {
        await cdp.send('Emulation.setCPUThrottlingRate', { rate: slowdown });
        await page.goto('/index.html');
        await page.waitForSelector('.live-row', { timeout: 60000 });
        launch.push(await page.evaluate(() => window.__firstRow));

        keys.push(await page.evaluate(() => new Promise((resolve) => {
            const t = performance.now();
            document.dispatchEvent(new KeyboardEvent('keydown', { keyCode: 40, which: 40, bubbles: true }));
            setTimeout(() => resolve(performance.now() - t), 0);
        })));
        await press(page, KEY.LEFT);

        settings.push(await page.evaluate(() => new Promise((resolve) => {
            const t = performance.now();
            document.getElementById('navSettings').click();
            setTimeout(() => resolve(performance.now() - t), 0);
        })));
        await page.click('#navLive');
    }

    const result = {
        launchSlowestMs: Math.round(Math.max(...launch)),
        keyMedianMs: Math.round(median(keys) * 10) / 10,
        settingsMedianMs: Math.round(median(settings) * 10) / 10,
    };
    console.log('BUDGET ' + JSON.stringify({ ...result, workMs: Math.round(workMs * 10) / 10, slowdown: Math.round(slowdown * 100) / 100, launch, keys, settings }));
    expect(result.launchSlowestMs, 'launch to the first channel, ms (slowest run)').toBeLessThanOrEqual(LAUNCH_BUDGET_MS);
    expect(result.keyMedianMs, 'key press to the next channel, ms').toBeLessThanOrEqual(RESPONSE_BUDGET_MS);
    expect(result.settingsMedianMs, 'opening Settings, ms').toBeLessThanOrEqual(RESPONSE_BUDGET_MS);
});
