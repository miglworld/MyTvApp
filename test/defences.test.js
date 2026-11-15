// Defensive regression tests for the parsers: each one asserts that a defence
// holds. They run under `node --test` with no network and no browser.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const guide = require(path.join(__dirname, '..', 'scripts', 'build-guide.js'));
const app = require(path.join(__dirname, '..', 'js', 'main.js'));

const NOW = Date.UTC(2026, 10, 15, 12, 0, 0) / 1000;

// Runs fn and fails if it takes longer than limitMs. Regular expressions that
// backtrack on hostile input show up here as slow calls, not as hangs.
function within(limitMs, fn) {
    const start = process.hrtime.bigint();
    const result = fn();
    const ms = Number(process.hrtime.bigint() - start) / 1e6;
    assert.ok(ms < limitMs, `took ${ms.toFixed(0)} ms, limit ${limitMs} ms`);
    return result;
}

// ---- ReDoS: regular expressions that read playlist text ----------------------

test('ReDoS: attribute parsing stays fast on an unterminated attribute run', () => {
    const line = '#EXTINF:-1 ' + 'a="'.repeat(60000) + ',name';
    within(500, () => app.parseM3U(line + '\nhttp://e/x'));
});

test('ReDoS: stream address check stays fast on a long hostile address', () => {
    const address = 'https://' + 'a'.repeat(200000) + ' ';
    within(500, () => app.isStreamUrl(address));
});

test('ReDoS: logo check stays fast on a long hostile logo address', () => {
    const logo = 'https://' + 'a/'.repeat(100000) + ' x';
    within(500, () => app.parseM3U('#EXTINF:-1 tvg-logo="' + logo + '",n\nhttp://e/x'));
});

test('ReDoS: programme parsing stays fast on many unclosed programme tags', () => {
    const xml = '<tv>' + '<programme start="20261115120000 +0000" stop="20261115130000 +0000" channel="a.pt"><title>x'.repeat(4000);
    within(1000, () => guide.addProgrammes({}, xml, { 'a.pt': true }, NOW, 48));
});

// ---- Prototype keys ----------------------------------------------------------

test('prototype keys: a programme on a channel called __proto__ does not break the build', () => {
    const xml = '<programme start="20261115120000 +0000" stop="20261115130000 +0000" channel="__proto__"><title>Hi</title></programme>';
    const wanted = guide.playlistKeys('#EXTINF:-1 tvg-id="__proto__",x\nhttp://e/x');
    const channels = {};
    assert.doesNotThrow(() => guide.addProgrammes(channels, xml, wanted, NOW, 48));
    assert.strictEqual(({}).Hi, undefined, 'Object.prototype was not changed');
});

test('prototype keys: an attribute named constructor does not change the object it is stored in', () => {
    const ch = app.parseM3U('#EXTINF:-1 constructor="x" tvg-id="a",n\nhttp://e/a')[0];
    assert.equal(ch.name, 'n');
    assert.equal(typeof ({}).constructor, 'function');
});

// ---- Insecure randomness -----------------------------------------------------

test('insecure randomness: no Math.random in shipped code or the guide job', () => {
    for (const dir of ['js', 'scripts']) {
        const root = path.join(__dirname, '..', dir);
        for (const file of fs.readdirSync(root)) {
            if (!/\.js$/.test(file)) continue;
            const text = fs.readFileSync(path.join(root, file), 'utf8');
            assert.ok(!/Math\.random/.test(text), `${dir}/${file} uses Math.random`);
        }
    }
});

// ---- XML: no external entities, no numeric overflow -------------------------

test('XML: an external entity declaration is not resolved', () => {
    const xml = '<!DOCTYPE tv [<!ENTITY x SYSTEM "file:///etc/passwd">]>' +
        '<programme start="20261115120000 +0000" stop="20261115130000 +0000" channel="a.pt"><title>&x;</title></programme>';
    const channels = {};
    guide.addProgrammes(channels, xml, { 'a.pt': true }, NOW, 48);
    assert.equal(channels['a.pt'][0][2], '&x;', 'an undeclared-by-us entity stays literal text');
});

test('XML: an out-of-range numeric character reference does not crash the build', () => {
    const xml = '<programme start="20261115120000 +0000" stop="20261115130000 +0000" channel="a.pt"><title>&#99999999;</title></programme>';
    const channels = {};
    assert.doesNotThrow(() => guide.addProgrammes(channels, xml, { 'a.pt': true }, NOW, 48));
});

// ---- Unicode: identifiers are compared exactly -------------------------------

test('Unicode: a fullwidth lookalike id does not match a real one', () => {
    assert.equal(guide.channelKey('RTP1.pt'), 'rtp1.pt');
    assert.notEqual(guide.channelKey('ＲＴＰ１.pt'), 'rtp1.pt');
});

test('Unicode: a Cyrillic lookalike id does not match a Latin one', () => {
    assert.notEqual(guide.channelKey('РTP1.pt'), 'rtp1.pt');
});

// ---- Markup in playlist text is inert data ----------------------------------

test('markup: playlist names are kept as text, not parsed as markup', () => {
    const ch = app.parseM3U('#EXTINF:-1 group-title="<img src=x onerror=alert(1)>",<img src=x onerror=alert(1)>\nhttp://e/a')[0];
    assert.equal(ch.name, '<img src=x onerror=alert(1)>');
    assert.equal(ch.group, '<img src=x onerror=alert(1)>');
});

// ---- Address checks ---------------------------------------------------------

test('addresses: only real stream schemes are accepted', () => {
    for (const bad of ['javascript:alert(1)', 'data:text/html,x', 'file:///etc/passwd', 'ftp://e/x', '//e/x']) {
        assert.equal(app.isStreamUrl(bad), false, bad);
    }
    assert.equal(app.isStreamUrl('https://e/x.m3u8'), true);
});
