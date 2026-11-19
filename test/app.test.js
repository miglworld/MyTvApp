// Tests for the parts of js/main.js that do not need a page.
// Run with: npm test
'use strict';
var assert = require('assert');
var path = require('path');
var app = require(path.join(__dirname, '..', 'js', 'main.js'));

var test = require('node:test');

test('main.js hands out its functions under Node', function () {
    assert.strictEqual(typeof app.parseM3U, 'function');
    assert.strictEqual(typeof app.versionNewer, 'function');
});

test('parses a simple playlist', function () {
    var ch = app.parseM3U([
        '#EXTM3U',
        '#EXTINF:-1 tvg-id="rtp1.pt" tvg-logo="http://x/l.png" group-title="General",RTP 1',
        'http://example.com/rtp1.m3u8'
    ].join('\n'));
    assert.strictEqual(ch.length, 1);
    assert.strictEqual(ch[0].name, 'RTP 1');
    assert.strictEqual(ch[0].group, 'General');
    assert.strictEqual(ch[0].logo, 'http://x/l.png');
    assert.strictEqual(ch[0].tvgId, 'rtp1.pt');
    assert.strictEqual(ch[0].url, 'http://example.com/rtp1.m3u8');
});

test('a comma inside an attribute is not the start of the name', function () {
    var ch = app.parseM3U('#EXTINF:-1 group-title="News, Sport" tvg-id="a",Channel, One\nhttp://e/1');
    assert.strictEqual(ch[0].group, 'News, Sport');
    assert.strictEqual(ch[0].name, 'Channel, One');
});

test('Windows line endings and blank lines', function () {
    var ch = app.parseM3U('#EXTM3U\r\n\r\n#EXTINF:-1,A\r\nhttp://e/a\r\n\r\n#EXTINF:-1,B\r\nhttp://e/b\r\n');
    assert.deepStrictEqual(ch.map(function (c) { return c.name + '|' + c.url; }), ['A|http://e/a', 'B|http://e/b']);
});

test('defaults: group "Other", unnamed channel', function () {
    var ch = app.parseM3U('#EXTINF:-1,\nhttp://e/a');
    assert.strictEqual(ch[0].group, 'Other');
    assert.strictEqual(ch[0].name, 'Unnamed Channel');
});

test('#EXTGRP gives the group when group-title is missing', function () {
    var ch = app.parseM3U('#EXTINF:-1,A\n#EXTGRP:Movies\nhttp://e/a\n#EXTINF:-1 group-title="Kids",B\n#EXTGRP:Movies\nhttp://e/b');
    assert.strictEqual(ch[0].group, 'Movies');
    assert.strictEqual(ch[1].group, 'Kids');
});

test('other # lines between the entry and its URL are skipped', function () {
    var ch = app.parseM3U('#EXTINF:-1,A\n#EXTVLCOPT:http-user-agent=X\nhttp://e/a');
    assert.strictEqual(ch.length, 1);
    assert.strictEqual(ch[0].url, 'http://e/a');
});

test('a URL without an entry, and an entry without a URL, give no channel', function () {
    assert.strictEqual(app.parseM3U('http://e/orphan').length, 0);
    assert.strictEqual(app.parseM3U('#EXTINF:-1,A').length, 0);
});

test('only real stream addresses become channels', function () {
    var ch = app.parseM3U([
        '#EXTINF:-1,ok http', 'http://e/a',
        '#EXTINF:-1,ok https', 'HTTPS://e/b',
        '#EXTINF:-1,ok rtmp', 'rtmp://e/live',
        '#EXTINF:-1,ok udp', 'udp://@239.0.0.1:1234',
        '#EXTINF:-1,file', 'file:///etc/passwd',
        '#EXTINF:-1,script', 'javascript:alert(1)',
        '#EXTINF:-1,data', 'data:text/html,<script>alert(1)</script>',
        '#EXTINF:-1,relative', '../../index.html',
        '#EXTINF:-1,spaces', 'http://e/a b'
    ].join('\n'));
    assert.deepStrictEqual(ch.map(function (c) { return c.name; }), ['ok http', 'ok https', 'ok rtmp', 'ok udp']);
});

test('a rejected address does not attach its entry to the next URL', function () {
    var ch = app.parseM3U('#EXTINF:-1,bad\nfile:///x\nhttp://e/stray\n#EXTINF:-1,good\nhttp://e/g');
    assert.deepStrictEqual(ch.map(function (c) { return c.name + '|' + c.url; }), ['good|http://e/g']);
});

