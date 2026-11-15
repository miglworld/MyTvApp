// Lint rules. The app script must stay plain ES5: older Samsung TVs run an old
// browser engine, so newer syntax (const, arrow functions, classes) would stop
// the app from starting there. Everything that runs in Node may use modern
// JavaScript.
'use strict';
const js = require('@eslint/js');
const globals = require('globals');

module.exports = [
    { ignores: ['lib/**', 'node_modules/**', 'test-results/**', 'playwright-report/**', '_shots/**', 'lighthouse/**'] },
    js.configs.recommended,
    {
        files: ['js/**/*.js'],
        languageOptions: {
            ecmaVersion: 5,
            sourceType: 'script',
            globals: {
                ...globals.browser,
                tizen: 'readonly',     // Samsung TV API
                webapis: 'readonly',   // Samsung TV API (the AVPlay player)
                Hls: 'readonly',       // lib/hls.min.js
                Promise: 'readonly',   // not ES5 syntax, but every supported TV browser has it
                module: 'writable',    // set only when the tests load the script in Node
            },
        },
        rules: {
            // ES5 requires a name in catch (e) even when the error is not used.
            'no-unused-vars': ['error', { caughtErrors: 'none' }],
        },
    },
    {
        files: ['scripts/**/*.js', 'test/**/*.js', 'e2e/**/*.js', 'perf/**/*.js', '*.config.js'],
        languageOptions: { ecmaVersion: 2022, sourceType: 'commonjs', globals: { ...globals.node } },
    },
    {
        // Callbacks in page.evaluate() run inside the browser page.
        files: ['e2e/**/*.js'],
        languageOptions: { globals: { ...globals.browser } },
    },
];
