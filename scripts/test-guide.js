// Tests for scripts/build-guide.js. Run with: node scripts/test-guide.js
'use strict';
var assert = require('assert');
var guide = require('./build-guide.js');

var passed = 0;
var pending = [];
function test(name, fn) {
    try { fn(); passed++; } catch (e) {
        console.error('FAIL: ' + name + '\n  ' + e.message);
        process.exitCode = 1;
    }
}
// For tests that wait on a promise (the download path).
function testAsync(name, fn) {
    pending.push(fn().then(function () { passed++; }, function (e) {
        console.error('FAIL: ' + name + '\n  ' + e.message);
        process.exitCode = 1;
    }));
}

// A stand-in for fetch: answers from a table of addresses.
function fakeFetch(routes) {
    return function (url) {
        var r = routes[url];
        if (!r) return Promise.reject(new Error('unexpected fetch of ' + url));
        var status = r.status || 200;
        return Promise.resolve({
            status: status,
            ok: status >= 200 && status < 300,
            headers: { get: function (name) { return name.toLowerCase() === 'location' ? (r.location || null) : null; } },
            text: function () { return Promise.resolve(r.body || ''); }
        });
    };
}
function expectRejects(promise, pattern) {
    return promise.then(function () { throw new Error('expected a failure matching ' + pattern); }, function (e) {
        if (!pattern.test(e.message)) throw new Error('wrong failure: ' + e.message);
    });
}

var NOW = Date.UTC(2026, 10, 12, 12, 0, 0) / 1000;   // 12 Nov 2026, 12:00 UTC

test('channel key: no "@" ending, lower case', function () {
    assert.strictEqual(guide.channelKey('RTP1.pt@SD'), 'rtp1.pt');
    assert.strictEqual(guide.channelKey('AXNWhite.us@Portugal'), 'axnwhite.us');
    assert.strictEqual(guide.channelKey(''), '');
});

test('playlist keys', function () {
    var keys = guide.playlistKeys('#EXTINF:-1 tvg-id="RTP1.pt@SD",RTP 1\nhttp://e/a\n#EXTINF:-1 tvg-id="",none\nhttp://e/b\n#EXTINF:-1 tvg-id="SIC.pt",SIC\nhttp://e/c');
    assert.deepStrictEqual(Object.keys(keys).sort(), ['rtp1.pt', 'sic.pt']);
});

test('XMLTV times, with and without an offset', function () {
    assert.strictEqual(guide.parseXmltvTime('20261112120000 +0000'), NOW);
    assert.strictEqual(guide.parseXmltvTime('20261112130000 +0100'), NOW);
    assert.strictEqual(guide.parseXmltvTime('20261112070000 -0500'), NOW);
    assert.strictEqual(guide.parseXmltvTime('20261112120000'), NOW);
    assert.ok(isNaN(guide.parseXmltvTime('soon')));
});

test('sources: HTTPS on an allowed host, nothing else', function () {
    assert.strictEqual(guide.sourceUrl('https://iptv-epg.org/files/epg-pt.xml'), 'https://iptv-epg.org/files/epg-pt.xml');
    assert.strictEqual(guide.sourceUrl('https://iptv-org.github.io/iptv/countries/pt.m3u?x=1'), 'https://iptv-org.github.io/iptv/countries/pt.m3u?x=1');
    assert.throws(function () { guide.sourceUrl('http://iptv-epg.org/files/epg-pt.xml'); }, /HTTPS/);
    assert.throws(function () { guide.sourceUrl('https://example.com/guide.xml'); }, /not allowed/);
    assert.throws(function () { guide.sourceUrl('https://iptv-epg.org.example.com/x'); }, /not allowed/);
    assert.throws(function () { guide.sourceUrl('https://user:pw@iptv-epg.org/x'); }, /login/);
    assert.throws(function () { guide.sourceUrl('file:///etc/passwd'); }, /HTTPS/);
    assert.throws(function () { guide.sourceUrl('guide.xml'); }, /not an address/);
});

test('a port other than 443 is refused', function () {
    assert.throws(function () { guide.sourceUrl('https://iptv-epg.org:8443/x.xml'); }, /port not allowed/);
    assert.strictEqual(guide.sourceUrl('https://iptv-epg.org:443/x.xml'), 'https://iptv-epg.org/x.xml');
});

testAsync('a source on an allowed host is downloaded', function () {
    var f = guide.fetchSource('https://iptv-epg.org/files/epg-pt.xml', fakeFetch({
        'https://iptv-epg.org/files/epg-pt.xml': { body: '<tv/>' }
    }), 0);
    return f.then(function (text) { assert.strictEqual(text, '<tv/>'); });
});

testAsync('a redirect to another allowed host is followed', function () {
    var f = guide.fetchSource('https://iptv-epg.org/a.xml', fakeFetch({
        'https://iptv-epg.org/a.xml': { status: 301, location: 'https://iptv-org.github.io/b.xml' },
        'https://iptv-org.github.io/b.xml': { body: 'moved' }
    }), 0);
    return f.then(function (text) { assert.strictEqual(text, 'moved'); });
});

