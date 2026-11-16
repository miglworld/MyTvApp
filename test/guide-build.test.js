// Integration test: the whole guide build, from playlist and feed text to the
// published structure, on fixture data. The fake fetch answers only the two
// addresses below; any other address fails the test.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { buildGuide } = require(path.join(__dirname, '..', 'scripts', 'build-guide.js'));

const NOW = Date.UTC(2026, 10, 15, 12, 0, 0) / 1000;
const PLAYLIST = [
    '#EXTM3U',
    '#EXTINF:-1 tvg-id="RTP1.pt@SD" group-title="General",RTP 1',
    'https://stream.example.invalid/rtp1.m3u8',
    '#EXTINF:-1 tvg-id="SIC.pt@HD" group-title="General",SIC',
    'https://stream.example.invalid/sic.m3u8',
    '#EXTINF:-1 tvg-id="Nothing.pt" group-title="General",No guide',
    'https://stream.example.invalid/none.m3u8'
].join('\n');

const programme = (start, stop, channel, title, desc) =>
    '<programme start="' + start + ' +0000" stop="' + stop + ' +0000" channel="' + channel + '">' +
    '<title lang="pt">' + title + '</title>' + (desc ? '<desc>' + desc + '</desc>' : '') + '</programme>';

const FEED = [
    '<tv>',
    '<channel id="RTP1.pt"><display-name>RTP 1</display-name></channel>',
    '<channel id="SIC.pt"><display-name>SIC</display-name></channel>',
    programme('20261115115000', '20261115123000', 'RTP1.pt', 'Bom Dia &amp; Boa Tarde', 'Noticias'),
    programme('20261115123000', '20261115133000', 'RTP1.pt', 'Praca da Alegria', new Array(80).join('palavra ')),
    programme('20261115120000', '20261115130000', 'SIC.pt', 'Casa Feliz'),
    programme('20261101000000', '20261101010000', 'SIC.pt', 'Last month'),   // outside the window
    programme('20261115120000', '20261115130000', 'Unwanted.pt', 'Not in the playlists'),
    '</tv>'
].join('\n');

const ROUTES = {
    'https://iptv-org.github.io/iptv/countries/pt.m3u': PLAYLIST,
    'https://iptv-epg.org/files/epg-pt.xml': FEED
};

function fakeFetch(url) {
    if (!Object.prototype.hasOwnProperty.call(ROUTES, url)) {
        return Promise.reject(new Error('the build tried an address it should not: ' + url));
    }
    return Promise.resolve({
        status: 200, ok: true,
        headers: { get: function () { return null; } },
        text: function () { return Promise.resolve(ROUTES[url]); }
    });
}

const CONFIG = {
    playlists: ['https://iptv-org.github.io/iptv/countries/pt.m3u'],
    feeds: ['https://iptv-epg.org/files/epg-pt.xml'],
    hours: 48
};

test('build: keeps only playlist channels, inside the window, in time order', async () => {
    const built = await buildGuide(CONFIG, fakeFetch, NOW);
    assert.deepEqual(Object.keys(built.channels).sort(), ['rtp1.pt', 'sic.pt']);
    assert.equal(built.total, 3);
    assert.deepEqual(built.channels['sic.pt'].map(function (e) { return e[2]; }), ['Casa Feliz']);
    const starts = built.channels['rtp1.pt'].map(function (e) { return e[0]; });
    assert.deepEqual(starts, starts.slice().sort(function (a, b) { return a - b; }));
});

test('build: titles are decoded and long descriptions are cut', async () => {
    const built = await buildGuide(CONFIG, fakeFetch, NOW);
    const rtp = built.channels['rtp1.pt'];
    assert.equal(rtp[0][2], 'Bom Dia & Boa Tarde');
    assert.ok(rtp[1][3].length <= 200, 'description cut to 200 characters');
});

test('build: a feed with nothing in the window fails, so the old guide stays', async () => {
    const empty = '<tv><programme start="20250101000000 +0000" stop="20250101010000 +0000" channel="RTP1.pt"><title>Old</title></programme></tv>';
    const fetchEmpty = function (url) {
        if (url === CONFIG.feeds[0]) return Promise.resolve({ status: 200, ok: true, headers: { get: () => null }, text: () => Promise.resolve(empty) });
        return fakeFetch(url);
    };
    await assert.rejects(buildGuide(CONFIG, fetchEmpty, NOW), /no programmes found/);
});

test('build: an address outside the allowed hosts stops the build before any fetch', async () => {
    const bad = Object.assign({}, CONFIG, { feeds: ['https://example.com/guide.xml'] });
    let fetched = 0;
    const counting = function (url) { fetched++; return fakeFetch(url); };
    await assert.rejects(buildGuide(bad, counting, NOW), /host not allowed: example\.com/);
    assert.equal(fetched, 1, 'only the playlist was fetched; the bad feed never was');
});
