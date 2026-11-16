// End-to-end tests run the app's own index.html in Chromium, served from this
// repository on localhost only. Every other address is blocked by the tests
// (see e2e/fixtures.js), so no test reaches a third-party host.
'use strict';
const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
    testDir: 'e2e',
    timeout: 60000,
    retries: 0,
    workers: 1,
    reporter: [['list'], ['json', { outputFile: 'e2e-results.json' }]],
    use: {
        baseURL: 'http://127.0.0.1:8765',
        viewport: { width: 1920, height: 1080 },
        trace: 'retain-on-failure',
        // No action may wait forever for a control that never becomes clickable.
        actionTimeout: 10000,
        navigationTimeout: 20000,
    },
    webServer: {
        command: 'python3 -m http.server 8765 --bind 127.0.0.1',
        url: 'http://127.0.0.1:8765/index.html',
        reuseExistingServer: true,
        timeout: 30000,
    },
});
