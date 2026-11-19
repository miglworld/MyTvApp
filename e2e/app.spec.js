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

// Up and Down keep the column: a shorter row in between does not move the
// focus to its first button. Uses the Playlists section, whose playlist line
// has three buttons (main, Edit, Delete) and whose other lines have one.
test('navigation: Up and Down return to the same button after a shorter row', async ({ page }) => {
    await open(page);
    await page.click('#navSettings');
    await press(page, KEY.RIGHT);   // into the section list
    await press(page, KEY.RIGHT);   // into the rows of Playlists
    const focusedText = () => page.evaluate(() => {
        const el = document.querySelector('.focused');
        return el ? el.textContent.trim() : null;
    });
    // Step to the playlist line's last button (Delete).
    await press(page, KEY.RIGHT);
    await press(page, KEY.RIGHT);
    const before = await focusedText();
    expect(before).toBeTruthy();
    await press(page, KEY.DOWN);
    await press(page, KEY.UP);
    expect(await focusedText()).toBe(before);
});

// The picture behind the menu and Settings is dimmed; the channel list keeps it bright.
test('dim: the picture is dimmed under the menu and Settings, not in the channel list', async ({ page }) => {
    await open(page);
    const dimmed = () => page.evaluate(() => document.documentElement.classList.contains('menu-dim'));
    expect(await dimmed()).toBe(false);          // the channel list is up
    await press(page, KEY.LEFT);                 // into the menu
    expect(await dimmed()).toBe(true);
    await press(page, KEY.RIGHT);                // back to the channel list
    expect(await dimmed()).toBe(false);
    await page.click('#navSettings');
    expect(await dimmed()).toBe(true);
    await page.screenshot({ path: test.info().outputPath('settings-dim.png') });
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

test('focus: the browser focus follows the remote', async ({ page }) => {
    await open(page);
    // The remote's highlight and the browser's own focus must be the same element.
    const focusFollows = () => page.evaluate(() => document.activeElement.classList.contains('focused'));
    for (const key of [KEY.DOWN, KEY.UP, KEY.LEFT]) {
        await press(page, key);
        expect(await focusFollows()).toBe(true);
    }
});

test('add playlist: the address field takes browser focus only on OK, so the keyboard stays shut', async ({ page }) => {
    await open(page);
    await page.click('#navSettings');
    await page.locator('.setting-row', { hasText: 'Add a playlist' }).click();
    await expect(page.locator('#screen-add')).toHaveClass(/active/);
    const focusedOnField = () => page.evaluate(() => document.activeElement.id === 'urlInput');
    expect(await focusedOnField()).toBe(false);
    await press(page, KEY.OK);
    expect(await focusedOnField()).toBe(true);
});

test('settings: a switch reports whether it is on', async ({ page }) => {
    await open(page);
    await page.click('#navSettings');
    await page.locator('.settings-cat', { hasText: 'Playback' }).click();
    const sw = page.locator('[role="switch"]', { hasText: 'Faster channel start' });
    const drawnOn = await sw.evaluate((el) => el.querySelector('.switch').classList.contains('on'));
    await expect(sw).toHaveAttribute('aria-checked', drawnOn ? 'true' : 'false');
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

// The Samsung player's object sits above the <video>. Whichever player plays,
// the other one's surface must not cover the picture.
test('full screen: the picture is not covered, whether the Samsung player plays or another player takes over', async ({ page }) => {
    const visibility = () => page.evaluate(() => ({
        samsung: getComputedStyle(document.getElementById('avPlayer')).visibility,
        video: getComputedStyle(document.getElementById('videoPlayer')).visibility,
    }));
    await open(page);
    await press(page, KEY.OK);
    await expect(page.locator('#screen-player')).toHaveClass(/active/);
    await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('iptv_log')).join('\n'))).toContain('(Samsung player)');
    expect(await visibility()).toEqual({ samsung: 'visible', video: 'hidden' });
    await press(page, KEY.BACK);

    // The Samsung player refuses the next channel: the TV player and hls.js are tried.
    await page.evaluate(() => {
        window.webapis.avplay.prepareAsync = (ok, fail) => setTimeout(() => fail({ name: 'PLAYER_ERROR_CONNECTION_FAILED' }), 30);
    });
    await press(page, KEY.DOWN);
    await press(page, KEY.OK);
    await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('iptv_log')).join('\n'))).toContain('Samsung player: PLAYER_ERROR_CONNECTION_FAILED');
    await expect.poll(() => page.evaluate(() => document.documentElement.classList.contains('avplay-active'))).toBe(false);
    expect(await visibility()).toEqual({ samsung: 'hidden', video: 'visible' });
});