test('logos must be web addresses', function () {
    var ch = app.parseM3U([
        '#EXTINF:-1 tvg-logo="https://e/l.png",a', 'http://e/a',
        '#EXTINF:-1 tvg-logo="javascript:alert(1)",b', 'http://e/b',
        '#EXTINF:-1 tvg-logo="file:///x.png",c', 'http://e/c',
        '#EXTINF:-1 tvg-logo="x) ; background: red",d', 'http://e/d'
    ].join('\n'));
    assert.deepStrictEqual(ch.map(function (c) { return c.logo; }), ['https://e/l.png', '', '', '']);
});

test('markup in names stays plain text for the page to show as text', function () {
    var ch = app.parseM3U('#EXTINF:-1 group-title="<img src=x onerror=alert(1)>",<script>alert(1)</script>\nhttp://e/a');
    assert.strictEqual(ch[0].name, '<script>alert(1)</script>');
    assert.strictEqual(ch[0].group, '<img src=x onerror=alert(1)>');
});

test('quality tags, a country prefix and emoji are left out of the shown name', function () {
    assert.strictEqual(app.cleanName('UK | BBC One FHD'), 'BBC One');
    assert.strictEqual(app.cleanName('Sky News ᴴᴰ'), 'Sky News');
    assert.strictEqual(app.cleanName('Sky Sport 4K (UHD)'), 'Sky Sport');
    assert.strictEqual(app.cleanName('ESPN ⚽ HD'), 'ESPN');
    assert.strictEqual(app.cleanName('CNN [SD] News'), 'CNN News');
    assert.strictEqual(app.cleanName('FR | TF1 720p'), 'TF1');
    assert.strictEqual(app.cleanName('Rai 1 (576p)'), 'Rai 1');
    assert.strictEqual(app.cleanName('Canal 5 [504p]'), 'Canal 5');
});

test('words that only look like tags are kept, and a three-letter prefix stays', function () {
    assert.strictEqual(app.cleanName('HDTV Guide'), 'HDTV Guide');
    assert.strictEqual(app.cleanName('SDK Channel'), 'SDK Channel');
    assert.strictEqual(app.cleanName('USA | Sky News FHD'), 'USA | Sky News');
    assert.strictEqual(app.cleanName('BBC | News'), 'BBC | News');
    assert.strictEqual(app.cleanName('<script>alert(1)</script>'), '<script>alert(1)</script>');
});

test('a name that would be empty keeps the name the playlist gave', function () {
    assert.strictEqual(app.cleanName('FHD'), 'FHD');
    assert.strictEqual(app.cleanName('⚽'), '⚽');
    assert.strictEqual(app.cleanName(''), '');
});

test('the Geo-blocked and Not 24/7 marks leave the name and become tags', function () {
    var ch = app.parseM3U('#EXTINF:-1,UK | Film Four HD [Geo-blocked]\nhttp://e/a\n#EXTINF:-1,RTP 1 [Not 24/7] [geo-blocked]\nhttp://e/b\n#EXTINF:-1,Plain One\nhttp://e/c');
    assert.strictEqual(ch[0].name, 'Film Four');
    assert.strictEqual(ch[0].rawName, 'UK | Film Four HD [Geo-blocked]');
    assert.strictEqual(app.isTagged(ch[0]), true);
    assert.deepStrictEqual(app.channelTags(ch[0]), ['Geo-blocked']);
    assert.strictEqual(ch[1].name, 'RTP 1');
    assert.deepStrictEqual(app.channelTags(ch[1]), ['Geo-blocked', 'Not 24/7']);
    assert.deepStrictEqual(app.channelTags(ch[2]), []);
    assert.deepStrictEqual(app.channelTags({}), []);
});

