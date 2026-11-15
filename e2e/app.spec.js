// Flows through the real app: boot, navigation, Settings, Live TV, the guide,
// playback start, and the defences against hostile playlist text.
'use strict';
const { test, expect } = require('@playwright/test');
const { seedScript, lockNetwork, press, KEY, watchPage } = require('./fixtures');

// Opens the app. Waits for the channel list unless the test expects none.
async function open(page, options) {
    await page.addInitScript(seedScript(options));
    const violations = await lockNetwork(page, options && options.routes);
    const errors = watchPage(page);
    await page.goto('/index.html');
    if (!(options && options.noChannels)) {
        await expect(page.locator('.live-row').first()).toBeVisible({ timeout: 15000 });
    } else {
        await expect(page.locator('#app')).toBeVisible();
    }
    return { violations, errors };
}

async function activeScreen(page) {
    return page.evaluate(() => document.querySelector('.screen.active').id);
}

test('boot: the app starts with no uncaught errors, console errors or blocked requests', async ({ page }) => {
    const { violations, errors } = await open(page);
    await page.waitForTimeout(1500);
    expect(violations, 'requests to addresses outside the test policy').toEqual([]);
    expect(errors, 'page errors').toEqual([]);
    expect(await activeScreen(page)).toBe('screen-live');
    await expect(page.locator('#liveTitle')).toContainText('All channels');
});

test('content security policy: the app works without a single violation', async ({ page }) => {
    await open(page);
    expect(await page.evaluate(() => !!document.querySelector('meta[http-equiv="Content-Security-Policy"]'))).toBe(true);
    // Through the screens that load the most: playback, the guide, Settings.
    await press(page, KEY.OK);
    await expect(page.locator('#screen-player')).toHaveClass(/active/);
    await press(page, KEY.BACK);
    await press(page, KEY.LEFT);
    await press(page, KEY.LEFT);
    await page.click('#navGuide');
    await expect(page.locator('.guide-cell').first()).toBeVisible();
    await page.click('#navSettings');
    await page.waitForTimeout(500);
    expect(await page.evaluate(() => window.__cspViolations)).toEqual([]);
});

test('content security policy: a script from another site is refused', async ({ page }) => {
    await open(page);
    const loaded = await page.evaluate(() => new Promise((resolve) => {
        const s = document.createElement('script');
        s.src = 'https://evil.example/x.js';
        s.onload = () => resolve('loaded');
        s.onerror = () => resolve('refused');
        document.body.appendChild(s);
    }));
    expect(loaded).toBe('refused');
    const violations = await page.evaluate(() => window.__cspViolations);
    expect(violations.some((v) => /script-src/.test(v) && /evil\.example/.test(v))).toBe(true);
});

test('content security policy: the browser player can still start a worker and a media source', async ({ page }) => {
    // hls.js, the fallback player, needs both: a worker made from a blob: address,
    // and a video whose source is a blob: address for the media source.
    await open(page);
    const result = await page.evaluate(() => new Promise((resolve) => {
        const out = {};
        try {
            const url = URL.createObjectURL(new Blob(['postMessage("ok")'], { type: 'text/javascript' }));
            const w = new Worker(url);
            w.onmessage = (e) => { out.worker = e.data; finish(); };
            w.onerror = () => { out.worker = 'refused'; finish(); };
        } catch (e) { out.worker = 'threw ' + e.name; }
        const video = document.createElement('video');
        const ms = new MediaSource();
        ms.addEventListener('sourceopen', () => { out.mediaSource = 'open'; finish(); });
        video.addEventListener('error', () => { out.mediaSource = 'refused'; finish(); });
        video.src = URL.createObjectURL(ms);
        function finish() { if (out.worker && out.mediaSource) resolve(out); }
        setTimeout(() => resolve(out), 5000);
    }));
    expect(result).toEqual({ worker: 'ok', mediaSource: 'open' });
    expect(await page.evaluate(() => window.__cspViolations)).toEqual([]);
});

test('navigation: every top-level menu item shows its screen', async ({ page }) => {
    await open(page);
    // Left opens Live TV's own menu; Left again returns to the main menu.
    await press(page, KEY.LEFT);
    await press(page, KEY.LEFT);
    await expect(page.locator('#navGuide')).toBeVisible();
    await page.click('#navGuide');
    expect(await activeScreen(page)).toBe('screen-guide');
    await page.click('#navFavorites');
    expect(await activeScreen(page)).toBe('screen-live');
    await page.click('#navSettings');
    expect(await activeScreen(page)).toBe('screen-settings');
    await page.click('#navLive');
    expect(await activeScreen(page)).toBe('screen-live');
});

test('settings: every section opens and shows its rows', async ({ page }) => {
    await open(page);
    await page.click('#navSettings');
    const sections = ['Playlists', 'Playback', 'Channels', 'Updates', 'About', 'Report a problem'];
    for (const name of sections) {
        await page.locator('.settings-cat', { hasText: name }).click();
        await expect(page.locator('#settingsSectionTitle')).toHaveText(name);
        // Every section has at least one row: a switch, a value, an action or a fact.
        expect(await page.locator('#settingsRows > *').count(), name).toBeGreaterThan(0);
    }
});