// Seen on a TV: the Samsung player reports a stream it cannot open, and then a
// second error when the app closes it. The second one must not count against
// the TV player, which comes next.
test('playback: a late second error from the Samsung player does not skip the TV player', async ({ page }) => {
    await open(page);
    await page.evaluate(() => {
        const av = window.webapis.avplay;
        let listener = null;
        let pendingFail = null;
        av.setListener = (x) => { listener = x; };
        av.prepareAsync = (ok, fail) => {
            pendingFail = fail;
            setTimeout(() => listener.onerror({ name: 'PLAYER_ERROR_NOT_SUPPORTED_FILE' }), 30);
        };
        av.close = () => {
            const fail = pendingFail;
            pendingFail = null;
            if (fail) setTimeout(() => fail({ name: 'InvalidAccessError' }), 0);
        };
    });
    await press(page, KEY.DOWN);
    await press(page, KEY.OK);
    const log = () => page.evaluate(() => JSON.parse(localStorage.getItem('iptv_log') || '[]').join('\n'));
    await expect.poll(log, { timeout: 30000 }).toContain('could not play');
    const line = (await log()).split('\n').filter((l) => l.indexOf('could not play') !== -1).pop();
    expect(line).toContain('Samsung player: PLAYER_ERROR_NOT_SUPPORTED_FILE');
    expect(line).toContain('TV player');
    expect(line).not.toContain('InvalidAccessError');
});