test('the identity a playlist gives for a channel', function () {
    var ch = app.parseM3U([
        '#EXTINF:-1 tvg-id="a",From an option line',
        '#EXTVLCOPT:http-referrer=https://example.com/',
        '#EXTVLCOPT:http-user-agent=Mozilla/5.0 (X11; Linux x86_64; rv:149.0) Gecko/20100101 Firefox/149.0',
        'http://e/a',
        '#EXTINF:-1 user-agent="Mozilla/5.0 (KHTML, like Gecko) Chrome/149.0.0.0" group-title="Sports",From an attribute',
        'http://e/b',
        '#EXTINF:-1,None',
        'http://e/c'
    ].join('\n'));
    assert.strictEqual(ch[0].userAgent, 'Mozilla/5.0 (X11; Linux x86_64; rv:149.0) Gecko/20100101 Firefox/149.0');
    assert.strictEqual(ch[1].userAgent, 'Mozilla/5.0 (KHTML, like Gecko) Chrome/149.0.0.0');
    assert.strictEqual(ch[1].name, 'From an attribute');
    assert.strictEqual(ch[1].group, 'Sports');
    assert.strictEqual(ch[2].userAgent, '');
    // An option line belongs to the entry above it only.
    assert.strictEqual(app.parseM3U('#EXTVLCOPT:http-user-agent=X\n#EXTINF:-1,A\nhttp://e/a')[0].userAgent, '');
});

test('an identity cannot smuggle in line breaks or be endless', function () {
    assert.strictEqual(app.cleanUserAgent('Agent\r\nCookie: stolen=1'), 'AgentCookie: stolen=1');
    assert.strictEqual(app.cleanUserAgent('  Mozilla/5.0  '), 'Mozilla/5.0');
    assert.strictEqual(app.cleanUserAgent(new Array(400).join('x')), '');
    assert.strictEqual(app.cleanUserAgent(undefined), '');
});

test('the rows a long list builds stay around the selected one', function () {
    assert.deepStrictEqual(app.listWindow(0, 100, 10), { start: 0, end: 10 });
    assert.deepStrictEqual(app.listWindow(50, 100, 10), { start: 45, end: 55 });
    assert.deepStrictEqual(app.listWindow(99, 100, 10), { start: 90, end: 100 });
    assert.deepStrictEqual(app.listWindow(2, 3, 10), { start: 0, end: 3 });
    assert.deepStrictEqual(app.listWindow(0, 0, 10), { start: 0, end: 0 });
});

test('the programme at a given minute', function () {
    var list = [[100, 30, 'A'], [130, 60, 'B'], [200, 10, 'C']];   // a gap from 190 to 200
    assert.strictEqual(app.guideIndexAt(list, 100), 0);
    assert.strictEqual(app.guideIndexAt(list, 129.9), 0);
    assert.strictEqual(app.guideIndexAt(list, 130), 1);
    assert.strictEqual(app.guideIndexAt(list, 195), 2);    // in the gap: the next one
    assert.strictEqual(app.guideIndexAt(list, 50), 0);     // before everything: the first
    assert.strictEqual(app.guideIndexAt(list, 999), 2);    // after everything: the last
    assert.strictEqual(app.guideIndexAt([], 100), -1);
});

test('channels a playlist marks as unreliable', function () {
    assert.strictEqual(app.isTagged({ name: 'SIC (1080p) [Geo-blocked]' }), true);
    assert.strictEqual(app.isTagged({ name: 'RTP 1 (720p) [Not 24/7]' }), true);
    assert.strictEqual(app.isTagged({ name: 'rtp [not 24/7]' }), true);
    assert.strictEqual(app.isTagged({ name: 'TVI (720p)' }), false);
    assert.strictEqual(app.isTagged({}), false);
});

test('how long ago, in words', function () {
    var now = Date.now();
    assert.strictEqual(app.ago(0), 'not yet');
    assert.strictEqual(app.ago(now - 30 * 1000), 'just now');
    assert.strictEqual(app.ago(now - 45 * 60 * 1000), '45 minutes ago');
    assert.strictEqual(app.ago(now - 3 * 3600 * 1000), '3 hours ago');
    assert.strictEqual(app.ago(now - 4 * 24 * 3600 * 1000), '4 days ago');
});

test('channel number attribute is kept', function () {
    assert.strictEqual(app.parseM3U('#EXTINF:-1 tvg-chno="12",A\nhttp://e/a')[0].chno, '12');
});

test('version comparison is by number, not by text', function () {
    assert.strictEqual(app.versionNewer('0.10.0', '0.9.2'), true);
    assert.strictEqual(app.versionNewer('0.9.2', '0.10.0'), false);
    assert.strictEqual(app.versionNewer('1.0.0', '0.99.99'), true);
    assert.strictEqual(app.versionNewer('0.9.1', '0.9.1'), false);
    assert.strictEqual(app.versionNewer('0.9', '0.9.0'), false);
    assert.strictEqual(app.versionNewer('', '0.9.0'), false);
});


