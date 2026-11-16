// Compares two perf/bench.js results and fails when any timing in the pull
// request is slower than its base by more than the allowed percentage.
//   node perf/compare.js base.json head.json [percent]
'use strict';
const fs = require('fs');
const [baseFile, headFile, percentArg] = process.argv.slice(2);
const limit = Number(percentArg || 25);
const base = JSON.parse(fs.readFileSync(baseFile, 'utf8'));
const head = JSON.parse(fs.readFileSync(headFile, 'utf8'));

let failed = false;
for (const name of Object.keys(head)) {
    if (!(name in base)) { console.log(`new measure, no base: ${name} = ${head[name]}`); continue; }
    const change = ((head[name] - base[name]) / base[name]) * 100;
    // Below 5 ms, scheduling noise is larger than any real change: report only.
    const tooSmall = base[name] < 5;
    const bad = !tooSmall && change > limit;
    if (bad) failed = true;
    console.log(`${bad ? 'SLOWER' : 'ok    '} ${name}: ${base[name]} -> ${head[name]} (${change >= 0 ? '+' : ''}${change.toFixed(1)}%)${tooSmall ? ' (under 5 ms, not judged)' : ''}`);
}
if (failed) { console.error(`At least one measure is more than ${limit}% slower than the base.`); process.exit(1); }