test('report a problem: the drawn QR code opens a filled-in GitHub issue, with logins cut out', async ({ page }) => {
    await page.addInitScript(() => {
        localStorage.setItem('iptv_log', JSON.stringify([
            '20:00:01 start',
            '20:00:02 playlist failed: http://me:secret@iptv.example/get.php?username=me&password=secret'
        ]));
    });
    await open(page);
    await page.click('#navSettings');
    await page.locator('.settings-cat', { hasText: 'Report a problem' }).click();
    await expect(page.locator('.report-code svg')).toBeVisible();

    // What the screen shows has no login in it.
    const shown = await page.locator('#settingsRows').innerText();
    expect(shown).toContain('iptv.example/…');
    expect(shown).not.toContain('secret');

    // Draw the code the way the page shows it and read it with jsQR.
    const image = await page.evaluate(() => new Promise((resolve, reject) => {
        const svg = new XMLSerializer().serializeToString(document.querySelector('.report-code svg'));
        const img = new Image();
        img.onload = () => {
            const side = 600;
            const canvas = document.createElement('canvas');
            canvas.width = canvas.height = side;
            const ctx = canvas.getContext('2d');
            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(img, 0, 0, side, side);
            resolve({ side, data: Array.from(ctx.getImageData(0, 0, side, side).data) });
        };
        img.onerror = () => reject(new Error('the code did not draw'));
        img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    }));
    const found = require('jsqr')(Uint8ClampedArray.from(image.data), image.side, image.side);
    expect(found, 'the code reads').toBeTruthy();
    const url = new URL(found.data);
    expect(url.origin + url.pathname).toBe('https://github.com/miglworld/MyTvApp/issues/new');
    const body = url.searchParams.get('body');
    expect(body).toContain('- Version: ');
    expect(body).toContain('20:00:01 start');
    expect(found.data).not.toContain('secret');
    expect(await page.evaluate(() => window.__cspViolations)).toEqual([]);
});

test('settings: a switch changes its stored value and its drawn state', async ({ page }) => {
    await open(page);
    await page.click('#navSettings');
    await page.locator('.settings-cat', { hasText: 'Playback' }).click();
    const row = page.locator('.setting-line', { hasText: 'Faster channel start' }).locator('button');
    const sw = row.locator('.switch');
    const storedBefore = await page.evaluate(() => localStorage.getItem('iptv_fast_start'));
    const drawnBefore = await sw.evaluate((el) => el.classList.contains('on'));
    await row.click();
    expect(await page.evaluate(() => localStorage.getItem('iptv_fast_start'))).not.toBe(storedBefore);
    expect(await sw.evaluate((el) => el.classList.contains('on'))).not.toBe(drawnBefore);
});

test('live tv: the channel list shows the playlist channels and a category opens its channels', async ({ page }) => {
    await open(page);
    await expect(page.locator('.live-row')).toHaveCount(4);
    await press(page, KEY.LEFT);
    await page.locator('.menu-item', { hasText: 'Sports' }).click();
    await expect(page.locator('#liveTitle')).toContainText('Sports');
    await expect(page.locator('.live-row')).toHaveCount(1);
});

test('guide: the grid shows programmes, and OK on a programme that is on plays its channel', async ({ page }) => {
    await open(page);
    await page.click('#navGuide');
    await expect(page.locator('.guide-cell').first()).toBeVisible();
    expect(await page.locator('.guide-cell').count()).toBeGreaterThan(0);
    await press(page, KEY.OK);
    await expect(page.locator('#screen-player')).toHaveClass(/active/);
});

test('full screen: OK on a channel opens it, Back returns to the list', async ({ page }) => {
    await open(page);
    await press(page, KEY.OK);
    await expect(page.locator('#screen-player')).toHaveClass(/active/);
    await press(page, KEY.BACK);
    expect(await activeScreen(page)).toBe('screen-live');
});

test('markup in playlist names is shown as text and runs nothing', async ({ page }) => {
    const hostile = '<img src=x onerror="window.__pwned=1">';
    await open(page, { routes: {
        'https://example.com/playlists/demo.m3u': {
            status: 200, type: 'audio/x-mpegurl',
            body: '#EXTM3U\n#EXTINF:-1 tvg-id="x.demo" group-title="News",' + hostile + '\nhttps://stream.example.invalid/x.m3u8\n',
        },
    } });
    await page.reload();
    await expect(page.locator('.live-row').first()).toContainText('<img src=x');
    expect(await page.evaluate(() => window.__pwned)).toBeUndefined();
    expect(await page.locator('#app img[src="x"]').count()).toBe(0);
});

test('a group named __proto__ is an ordinary group', async ({ page }) => {
    await open(page, { routes: {
        'https://example.com/playlists/demo.m3u': {
            status: 200, type: 'audio/x-mpegurl',
            body: '#EXTM3U\n#EXTINF:-1 tvg-id="p.demo" group-title="__proto__",Proto Channel\nhttps://stream.example.invalid/p.m3u8\n',
        },
    } });
    await page.reload();
    await expect(page.locator('.live-row').first()).toContainText('Proto Channel');
    await page.click('#navLive');
    await expect(page.locator('.menu-item', { hasText: '__proto__' })).toHaveCount(1);
});

test('a playlist that fails to load shows a message and the rest of the app still works', async ({ page }) => {
    await open(page, { noChannels: true, routes: {
        'https://example.com/playlists/demo.m3u': { status: 500, type: 'text/plain', body: 'server error' },
    } });
    await expect(page.locator('#toast')).toContainText('Could not load', { timeout: 15000 });
    await press(page, KEY.LEFT);
    await press(page, KEY.LEFT);
    await page.click('#navSettings');
    expect(await activeScreen(page)).toBe('screen-settings');
});