// ----- Xtream Codes accounts --------------------------------------------------

test('an Xtream server address is cleaned up to scheme, host, port and path', function () {
    assert.strictEqual(app.normalizeXtreamServer('iptv.example:8080'), 'http://iptv.example:8080');
    assert.strictEqual(app.normalizeXtreamServer('  https://iptv.example:8443/ '), 'https://iptv.example:8443');
    assert.strictEqual(app.normalizeXtreamServer('http://iptv.example/get.php?username=a&password=b'), 'http://iptv.example');
    assert.strictEqual(app.normalizeXtreamServer('http://iptv.example/panel/player_api.php'), 'http://iptv.example/panel');
    assert.strictEqual(app.normalizeXtreamServer('http://localhost:8080'), 'http://localhost:8080');
    assert.strictEqual(app.normalizeXtreamServer(''), '');
    assert.strictEqual(app.normalizeXtreamServer('ftp://iptv.example'), '');
    assert.strictEqual(app.normalizeXtreamServer('http://user:pw@iptv.example'), '');
});

test('an Xtream account is read from player_api.php, with the login encoded', function () {
    assert.strictEqual(app.xtreamApiUrl('http://iptv.example:8080', 'me', 'p&ss=1 /x', 'get_live_streams'),
        'http://iptv.example:8080/player_api.php?username=me&password=p%26ss%3D1%20%2Fx&action=get_live_streams');
    var pl = { type: 'xtream', server: 'http://iptv.example', username: 'u', password: 'p' };
    assert.strictEqual(app.playlistAddress(pl), 'http://iptv.example/player_api.php?username=u&password=p&action=get_live_streams');
    // An M3U playlist (no type, as stored by earlier versions) keeps its own address.
    assert.strictEqual(app.playlistAddress({ url: 'https://host.example/list.m3u' }), 'https://host.example/list.m3u');
});

test('the live channels of player_api.php become channels with their categories', function () {
    var categories = [{ category_id: '1', category_name: 'UK | News' }, { category_id: 2, category_name: 'Sport' }];
    var streams = [
        { num: 1, name: 'News One', stream_id: 101, stream_icon: 'http://img.example/1.png', epg_channel_id: 'news1.uk', category_id: '1' },
        { num: 2, name: 'Sport Two', stream_id: '102', stream_icon: '', epg_channel_id: null, category_id: '2' },
        { num: 3, name: 'Lost', stream_id: 103, category_id: '99' },
        { num: 4, name: 'No id' },
        null
    ];
    var ch = app.parseM3U(app.xtreamM3u('http://iptv.example:8080', 'me', 'p w', categories, streams));
    assert.deepStrictEqual(ch.map(function (c) { return [c.name, c.group, c.url]; }), [
        ['News One', 'UK | News', 'http://iptv.example:8080/live/me/p%20w/101.ts'],
        ['Sport Two', 'Sport', 'http://iptv.example:8080/live/me/p%20w/102.ts'],
        ['Lost', 'Other', 'http://iptv.example:8080/live/me/p%20w/103.ts']
    ]);
    assert.strictEqual(ch[0].tvgId, 'news1.uk');
    assert.strictEqual(ch[0].logo, 'http://img.example/1.png');
    assert.strictEqual(ch[1].chno, '2');
});

test('values from an Xtream server cannot break out of their M3U line', function () {
    var streams = [{ num: '1"x', name: 'Bad\n#EXTINF:-1,Injected\nhttp://evil.example/x', stream_id: '7/../../x', stream_icon: '" group-title="Hijack', category_id: '1' }];
    var ch = app.parseM3U(app.xtreamM3u('http://iptv.example', 'u', 'p', [{ category_id: '1', category_name: 'A"B\nC' }], streams));
    assert.strictEqual(ch.length, 1);
    assert.strictEqual(ch[0].url, 'http://iptv.example/live/u/p/7x.ts');
    assert.strictEqual(ch[0].group, 'A B C');
    assert.ok(ch[0].name.indexOf('Injected') !== -1 && ch[0].name.indexOf('\n') === -1);
    assert.strictEqual(ch[0].chno, '');
    // Not a list (what a server answers to a wrong login): no categories, nothing breaks.
    assert.strictEqual(app.parseM3U(app.xtreamM3u('http://iptv.example', 'u', 'p', { user_info: {} }, [])).length, 0);
});

