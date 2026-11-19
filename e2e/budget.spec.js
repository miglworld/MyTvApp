// Speed budgets. The app must start and react fast enough on a TV, whose
// processor is much slower than a laptop's. Chromium is slowed six times to
// stand in for one, and the playlist is about the size of the all-countries
// list. Key and screen times are the median of several runs. Launch is the
// slowest run: the first load of a session is cold, and a TV starts cold.
//
// Budgets: starting until the first channel is drawn must take at most
// LAUNCH_BUDGET_MS; pressing a key or opening a screen until it has changed
// must take at most RESPONSE_BUDGET_MS.
'use strict';
const { test, expect } = require('@playwright/test');
const { seedScript, lockNetwork, press, KEY } = require('./fixtures');

const LAUNCH_BUDGET_MS = 500;
const RESPONSE_BUDGET_MS = 300;
const CPU_SLOWDOWN = 6;
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

    const launch = [], keys = [], settings = [];
    for (let run = 0; run < RUNS; run++) {
        await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU_SLOWDOWN });
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
    console.log('BUDGET ' + JSON.stringify({ ...result, launch, keys, settings }));
    expect(result.launchSlowestMs, 'launch to the first channel, ms (slowest run)').toBeLessThanOrEqual(LAUNCH_BUDGET_MS);
    expect(result.keyMedianMs, 'key press to the next channel, ms').toBeLessThanOrEqual(RESPONSE_BUDGET_MS);
    expect(result.settingsMedianMs, 'opening Settings, ms').toBeLessThanOrEqual(RESPONSE_BUDGET_MS);
});
