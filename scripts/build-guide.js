#!/usr/bin/env node
// Builds the small programme guide the TV downloads.
//
// A full XMLTV guide for one country is tens of MB: every channel, a week of
// programmes, long descriptions, artwork. A TV cannot download and read that
// at every start. This script keeps only the channels that are in the
// playlists listed in guide/config.json and only the next hours, and writes
// them as compact JSON:
//
//   { "generated": <seconds since 1970>, "hours": 48,
//     "channels": { "rtp1.pt": [[<start, minutes since 1970>, <length, minutes>, "Title", "Description"], ...] } }
//
// Channels are matched by the playlist's tvg-id without its "@..." ending,
// in lower case ("RTP1.pt@SD" -> "rtp1.pt"), which is how the guide names them.
//
// Run by .github/workflows/guide.yml on a schedule; by hand:
//   node scripts/build-guide.js out/guide.json
'use strict';
var fs = require('fs');
var path = require('path');
// Which playlists and feeds to use. Loaded as part of the program, and every
// address in it is checked against ALLOWED_HOSTS below before it is fetched.
var config = require('../guide/config.json');

// The only servers this job downloads from. guide/config.json chooses among
// them; it cannot send the job anywhere else. A feed on a new server means
// adding its host here, in code that is reviewed.
var ALLOWED_HOSTS = ['iptv-org.github.io', 'iptv-epg.org'];

var DESCRIPTION_MAX = 200;
var PAST_HOURS = 3;   // keep what started a little while ago: it may still be on

// A character reference outside Unicode becomes the replacement character
// instead of throwing: one bad title must not stop the whole build.
function codePoint(n) {
    return n <= 0x10FFFF ? String.fromCodePoint(n) : '\uFFFD';
}

function decodeXml(s) {
    return String(s)
        .replace(/&#(\d{1,8});/g, function (m, n) { return codePoint(Number(n)); })
        .replace(/&#x([0-9a-f]{1,8});/gi, function (m, n) { return codePoint(parseInt(n, 16)); })
        .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
        .replace(/&amp;/g, '&');
}

// "RTP1.pt@SD" -> "rtp1.pt"
function channelKey(tvgId) {
    return String(tvgId || '').split('@')[0].trim().toLowerCase();
}

// Maps here have no inherited names (no __proto__, constructor...), so a
// channel called "__proto__" is an ordinary key.
function has(object, key) {
    return Object.prototype.hasOwnProperty.call(object, key);
}

// The channel keys a playlist asks for.
function playlistKeys(m3u) {
    var keys = Object.create(null);
    var re = /tvg-id="([^"]*)"/g;
    var m;
    while ((m = re.exec(m3u)) !== null) {
        var key = channelKey(m[1]);
        if (key) keys[key] = true;
    }
    return keys;
}

// "20261112125800 +0000" -> seconds since 1970, or NaN.
function parseXmltvTime(text) {
    var m = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})?\s*([+-]\d{4})?/.exec(String(text || '').trim());
    if (!m) return NaN;
    var seconds = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0)) / 1000;
    if (m[7]) {
        var sign = m[7].charAt(0) === '-' ? -1 : 1;
        seconds -= sign * (parseInt(m[7].slice(1, 3), 10) * 3600 + parseInt(m[7].slice(3, 5), 10) * 60);
    }
    return seconds;
}

function attribute(attrs, name) {
    var m = new RegExp('\\b' + name + '="([^"]*)"').exec(attrs);
    return m ? m[1] : '';
}

function element(body, name) {
    var m = new RegExp('<' + name + '\\b[^>]*>([\\s\\S]*?)</' + name + '>').exec(body);
    return m ? decodeXml(m[1]).replace(/\s+/g, ' ').trim() : '';
}

// Adds the wanted programmes of one XMLTV text to `channels`.
// wanted: { key: true }; nowSeconds: the present; hours: how far ahead to keep.
function addProgrammes(channels, xml, wanted, nowSeconds, hours) {
    var from = nowSeconds - PAST_HOURS * 3600;
    var until = nowSeconds + hours * 3600;
    var re = /<programme\b([^>]*)>([\s\S]*?)<\/programme>/g;
    var m;
    var added = 0;
    while ((m = re.exec(xml)) !== null) {
        var key = channelKey(decodeXml(attribute(m[1], 'channel')));
        if (!has(wanted, key)) continue;
        var start = parseXmltvTime(attribute(m[1], 'start'));
        var stop = parseXmltvTime(attribute(m[1], 'stop'));
        if (!(stop > start) || stop <= from || start >= until) continue;
        var title = element(m[2], 'title');
        if (!title) continue;
        var entry = [Math.round(start / 60), Math.round((stop - start) / 60), title];
        var description = element(m[2], 'desc');
        if (description && description !== title) {
            entry.push(description.length > DESCRIPTION_MAX ? description.slice(0, DESCRIPTION_MAX - 1).trim() + '…' : description);
        }
        if (!has(channels, key)) {
            Object.defineProperty(channels, key, { value: [], enumerable: true, writable: true, configurable: true });
        }
        channels[key].push(entry);
        added++;
    }
    return added;
}