// The channel keeps playing behind Settings and the Add screens. On the TV
// the Samsung player's picture is an opaque window where its object sits; a
// browser draws nothing there, so an opaque box in the same place stands in.
test('add playlist: both Add screens show above the picture that keeps playing behind them', async ({ page }) => {
    await open(page);
    await expect.poll(() => page.evaluate(() => document.documentElement.classList.contains('avplay-active'))).toBe(true);
    await page.evaluate(() => {
        const plane = document.createElement('div');
        plane.id = 'videoWindowStandIn';
        plane.style.cssText = 'position:absolute;left:0;top:0;width:1920px;height:1080px;background:#204060';
        const player = document.getElementById('screen-player');
        player.insertBefore(plane, player.firstChild);
    });
    const titleOnTop = () => page.evaluate(() => {
        const r = document.getElementById('addPlaylistTitle').getBoundingClientRect();
        const top = document.elementFromPoint(r.left + 20, r.top + r.height / 2);
        return top ? (document.getElementById('screen-add').contains(top) ? 'Add screen' : (top.id || top.tagName)) : 'nothing';
    });
    await page.click('#navSettings');
    await expect(page.locator('#screen-player')).toHaveClass(/preview/);
    for (const row of ['Add a playlist', 'Add an Xtream Codes account']) {
        await page.locator('.setting-row', { hasText: row }).click();
        await expect(page.locator('#screen-add')).toHaveClass(/active/);
        expect(await titleOnTop(), row).toBe('Add screen');
        await page.click('#cancelAddBtn');
    }
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

test('channel names: quality tags and the Geo-blocked mark are not shown, and the mark still dims the channel and shows as a tag in full screen', async ({ page }) => {
    await open(page, { routes: {
        'https://example.com/playlists/demo.m3u': {
            status: 200, type: 'audio/x-mpegurl',
            body: '#EXTM3U\n'
                + '#EXTINF:-1 tvg-id="x.demo" group-title="News",UK | Aurora News FHD\nhttps://stream.example.invalid/x.m3u8\n'
                + '#EXTINF:-1 tvg-id="y.demo" group-title="News",Meridian 24 HD [Geo-blocked]\nhttps://stream.example.invalid/y.m3u8\n',
        },
    } });
    await page.reload();
    const rows = page.locator('.live-row');
    await expect(rows.first()).toContainText('Aurora News');
    await expect(rows.first()).not.toContainText('FHD');
    await expect(rows.nth(1)).toContainText('Meridian 24');
    await expect(rows.nth(1)).not.toContainText('Geo-blocked');
    await expect(rows.nth(1)).toHaveClass(/dim/);

    // Full screen: the tag shows under the name; a channel without marks has none.
    await press(page, KEY.DOWN);
    await press(page, KEY.OK);
    await expect(page.locator('#screen-player')).toHaveClass(/active/);
    await expect(page.locator('#nowPlayingName')).toHaveText('Meridian 24');
    await expect(page.locator('#nowPlayingTags .channel-tag')).toHaveText(['Geo-blocked']);
    await page.screenshot({ path: test.info().outputPath('full-screen-tag.png') });
    await press(page, KEY.BACK);
    await press(page, KEY.UP);
    await press(page, KEY.OK);
    await expect(page.locator('#screen-player')).toHaveClass(/active/);
    await expect(page.locator('#nowPlayingName')).toHaveText('Aurora News');
    await expect(page.locator('#nowPlayingTags')).toBeHidden();
});

test('copies: when the first copy of a channel cannot play, the next copy plays and the app says so', async ({ page }) => {
    await open(page, { routes: {
        'https://example.com/playlists/demo.m3u': {
            status: 200, type: 'audio/x-mpegurl',
            body: '#EXTM3U\n'
                + '#EXTINF:-1 tvg-id="bbc1.uk" group-title="News",UK | BBC One FHD\nhttps://stream.example.invalid/dead.m3u8\n'
                + '#EXTINF:-1 tvg-id="bbc1.uk" group-title="News",UK | BBC One HD\nhttps://stream.example.invalid/live.m3u8\n',
        },
    } });
    await page.reload();
    // The player stand-in records each address it is asked to open, and refuses the dead one.
    await page.evaluate(() => {
        const avplay = window.webapis.avplay;
        const realOpen = avplay.open;
        window.__opened = [];
        avplay.open = function (url) {
            window.__opened.push(url);
            if (/dead\.m3u8$/.test(url)) throw new Error('dead copy');
            return realOpen.apply(this, arguments);
        };
    });
    await expect(page.locator('.live-row').first()).toContainText('BBC One');
    await press(page, KEY.OK);
    await expect(page.locator('#screen-player')).toHaveClass(/active/);
    await expect.poll(() => page.evaluate(() => window.__opened), { timeout: 60000 }).toEqual([
        'https://stream.example.invalid/dead.m3u8',
        'https://stream.example.invalid/live.m3u8',
    ]);
});

test('channel names: copies whose names clash show their quality in brackets', async ({ page }) => {
    await open(page, { routes: {
        'https://example.com/playlists/demo.m3u': {
            status: 200, type: 'audio/x-mpegurl',
            body: '#EXTM3U\n'
                + '#EXTINF:-1 tvg-id="bbc1.uk" group-title="News",UK | BBC One FHD\nhttps://stream.example.invalid/a.m3u8\n'
                + '#EXTINF:-1 tvg-id="bbc1.uk" group-title="News",UK | BBC One SD\nhttps://stream.example.invalid/b.m3u8\n'
                + '#EXTINF:-1 tvg-id="news.uk" group-title="News",Sky News HD\nhttps://stream.example.invalid/c.m3u8\n',
        },
    } });
    await page.reload();
    const rows = page.locator('.live-row');
    await expect(rows.nth(0)).toContainText('BBC One (FHD)');
    await expect(rows.nth(1)).toContainText('BBC One (SD)');
    await expect(rows.nth(2)).toContainText('Sky News');
    await expect(rows.nth(2)).not.toContainText('(HD)');
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

test('a saved channel reopens after a restart, and a key press does not overflow the stack', async ({ page }) => {
    // Regression: removing a stored value called itself until the stack ran out.
    await open(page);
    await press(page, KEY.OK);
    await expect(page.locator('#screen-player')).toHaveClass(/active/);
    await press(page, KEY.BACK);
    await page.evaluate(() => {
        localStorage.setItem('iptv_reopen_last', '1');
        localStorage.setItem('iptv_reopen_pending', '1');
    });
    const errors = watchPage(page);
    await page.reload();
    await expect(page.locator('.live-row').first()).toBeVisible({ timeout: 15000 });
    await press(page, KEY.DOWN);
    await page.waitForTimeout(300);
    expect(errors, 'page errors').toEqual([]);
    expect(await page.evaluate(() => localStorage.getItem('iptv_reopen_pending'))).toBeNull();
});

// ----- Xtream Codes accounts ---------------------------------------------------
// A made-up Xtream server, answered by the test. Its player_api.php gives the
// live categories and two live channels (three for the second user); the
// login is in every stream address, as real servers write them. A wrong
// password gets the object real servers send instead of a list.
const XT_SERVER = 'http://xtream.example:8080';
const XT_PASS = 'Hunter-42xyz';
const xtApiUrl = (user, pass, action) => `${XT_SERVER}/player_api.php?username=${encodeURIComponent(user)}&password=${encodeURIComponent(pass)}&action=${action}`;
const xtStream = (user, kind, id) => `${XT_SERVER}/${kind}/${user}/${XT_PASS}/${id}`;
const xtCategories = JSON.stringify([{ category_id: '1', category_name: 'UK | News' }, { category_id: '2', category_name: 'UK | Sport' }]);
function xtStreams(extraLive) {
    const rows = [
        { num: 1, name: 'Xtream News', stream_id: 101, stream_icon: '', epg_channel_id: 'news.xt', category_id: '1' },
        { num: 2, name: 'Xtream Sport', stream_id: 102, stream_icon: '', epg_channel_id: 'sport.xt', category_id: '2' },
    ].concat(extraLive ? [{ num: 3, name: 'Xtream Extra', stream_id: 103, category_id: '1' }] : []);
    return JSON.stringify(rows);
}
const json = (body) => ({ status: 200, type: 'application/json', body });
const xtRoutes = {
    [xtApiUrl('tvuser', XT_PASS, 'get_live_categories')]: json(xtCategories),
    [xtApiUrl('tvuser', XT_PASS, 'get_live_streams')]: json(xtStreams()),
    [xtApiUrl('tvuser2', XT_PASS, 'get_live_categories')]: json(xtCategories),
    [xtApiUrl('tvuser2', XT_PASS, 'get_live_streams')]: json(xtStreams(true)),
    [xtApiUrl('tvuser', 'Wr0ng-Pass9', 'get_live_categories')]: json('{"user_info":{"auth":0}}'),
    [xtApiUrl('tvuser', 'Wr0ng-Pass9', 'get_live_streams')]: json('{"user_info":{"auth":0}}'),
};

// Starts the app with only an Xtream account saved and switched on.
async function seedXtream(page) {
    await page.addInitScript((pl) => {
        if (localStorage.getItem('e2e_seeded')) return;
        localStorage.setItem('e2e_seeded', '1');
        localStorage.setItem('iptv_playlists', JSON.stringify([pl]));
        localStorage.setItem('iptv_active_playlist_id', JSON.stringify([pl.id]));
        localStorage.setItem('iptv_auto_update', '0');
        localStorage.setItem('iptv_fast_start', '1');
    }, { id: 'pl_xt', type: 'xtream', name: 'xtream.example', server: XT_SERVER, username: 'tvuser', password: XT_PASS });
}

const inputHasFocus = (page) => page.evaluate(() => document.activeElement.tagName === 'INPUT');
const focusedId = (page) => page.evaluate(() => { const el = document.querySelector('.focused'); return el && el.id; });

test('xtream: an account is added from Settings and its live channels load with their categories', async ({ page }) => {
    const { violations } = await open(page, { routes: xtRoutes });
    await page.click('#navSettings');
    await page.locator('.setting-row', { hasText: 'Add an Xtream Codes account' }).click();
    await expect(page.locator('#screen-add')).toHaveClass(/active/);
    await expect(page.locator('#addPlaylistTitle')).toHaveText('Add Xtream Codes Account');
    await expect(page.locator('#urlInput')).toBeHidden();
    for (const id of ['xtreamServerInput', 'xtreamUserInput', 'xtreamPasswordInput']) {
        await expect(page.locator('#' + id)).toHaveAttribute('aria-label', /Xtream/);
    }
    await expect(page.locator('#xtreamPasswordInput')).toHaveAttribute('type', 'password');

    await page.fill('#xtreamServerInput', ' xtream.example:8080/ ');   // cleaned up to http://xtream.example:8080
    await page.fill('#xtreamUserInput', 'tvuser');
    await page.fill('#xtreamPasswordInput', XT_PASS);
    await page.click('#loadPlaylistBtn');
    await expect(page.locator('#toast')).toContainText('Playlist added');

    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('iptv_playlists')));
    expect(stored[1]).toMatchObject({ type: 'xtream', name: 'xtream.example', server: XT_SERVER, username: 'tvuser', password: XT_PASS });
    const line = page.locator('.setting-line', { hasText: 'xtream.example' });
    await expect(line).toContainText(XT_SERVER + ' · tvuser');
    await expect(line).toContainText('2 channels');
    expect(await page.locator('#settingsRows').innerText()).not.toContain(XT_PASS);

    await page.click('#navLive');
    await expect(page.locator('.live-row')).toHaveCount(6);   // 4 of the test playlist + 2 live
    await press(page, KEY.LEFT);
    await expect(page.locator('.menu-item', { hasText: 'UK | News' })).toHaveCount(1);
    await expect(page.locator('.menu-item', { hasText: 'UK | Sport' })).toHaveCount(1);
    await expect(page.locator('.menu-item', { hasText: 'Films' })).toHaveCount(0);
    expect(violations).toEqual([]);
});

test('xtream: the three fields take browser focus only on OK, so the keyboard stays shut during arrow keys', async ({ page }) => {
    await open(page, { routes: xtRoutes });
    await page.click('#navSettings');
    await page.locator('.setting-row', { hasText: 'Add an Xtream Codes account' }).click();
    expect(await focusedId(page)).toBe('xtreamServerInput');
    expect(await inputHasFocus(page)).toBe(false);
    const path = [[KEY.DOWN, 'xtreamUserInput'], [KEY.DOWN, 'xtreamPasswordInput'], [KEY.DOWN, 'loadPlaylistBtn'],
        [KEY.UP, 'xtreamPasswordInput'], [KEY.UP, 'xtreamUserInput'], [KEY.UP, 'xtreamServerInput']];
    for (const [key, id] of path) {
        await press(page, key);
        expect(await focusedId(page)).toBe(id);
        expect(await inputHasFocus(page), 'keyboard opened on ' + id).toBe(false);
    }
    // OK opens the keyboard on the highlighted field; Done moves on without opening the next one.
    await press(page, KEY.OK);
    expect(await page.evaluate(() => document.activeElement.id)).toBe('xtreamServerInput');
    await press(page, 65376);   // the Samsung keyboard's Done
    expect(await inputHasFocus(page)).toBe(false);
    expect(await focusedId(page)).toBe('xtreamUserInput');
    await press(page, KEY.DOWN);
    await press(page, KEY.OK);
    expect(await page.evaluate(() => document.activeElement.id)).toBe('xtreamPasswordInput');
    await press(page, 65376);   // Done on the last field: on to Save
    expect(await inputHasFocus(page)).toBe(false);
    expect(await focusedId(page)).toBe('loadPlaylistBtn');
});

test('xtream: an account can be edited, switched off and deleted', async ({ page }) => {
    await seedXtream(page);
    await open(page, { routes: xtRoutes });
    await expect(page.locator('.live-row')).toHaveCount(2);
    await page.click('#navSettings');
    const line = page.locator('.setting-line', { hasText: 'xtream.example' });

    await line.locator('.setting-side', { hasText: 'Edit' }).click();
    await expect(page.locator('#addPlaylistTitle')).toHaveText('Edit Xtream Account');
    await expect(page.locator('#xtreamServerInput')).toHaveValue(XT_SERVER);
    await expect(page.locator('#xtreamUserInput')).toHaveValue('tvuser');
    await expect(page.locator('#xtreamPasswordInput')).toHaveValue(XT_PASS);
    await page.fill('#xtreamUserInput', 'tvuser2');
    await page.click('#loadPlaylistBtn');
    await expect(page.locator('#toast')).toContainText('Playlist updated');
    await expect(line).toContainText(XT_SERVER + ' · tvuser2');
    await expect(line).toContainText('3 channels');

    await line.locator('.setting-playlist').click();          // switch off
    await expect(line.locator('.switch')).not.toHaveClass(/\bon\b/);
    expect(await page.evaluate(() => localStorage.getItem('iptv_active_playlist_id'))).toBe('[]');

    await line.locator('.setting-side', { hasText: 'Delete' }).click();
    await page.click('#confirmYesBtn');
    await expect(page.locator('#toast')).toContainText('Playlist removed');
    await expect(page.locator('.setting-playlist')).toHaveCount(0);
    expect(await page.evaluate(() => localStorage.getItem('iptv_playlists'))).toBe('[]');
});

test('xtream: the password stays out of the diagnostics, Settings, About and the Report a problem code', async ({ page }) => {
    await seedXtream(page);
    await open(page, { routes: xtRoutes });
    // Play a channel, then an error that quotes stream and playlist addresses.
    await press(page, KEY.OK);
    await expect(page.locator('#screen-player')).toHaveClass(/active/);
    await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('iptv_log')).join('\n'))).toContain('playing "Xtream News"');
    await press(page, KEY.BACK);
    await page.evaluate(([a, b]) => window.MYTVAPP_ERROR('stream failed: ' + a + ' from ' + b), [xtStream('tvuser', 'live', '101.ts'), xtApiUrl('tvuser', XT_PASS, 'get_live_streams')]);

    const log = await page.evaluate(() => localStorage.getItem('iptv_log'));
    expect(log).toContain('stream failed: ' + XT_SERVER + '/live/tvuser/•••/101.ts');
    expect(log).not.toContain(XT_PASS);
    expect(await page.evaluate(() => localStorage.getItem('iptv_last_error'))).not.toContain(XT_PASS);
    expect(await page.evaluate(() => document.body.innerText)).not.toContain(XT_PASS);   // the on-screen error box too

    await page.click('#navSettings');
    for (const section of ['Playlists', 'About', 'Report a problem']) {
        await page.locator('.settings-cat', { hasText: section }).click();
        await expect(page.locator('#settingsSectionTitle')).toHaveText(section);
        expect(await page.locator('#settingsRows').innerText(), section).not.toContain(XT_PASS);
    }
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
    const body = new URL(found.data).searchParams.get('body');
    expect(body).toContain('stream failed: xtream.example:8080/…');
    expect(found.data).not.toContain(XT_PASS);
    expect(found.data).not.toContain(encodeURIComponent(XT_PASS));
});