test('passwords are masked in diagnostics: as typed, encoded, and as a password= value', function () {
    var out = app.maskSecrets('failed http://h/live/me/s3cr&t/1.ts and http://h/get.php?username=me&password=s3cr%26t&type=m3u_plus, other password=zzz', ['s3cr&t']);
    assert.ok(out.indexOf('s3cr') === -1, out);
    assert.ok(out.indexOf('zzz') === -1, out);
    assert.match(out, /\/live\/me\/•••\/1\.ts/);
    assert.strictEqual(app.maskSecrets('nothing secret', ['']), 'nothing secret');
    assert.strictEqual(app.maskSecrets('no list', undefined), 'no list');
});

test('a failed channel is replaced by the next copy of the same channel, in list order', function () {
    var a = { url: 'http://e/fhd', name: 'BBC One', tvgId: 'bbc1.uk' };
    var b = { url: 'http://e/hd', name: 'BBC One', tvgId: 'bbc1.uk' };
    var c = { url: 'http://e/sd', name: 'BBC One', tvgId: 'bbc1.uk' };
    var none = function () { return false; };
    assert.strictEqual(app.nextCopyFrom([a, b, c], a, [a.url], none), b);
    assert.strictEqual(app.nextCopyFrom([a, b, c], b, [a.url, b.url], none), c);
    assert.strictEqual(app.nextCopyFrom([a, b, c], c, [a.url, b.url, c.url], none), null);
});

test('copies that failed recently are tried last, and another channel is never a copy', function () {
    var a = { url: 'http://e/fhd', name: 'BBC One', tvgId: '' };
    var b = { url: 'http://e/hd', name: 'BBC One', tvgId: '' };
    var c = { url: 'http://e/sd', name: 'BBC One', tvgId: '' };
    var failed = { 'http://e/hd': true };
    var isFailed = function (x) { return !!failed[x.url]; };
    assert.strictEqual(app.nextCopyFrom([a, b, c], a, [a.url], isFailed), c);
    var id = { url: 'http://e/id', name: 'BBC One', tvgId: 'bbc1.uk' };
    var other = { url: 'http://e/other', name: 'BBC One', tvgId: 'news.uk' };
    assert.strictEqual(app.nextCopyFrom([id, other], id, [id.url], function () { return false; }), null);
    assert.strictEqual(app.nextCopyFrom(undefined, a, [a.url], function () { return false; }), null);
});

test('the quality shown in the switch message comes from the name the playlist gave', function () {
    assert.strictEqual(app.qualityLabel({ rawName: 'UK | BBC One HD' }), 'HD');
    assert.strictEqual(app.qualityLabel({ rawName: 'Rai 1 (576p)' }), '576p');
    assert.strictEqual(app.qualityLabel({ rawName: 'Plain' }), '');
});

test('names that clash after cleaning get their quality in brackets', function () {
    var ch = app.parseM3U([
        '#EXTINF:-1,UK | BBC One FHD', 'http://e/1',
        '#EXTINF:-1,UK | BBC One SD', 'http://e/2',
        '#EXTINF:-1,Sky News HD', 'http://e/3'
    ].join('\n'));
    app.labelClashes(ch);
    assert.deepStrictEqual(ch.map(function (c) { return c.name; }), ['BBC One (FHD)', 'BBC One (SD)', 'Sky News']);
    // The base name is kept for grouping: the copies still match each other.
    assert.deepStrictEqual(ch.map(function (c) { return c.baseName; }), ['BBC One', 'BBC One', 'Sky News']);
});

test('a clash with no quality to add, and a name that is not a clash, stay as they are', function () {
    var ch = app.parseM3U([
        '#EXTINF:-1,Plain Name', 'http://e/1',
        '#EXTINF:-1,Plain Name', 'http://e/2',
        '#EXTINF:-1,Solo HD', 'http://e/3'
    ].join('\n'));
    app.labelClashes(ch);
    assert.deepStrictEqual(ch.map(function (c) { return c.name; }), ['Plain Name', 'Plain Name', 'Solo']);
});

test('the quality is kept in the case a playlist gives it, resolutions in lower case', function () {
    assert.strictEqual(app.qualityLabel({ rawName: 'Sky Sport hd' }), 'HD');
    assert.strictEqual(app.qualityLabel({ rawName: 'Rai 1 576P' }), '576p');
});