testAsync('a relative redirect is resolved against the address it came from', function () {
    var f = guide.fetchSource('https://iptv-epg.org/a.xml', fakeFetch({
        'https://iptv-epg.org/a.xml': { status: 302, location: '/files/b.xml' },
        'https://iptv-epg.org/files/b.xml': { body: 'relative' }
    }), 0);
    return f.then(function (text) { assert.strictEqual(text, 'relative'); });
});

testAsync('a redirect to a host outside the list is refused, not followed', function () {
    var routes = {
        'https://iptv-epg.org/a.xml': { status: 301, location: 'https://attacker.example/guide.xml' },
        'https://attacker.example/guide.xml': { body: '<tv>poisoned</tv>' }
    };
    return expectRejects(guide.fetchSource('https://iptv-epg.org/a.xml', fakeFetch(routes), 0), /host not allowed: attacker\.example/);
});

testAsync('a redirect to plain HTTP is refused', function () {
    var routes = { 'https://iptv-epg.org/a.xml': { status: 301, location: 'http://iptv-epg.org/a.xml' } };
    return expectRejects(guide.fetchSource('https://iptv-epg.org/a.xml', fakeFetch(routes), 0), /not an HTTPS address/);
});

testAsync('redirects that loop stop after a few hops', function () {
    var routes = { 'https://iptv-epg.org/a.xml': { status: 301, location: 'https://iptv-epg.org/a.xml' } };
    return expectRejects(guide.fetchSource('https://iptv-epg.org/a.xml', fakeFetch(routes), 0), /too many redirects/);
});

testAsync('a bad address is a rejected promise, not a throw', function () {
    var p;
    assert.doesNotThrow(function () { p = guide.fetchSource('https://example.com/x.xml', fakeFetch({}), 0); });
    return expectRejects(p, /host not allowed: example\.com/);
});

testAsync('an error status is reported with its address', function () {
    var routes = { 'https://iptv-epg.org/a.xml': { status: 404 } };
    return expectRejects(guide.fetchSource('https://iptv-epg.org/a.xml', fakeFetch(routes), 0), /HTTP 404 for https:\/\/iptv-epg\.org\/a\.xml/);
});

test('every source in guide/config.json is allowed', function () {
    var config = require('../guide/config.json');
    config.playlists.concat(config.feeds).forEach(function (u) { guide.sourceUrl(u); });
});

var XML = [
    '<tv>',
    '<channel id="RTP1.pt"><display-name>RTP 1</display-name></channel>',
    '<programme start="20261112115800 +0000" stop="20261112132500 +0000" channel="RTP1.pt">',
    '  <title lang="pt">Jornal da Tarde</title><desc lang="pt">Not&#237;cias &amp; desporto</desc>',
    '  <icon src="https://example.com/a.png" /></programme>',
    '<programme start="20261112132500 +0000" stop="20261112140000 +0000" channel="RTP1.pt"><title>Hora da Sorte</title></programme>',
    '<programme start="20261112132500 +0000" stop="20261112140000 +0000" channel="RTP1.pt"><title>Hora da Sorte (repeat)</title></programme>',
    '<programme start="20261111060000 +0000" stop="20261111070000 +0000" channel="RTP1.pt"><title>Yesterday</title></programme>',
    '<programme start="20261120060000 +0000" stop="20261120070000 +0000" channel="RTP1.pt"><title>Next week</title></programme>',
    '<programme start="20261112120000 +0000" stop="20261112130000 +0000" channel="Other.pt"><title>Not wanted</title></programme>',
    '<programme start="20261112140000 +0000" stop="20261112140000 +0000" channel="RTP1.pt"><title>No length</title></programme>',
    '<programme start="20261112150000 +0000" stop="20261112160000 +0000" channel="RTP1.pt"><desc>No title</desc></programme>',
    '</tv>'
].join('\n');

test('keeps wanted channels inside the time window, tidied', function () {
    var channels = {};
    guide.addProgrammes(channels, XML, { 'rtp1.pt': true }, NOW, 48);
    guide.tidy(channels);
    assert.deepStrictEqual(Object.keys(channels), ['rtp1.pt']);
    var list = channels['rtp1.pt'];
    assert.deepStrictEqual(list.map(function (e) { return e[2]; }), ['Jornal da Tarde', 'Hora da Sorte']);
    assert.strictEqual(list[0][0], (NOW - 120) / 60);      // start, in minutes
    assert.strictEqual(list[0][1], 87);                    // length, in minutes
    assert.strictEqual(list[0][3], 'Notícias & desporto');
    assert.strictEqual(list[1].length, 3);                 // no description: no fourth field
});

test('long descriptions are cut', function () {
    var long = new Array(60).join('palavra ');
    var channels = {};
    guide.addProgrammes(channels, '<programme start="20261112120000 +0000" stop="20261112130000 +0000" channel="A.pt"><title>T</title><desc>' + long + '</desc></programme>', { 'a.pt': true }, NOW, 48);
    assert.ok(channels['a.pt'][0][3].length <= 200);
    assert.strictEqual(channels['a.pt'][0][3].slice(-1), '…');
});

Promise.all(pending).then(function () {
    if (!process.exitCode) console.log(passed + ' guide tests passed');
});
