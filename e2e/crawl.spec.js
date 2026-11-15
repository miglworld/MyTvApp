// Crawler: clicks every visible control on each screen. Each click runs in a new
// browser context with empty storage, so a click that changes a setting (for
// example switching the test playlist off) cannot affect the next one. Fails
// on any page error, console error or blocked request. Controls that change
// nothing visible are written to e2e-crawl.json for review; they do not fail
// the run (on a TV, many controls are driven by the remote, not by clicks).
'use strict';
const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');
const { seedScript, lockNetwork, press, KEY, watchPage } = require('./fixtures');

const REPORT = path.join(__dirname, '..', 'e2e-crawl.json');
// CRAWL_STATES="live,guide" limits the run to some screens, for debugging.
const ONLY = (process.env.CRAWL_STATES || '').split(',').filter(Boolean);

const toRootMenu = async (page) => { await press(page, KEY.LEFT); await press(page, KEY.LEFT); };
const toSettings = (section) => async (page) => {
    await page.click('#navSettings');
    if (section) await page.locator('.settings-cat', { hasText: section }).click();
};

// Each state says how to reach a screen and which controls to try there.
const STATES = [
    { name: 'live', steps: async () => {}, selector: '.live-row' },
    { name: 'live menu', steps: async (page) => { await press(page, KEY.LEFT); }, selector: '.menu-sub .menu-item' },
    { name: 'root menu', steps: toRootMenu, selector: '.menu-root .menu-item' },
    {
        name: 'guide',
        steps: async (page) => { await page.click('#navGuide'); await expect(page.locator('.guide-cell').first()).toBeVisible({ timeout: 15000 }); },
        selector: '.guide-cell',
    },
    { name: 'favorites', steps: async (page) => { await toRootMenu(page); await page.click('#navFavorites'); }, selector: '.live-row' },
    { name: 'settings: playlists', steps: toSettings(null), selector: '#settingsRows button, .settings-cat' },
    { name: 'settings: playback', steps: toSettings('Playback'), selector: '#settingsRows button' },
    { name: 'settings: channels', steps: toSettings('Channels'), selector: '#settingsRows button' },
    { name: 'settings: updates', steps: toSettings('Updates'), selector: '#settingsRows button' },
    { name: 'settings: about', steps: toSettings('About'), selector: '#settingsRows button' },
];

// A new context with empty storage, the test playlist seeded, the network
// locked to localhost, and the app started with its channel list drawn.
async function freshPage(browser) {
    const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, baseURL: 'http://127.0.0.1:8765' });
    const page = await context.newPage();
    await page.addInitScript(seedScript({}));
    const violations = await lockNetwork(page);
    const errors = watchPage(page);
    await page.goto('/index.html');
    await expect(page.locator('.live-row').first()).toBeVisible({ timeout: 15000 });
    return { context, page, violations, errors };
}

test('crawler: every visible control in every screen responds without errors', async ({ browser }) => {
    test.setTimeout(1200000);
    const report = [];

    for (const state of STATES.filter((s) => !ONLY.length || ONLY.includes(s.name))) {
        const stateStart = Date.now();
        let s = await freshPage(browser);
        await state.steps(s.page);
        const count = await s.page.locator(state.selector).filter({ visible: true }).count();
        await s.context.close();
        console.log(`crawler: ${state.name}: ${count} controls`);

        for (let i = 0; i < count; i++) {
            s = await freshPage(browser);
            const { page, violations, errors } = s;
            await state.steps(page);
            const control = page.locator(state.selector).filter({ visible: true }).nth(i);
            const label = ((await control.textContent()) || '').replace(/\s+/g, ' ').trim().slice(0, 60);

            const errorsBefore = errors.length;
            const violationsBefore = violations.length;
            const snapshot = () => page.evaluate(() => document.getElementById('app').innerHTML + '|' + document.querySelector('.screen.active').id);
            const before = await snapshot();
            await control.click({ timeout: 5000 }).catch((e) => errors.push('click failed on "' + label + '": ' + e.message.split('\n')[0]));
            await page.waitForTimeout(300);
            const after = await snapshot();

            const problems = errors.slice(errorsBefore).concat(violations.slice(violationsBefore).map((u) => 'blocked request: ' + u));
            report.push({
                state: state.name,
                index: i,
                label,
                outcome: problems.length ? 'error' : (before === after ? 'no visible change' : 'ok'),
                problems,
            });
            await s.context.close();
        }
        console.log(`crawler: ${state.name}: done in ${((Date.now() - stateStart) / 1000).toFixed(1)} s`);
    }

    fs.writeFileSync(REPORT, JSON.stringify(report, null, 2));
    const failed = report.filter((r) => r.outcome === 'error');
    const inert = report.filter((r) => r.outcome === 'no visible change');
    console.log(`crawler: ${report.length} controls tried, ${failed.length} with errors, ${inert.length} with no visible change (see e2e-crawl.json)`);
    expect(failed, JSON.stringify(failed, null, 2)).toEqual([]);
});