// In order of start, without programmes that start at the same minute twice
// (two feeds, or a feed that repeats itself).
function tidy(channels) {
    Object.keys(channels).forEach(function (key) {
        var seen = {};
        channels[key] = channels[key]
            .sort(function (a, b) { return a[0] - b[0]; })
            .filter(function (e) { if (seen[e[0]]) return false; seen[e[0]] = true; return true; });
    });
    return channels;
}

// The address to fetch for a configured source: HTTPS, on an allowed host and
// the default port, with no login. Returns the address rebuilt from its parsed
// parts. Throws for anything else.
function sourceUrl(address) {
    var url;
    try { url = new URL(String(address)); } catch (e) { throw new Error('not an address: ' + address); }
    if (url.protocol !== 'https:') throw new Error('not an HTTPS address: ' + address);
    if (ALLOWED_HOSTS.indexOf(url.hostname) === -1) throw new Error('host not allowed: ' + url.hostname);
    if (url.port && url.port !== '443') throw new Error('port not allowed: ' + url.port);
    if (url.username || url.password) throw new Error('address must not carry a login: ' + url.hostname);
    return 'https://' + url.hostname + url.pathname + url.search;
}

var MAX_REDIRECTS = 3;

// Fetches one source and resolves to its text. Redirects are followed by hand,
// so every address the job reaches, not only the first one, passes sourceUrl.
// A failure is a rejected promise, never a throw, so main() reports it the same
// way for playlists and feeds. fetchImpl is injectable for the tests.
function fetchSource(address, fetchImpl, redirects) {
    return Promise.resolve().then(function () {
        var url = sourceUrl(address);
        return fetchImpl(url, { redirect: 'manual' }).then(function (res) {
            var status = res.status;
            var location = res.headers.get('location');
            if (status >= 300 && status < 400 && location) {
                if (redirects >= MAX_REDIRECTS) throw new Error('too many redirects for ' + url);
                return fetchSource(new URL(location, url).href, fetchImpl, redirects + 1);
            }
            if (!res.ok) throw new Error('HTTP ' + status + ' for ' + url);
            return res.text();
        });
    });
}

// Builds the guide in memory from the configured playlists and feeds. fetchImpl
// and now are parameters so tests can run the whole build on fixtures, with no
// network. Rejects if nothing was found: the published guide then stays as it is.
function buildGuide(config, fetchImpl, now, log) {
    var hours = config.hours || 48;
    var wanted = Object.create(null);
    var channels = Object.create(null);
    log = log || function () {};

    return Promise.all(config.playlists.map(function (address) {
        return fetchSource(address, fetchImpl, 0);
    })).then(function (playlists) {
        playlists.forEach(function (m3u) { Object.assign(wanted, playlistKeys(m3u)); });
        log('channels in the playlists: ' + Object.keys(wanted).length);
        // One feed after another: each is large.
        return config.feeds.reduce(function (chain, address) {
            return chain.then(function () { return fetchSource(address, fetchImpl, 0); }).then(function (xml) {
                var added = addProgrammes(channels, xml, wanted, now, hours);
                log(address + ': ' + (xml.length / 1e6).toFixed(1) + ' MB, ' + added + ' programmes kept');
            });
        }, Promise.resolve());
    }).then(function () {
        tidy(channels);
        var total = Object.keys(channels).reduce(function (n, k) { return n + channels[k].length; }, 0);
        if (!total) throw new Error('no programmes found for any channel');
        return { hours: hours, channels: channels, total: total };
    });
}

function main() {
    var out = process.argv[2] || 'guide.json';
    var now = Math.floor(Date.now() / 1000);
    return buildGuide(config, fetch, now, console.log).then(function (built) {
        var json = JSON.stringify({ generated: now, hours: built.hours, channels: built.channels });
        fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
        fs.writeFileSync(out, json);
        console.log('wrote ' + out + ': ' + Object.keys(built.channels).length + ' channels, ' + built.total + ' programmes, ' +
            Math.round(Buffer.byteLength(json) / 1024) + ' KB');
    });
}

module.exports = { buildGuide: buildGuide, sourceUrl: sourceUrl, fetchSource: fetchSource, channelKey: channelKey, playlistKeys: playlistKeys, parseXmltvTime: parseXmltvTime, addProgrammes: addProgrammes, tidy: tidy };

if (require.main === module) {
    main().catch(function (err) { console.error('guide not built: ' + err.message); process.exit(1); });
}
