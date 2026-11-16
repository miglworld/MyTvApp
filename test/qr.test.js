// Settings > Report a problem: the QR encoder and the issue address.
// Every code is decoded with jsQR, a QR reader written independently of the
// app's encoder, so a wrong table or mask shows up as a failed read.
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const jsQR = require('jsqr');
const app = require('../js/main.js');

const MODULE_PX = 4;
const MARGIN = 4;

// Draws the matrix the way the TV does (black on white, light margin) and
// reads it back.
function decode(matrix) {
    const side = (matrix.length + MARGIN * 2) * MODULE_PX;
    const pixels = new Uint8ClampedArray(side * side * 4).fill(255);
    matrix.forEach((row, y) => row.forEach((dark, x) => {
        if (!dark) return;
        for (let dy = 0; dy < MODULE_PX; dy++) {
            for (let dx = 0; dx < MODULE_PX; dx++) {
                const i = (((y + MARGIN) * MODULE_PX + dy) * side + (x + MARGIN) * MODULE_PX + dx) * 4;
                pixels[i] = pixels[i + 1] = pixels[i + 2] = 0;
            }
        }
    }));
    const found = jsQR(pixels, side, side, { inversionAttempts: 'dontInvert' });
    return found ? found.data : null;
}

// Level L capacity in bytes for versions 1 to 20, from the QR standard.
const CAPACITY = [17, 32, 53, 78, 106, 134, 154, 192, 230, 271, 321, 367, 425, 458, 520, 586, 644, 718, 792, 858];

function text(length, seed) {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-._~%+&=?/:';
    let s = '', x = seed;
    for (let i = 0; i < length; i++) { x = (x * 1103515245 + 12345) % 2147483648; s += chars[x % chars.length]; }
    return s;
}

test('every version from 1 to 20 reads back exactly, at its full capacity and one byte over the previous', () => {
    CAPACITY.forEach((capacity, i) => {
        const version = i + 1;
        [capacity, (CAPACITY[i - 1] || 0) + 1].forEach((length, n) => {
            const input = text(length, version * 10 + n);
            const matrix = app.qrMatrix(input);
            assert.ok(matrix, 'version ' + version + ', ' + length + ' bytes: no code');
            assert.strictEqual(matrix.length, version * 4 + 17, length + ' bytes should need version ' + version);
            assert.strictEqual(decode(matrix), input, 'version ' + version + ', ' + length + ' bytes');
        });
    });
});

test('text that is not plain ASCII reads back (UTF-8)', () => {
    const input = 'Canal 1 — notícias € ✓';
    assert.strictEqual(decode(app.qrMatrix(input)), input);
});

test('more than version 20 holds gives no code', () => {
    assert.strictEqual(app.qrMatrix(text(859, 1)), null);
});

const BASE = 'https://github.com/miglworld/MyTvApp/issues/new';
const FACTS = [['Version', '0.12.4'], ['Last app error', 'none']];

test('addresses are cut to their server, logins included', () => {
    assert.strictEqual(
        app.redactAddresses('playlist failed: http://user:secret@iptv.example:8080/get.php?username=a&password=b (HTTP 403)'),
        'playlist failed: iptv.example:8080/… (HTTP 403)');
    assert.strictEqual(app.redactAddresses('no address here'), 'no address here');
});

test('the issue address carries the facts and the redacted events, and its code reads back', () => {
    const lines = ['12:00:01 start', '12:00:02 load https://host.example/list.m3u?token=abc'];
    const link = app.reportLink(BASE, 'MyTvApp 0.12.4: ', FACTS, lines, 850);
    const query = new URL(link.url).searchParams;
    assert.strictEqual(query.get('title'), 'MyTvApp 0.12.4: ');
    assert.strictEqual(query.get('body'), link.body);
    assert.match(link.body, /- Version: 0\.12\.4/);
    assert.match(link.body, /host\.example\/…/);
    assert.doesNotMatch(link.url, /token|abc/);
    assert.strictEqual(decode(app.qrMatrix(link.url)), link.url);
});

test('a long diagnostics list loses its oldest lines until the address fits', () => {
    const lines = [];
    for (let i = 0; i < 20; i++) lines.push('12:00:' + String(i).padStart(2, '0') + ' channel ' + i + ' did not start: the stream stopped answering');
    const link = app.reportLink(BASE, 'MyTvApp 0.12.4: ', FACTS, lines, 850);
    assert.ok(link.url.length <= 850, 'address is ' + link.url.length + ' characters');
    assert.match(link.body, /channel 19 did not start/, 'the newest line stays');
    assert.doesNotMatch(link.body, /channel 0 did not start/, 'the oldest line goes');
    assert.ok(app.qrMatrix(link.url), 'still fits a code');
});