test('add playlist: an M3U address is still added and edited through the form, stored as before', async ({ page }) => {
    const { playlistText } = require('./fixtures');
    const first = 'https://lists.example/one.m3u';
    const second = 'https://lists.example/two.m3u';
    await open(page, { routes: {
        [first]: { status: 200, type: 'audio/x-mpegurl', body: playlistText(['#EXTINF:-1 tvg-id="one.demo" group-title="General",One Extra']) },
        [second]: { status: 200, type: 'audio/x-mpegurl', body: playlistText() },
    } });
    await page.click('#navSettings');
    await page.locator('.setting-row', { hasText: 'Add a playlist' }).click();
    await expect(page.locator('#addPlaylistTitle')).toHaveText('Add M3U Playlist');
    await expect(page.locator('#xtreamFields')).toBeHidden();
    await page.fill('#urlInput', first);
    await page.click('#loadPlaylistBtn');
    await expect(page.locator('#toast')).toContainText('Playlist added');
    const line = page.locator('.setting-line', { hasText: 'lists.example' });
    await expect(line).toContainText(first);
    await expect(line).toContainText('5 channels');
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('iptv_playlists')));
    expect(Object.keys(stored[1]).sort()).toEqual(['id', 'name', 'url']);
    expect(stored[1]).toMatchObject({ name: 'lists.example / one.m3u', url: first });

    await line.locator('.setting-side', { hasText: 'Edit' }).click();
    await expect(page.locator('#addPlaylistTitle')).toHaveText('Edit Playlist');
    await expect(page.locator('#urlInput')).toHaveValue(first);
    await page.fill('#urlInput', second);
    await page.click('#loadPlaylistBtn');
    await expect(page.locator('#toast')).toContainText('Playlist updated');
    await expect(line).toContainText(second);
    await expect(line).toContainText('4 channels');
});

