// Performance smoke test: times the work that grows with the size of the data.
// It runs the code of the checkout it lives in, on generated data of a fixed
// size, and prints the median of several runs as JSON.
//
//   node perf/bench.js > head.json
//
// CI runs it on the pull request and on its base, on the same machine, and
// perf/compare.js fails the check when the pull request is slower by more than
// the allowed percentage. Comparing on one machine keeps runner speed out of it.
'use strict';
const path = require('path');
const root = path.join(__dirname, '..');
const app = require(path.join(root, 'js', 'main.js'));
const guide = require(path.join(root, 'scripts', 'build-guide.js'));

const RUNS = 7;

// About the size of the iptv-org all-countries playlist.
function bigPlaylist(channels) {
    const lines = ['#EXTM3U'];
    for (let i = 0; i < channels; i++) {
        lines.push('#EXTINF:-1 tvg-id="Ch' + i + '.xx@SD" tvg-logo="https://logo.example/' + i + '.png" group-title="Group ' + (i % 180) + '",Channel ' + i + ' (1080p)');
        lines.push('https://stream.example/' + i + '/index.m3u8');
    }
    return lines.join('\n');
}

// About the size of one country's XMLTV feed: 200 channels, a week of programmes.
function bigFeed(channels, perChannel) {
    const parts = ['<tv>'];
    const start = Date.UTC(2026, 10, 15, 0, 0, 0);
    for (let c = 0; c < channels; c++) {
        for (let p = 0; p < perChannel; p++) {
            const a = new Date(start + p * 3600000), b = new Date(start + (p + 1) * 3600000);
            const fmt = (d) => d.toISOString().replace(/[-:T]/g, '').slice(0, 14) + ' +0000';
            parts.push('<programme start="' + fmt(a) + '" stop="' + fmt(b) + '" channel="Ch' + c + '.xx"><title lang="pt">Programme ' + p +
                '</title><desc lang="pt">' + 'Some words about the programme. '.repeat(6) + '</desc></programme>');
        }
    }
    parts.push('</tv>');
    return parts.join('\n');
}

function median(fn) {
    const times = [];
    for (let i = 0; i < RUNS; i++) {
        const t = process.hrtime.bigint();
        fn();
        times.push(Number(process.hrtime.bigint() - t) / 1e6);
    }
    times.sort((x, y) => x - y);
    return Math.round(times[Math.floor(RUNS / 2)] * 10) / 10;
}

const playlist = bigPlaylist(13000);
const feed = bigFeed(200, 168);
const wanted = guide.playlistKeys(playlist);
const now = Date.UTC(2026, 10, 15, 12, 0, 0) / 1000;

const result = {
    'parse 13,000-channel playlist (ms)': median(() => app.parseM3U(playlist)),
    'guide: read 33,600-programme feed (ms)': median(() => guide.addProgrammes(Object.create(null), feed, wanted, now, 48)),
};
process.stdout.write(JSON.stringify(result, null, 2) + '\n');