test('xtream: a wrong password says so, and the password is not shown or kept in the diagnostics', async ({ page }) => {
    await open(page, { routes: xtRoutes });
    await page.click('#navSettings');
    await page.locator('.setting-row', { hasText: 'Add an Xtream Codes account' }).click();
    await page.fill('#xtreamServerInput', XT_SERVER);
    await page.fill('#xtreamUserInput', 'tvuser');
    await page.fill('#xtreamPasswordInput', 'Wr0ng-Pass9');
    await page.click('#loadPlaylistBtn');
    await expect(page.locator('#toast')).toContainText('did not accept the username or password');
    expect(await page.evaluate(() => document.body.innerText)).not.toContain('Wr0ng-Pass9');
    expect(await page.evaluate(() => localStorage.getItem('iptv_log') || '')).not.toContain('Wr0ng-Pass9');
});

// An app error offers to report it, once per start, in the update notice's corner.
test('report notice: an app error offers a report once, and Report opens Report a problem', async ({ page }) => {
    await open(page);
    await expect(page.locator('#reportNotice')).toBeHidden();
    await page.evaluate(() => window.MYTVAPP_ERROR('test failure'));
    await expect(page.locator('#reportNotice')).toBeVisible();
    await expect(page.locator('#reportNowBtn')).toHaveClass(/focused/);
    await press(page, KEY.OK);
    expect(await activeScreen(page)).toBe('screen-settings');
    await expect(page.locator('.report-layout')).toBeVisible();
    await expect(page.locator('#reportNotice')).toBeHidden();

    // A second error in the same start does not ask again.
    await press(page, KEY.BACK);
    await page.evaluate(() => window.MYTVAPP_ERROR('second failure'));
    await page.waitForTimeout(800);
    await expect(page.locator('#reportNotice')).toBeHidden();
});

test('report notice: waits while a channel is full screen, and Back means Not now', async ({ page }) => {
    await open(page);
    await press(page, KEY.OK);
    await expect(page.locator('#screen-player')).toHaveClass(/active/);
    await page.evaluate(() => window.MYTVAPP_ERROR('error while watching'));
    await page.waitForTimeout(400);
    await expect(page.locator('#reportNotice')).toBeHidden();

    await press(page, KEY.BACK);   // leave full screen
    await expect(page.locator('#reportNotice')).toBeVisible();
    await press(page, KEY.BACK);   // Not now
    await expect(page.locator('#reportNotice')).toBeHidden();
    expect(await activeScreen(page)).toBe('screen-live');
});

// The dark shade behind the full-screen info is part of the info: it shows
// with it and goes with it, so the picture is clear the rest of the time.
test('full screen: the dark shade shows only while the channel info is on screen', async ({ page }) => {
    await open(page);
    await press(page, KEY.OK);
    await expect(page.locator('#screen-player')).toHaveClass(/active/);
    const shade = () => page.evaluate(() => {
        const o = document.getElementById('playerOverlay');
        const cs = getComputedStyle(o);
        return { visible: o.classList.contains('visible'), opacity: cs.opacity, gradient: cs.backgroundImage.indexOf('linear-gradient') !== -1 };
    });
    await press(page, KEY.RIGHT);   // the info bar
    await expect.poll(shade).toEqual({ visible: true, opacity: '1', gradient: true });
    // The info hides by itself a few seconds after the picture plays; the shade goes with it.
    await expect.poll(shade, { timeout: 15000 }).toEqual({ visible: false, opacity: '0', gradient: true });
});
