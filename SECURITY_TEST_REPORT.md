# Security and test report

What was checked in MyTvApp, how, and what remains open. Written for version 0.12.2 on the branch `security/test-suites`.

This report does not say the app is secure in general. It lists each check, the evidence for its result, and the risk that remains.

## What the app is, and what that rules out

MyTvApp is a static web app that runs on Samsung TVs. It has no server, no database, no user accounts, no login, no API and no WebSockets. Its only server-side code is `scripts/build-guide.js`, which runs in GitHub Actions. The files are hosted by GitHub (GitHub Pages and `raw.githubusercontent.com`), which this repository does not operate.

All tests run against this checkout on `localhost` or on fixture data. None reaches GitHub Pages, a playlist server or any other third-party host: the browser tests block every request that is not to `localhost` and fail if the app tries one (`e2e/fixtures.js`, `lockNetwork`).

## Status key

- **PASS**: a test asserts the defence and passes.
- **FIXED**: a test found a defect; the code was fixed in this branch and the test now passes.
- **FAIL**: a test finds a defect that is not fixed.
- **UNVERIFIED**: not checked yet, or not checkable without more information.
- **NOT APPLICABLE**: the app has no code or service of the kind the check is about.

## Results

### Checks that apply to the app

| Check | Status | Evidence | Remaining risk |
|---|---|---|---|
| ReDoS in regular expressions that read playlist and guide text | PASS | `test/defences.test.js`: four "ReDoS:" tests, each with hostile input of 60,000 to 200,000 characters and a time limit of 500 to 1,000 ms. The slowest took 34 ms. | Regular expressions on trusted input (the TV's own browser version) are not tested. |
| Prototype keys (`__proto__`, `constructor`) in parsers and maps | FIXED | Defect: a channel named `__proto__` in a guide feed crashed the guide build (`TypeError: channels[key].push is not a function`), and a playlist group named `__proto__` broke the app's category list. Fix: maps without inherited names, `scripts/build-guide.js:54` and `:114`, `js/main.js:1246` and `:1293`. Tests: "prototype keys: …" in `test/defences.test.js`, and "a group named __proto__ is an ordinary group" in `e2e/app.spec.js`. | None known. |
| XML external entities and file reads | PASS | The guide builder reads XML with regular expressions, not an XML parser, so DTDs and external entities are never processed. Test: "XML: an external entity declaration is not resolved". The builder reads its configuration through `require` and writes only to the path its operator gives on the command line. | None known. |
| Out-of-range XML character references | FIXED | Defect: `&#99999999;` in a programme title threw `RangeError` and stopped the whole guide build. Fix: `scripts/build-guide.js:35` turns such references into the replacement character. Test: "XML: an out-of-range numeric character reference does not crash the build". | None known. |
| Markup in playlist text (injection into the page) | PASS | Playlist text reaches the page only through `textContent` (for example `js/main.js:891`). `scripts/check.sh:38` fails the build if any non-empty `innerHTML` assignment appears in the app script. Browser test "markup in playlist names is shown as text and runs nothing" loads a playlist whose channel name is an `<img onerror>` element and asserts that no image element exists and no script ran. | `js/boot.js:95` installs a downloaded update's page markup with `innerHTML`; that markup comes from this repository (see "Self-update" below). |
| Template injection (SSTI) | NOT APPLICABLE | No template engine anywhere; pages are built with DOM calls. | — |
| Insecure randomness | PASS | Test "insecure randomness: no Math.random in shipped code or the guide job". The app creates no secret tokens at all; playlist ids (`'pl_' + Date.now()`) are labels, not secrets. | — |
| Dynamic code | PASS | No `eval`, `new Function`, `document.write` or string timers; `scripts/check.sh:34` fails the build if one appears. The only matches in the repository are that rule's own text. | The self-update runs downloaded script by design (below). |
| Unicode lookalikes in identifiers | PASS | Tests "Unicode: a fullwidth lookalike id does not match a real one" and "a Cyrillic lookalike id does not match a Latin one". Channel ids are compared exactly after lower-casing. NFKC normalisation is deliberately **not** applied: it would make a fullwidth `ＲＴＰ1` match `RTP1`, which is what the test forbids. | — |
| Stream and logo addresses from playlists | PASS | Only `http`, `https`, `rtmp`, `rtsp`, `rtp`, `udp` and `mms` addresses become channels; logos must be `http` or `https` (`js/main.js:1217`, `:1223`). Test "addresses: only real stream schemes are accepted". | Plain `http` streams can be read or changed on the network; that is the playlist's choice. |
| Guide job: where it downloads from | PASS | HTTPS on hosts listed in `scripts/build-guide.js:28` only, on port 443, without a login (`:137`, `:142`). Redirects are followed by hand and each hop is checked (`:160`). Tests in `scripts/test-guide.js` cover an allowed redirect, a relative one, one to another host, one to plain HTTP, a loop, and an error status; `test/guide-build.test.js` checks that a bad address stops the build before it is fetched. | None known. |
| Self-update: where updates come from | PASS | Updates come from two addresses for this repository only (`js/main.js:52`), which `scripts/check.sh:43` enforces. All files come from one commit, and the app refuses a page that lacks an element its script uses (`js/main.js:2158`) before storing it (`:2160`). An address override exists for testing on `localhost` only (`:2102`). | Anyone who can push to `main` can run code on every TV with the app. Updates are not signed separately. Mitigations: protected `main`, required checks, and two-factor authentication on the GitHub account, which this report cannot verify. |
| Oversized input | PASS | Playlists over 40 MB and guide files over 5 MB are refused (`js/main.js:75`, `:62`). | — |
| Bundled library tampering | PASS | `scripts/check.sh:54` fails the build if `lib/hls.min.js` differs from the official hls.js 1.6.19 build (SHA-256). | — |

### Checks that do not apply

| Check | Status | Why |
|---|---|---|
| HTTP/2 Rapid Reset (CVE-2023-44487) | NOT APPLICABLE | The project runs no web server or proxy. Hosting is GitHub's, outside this repository and outside this report's scope. |
| Request smuggling (CL.TE / TE.CL) | NOT APPLICABLE | As above: no front end or back end of our own. |
| Cache poisoning | NOT APPLICABLE | No HTTP cache of our own. The app's own cache (playlists and guide in the TV's storage) is keyed by playlist id and address, and is filled only from the address it belongs to. |
| Spoofed IP headers | NOT APPLICABLE | Nothing reads client IP addresses. |
| JWT algorithm confusion | NOT APPLICABLE | No tokens. |
| 2FA code replay | NOT APPLICABLE | No accounts. |
| Timing attacks | NOT APPLICABLE | No secrets, tokens, HMACs or codes are compared. |
| Padding oracle | NOT APPLICABLE | No encryption. |
| WebSocket hijacking (CSWSH) | NOT APPLICABLE | No WebSockets. |
| SAML | NOT APPLICABLE | No sign-in. |
| Views bypassing row-level security | NOT APPLICABLE | No database. Data stays in each TV's own storage. |

### Items without a reference

| Item | Status |
|---|---|
| "52-char username SAML bypass" | UNVERIFIED: no reference given. The app has no SAML or usernames. |
| "n0auth email spoof graph1l aliases" | UNVERIFIED: no reference given. The app has no email or OAuth. |
| "unicode =spotify" | UNVERIFIED: no reference given. Unicode identifier handling is covered above. |

### Scanners

| Scanner | Where | Status |
|---|---|---|
| CodeQL (SAST, `security-extended` queries) | `.github/workflows/codeql.yml`, every pull request and weekly | PASS on `main`; no open alerts. |
| Semgrep 1.99.0, JavaScript rules | `.github/workflows/quality.yml`, `sast` job | PASS in CI: "Ran 68 rules on 11 files: 0 findings." The bundled hls.js is excluded. |
| gitleaks 8.21.2 over the whole history | `quality.yml`, `secrets` job | **FAIL: 9 findings**, all in `playlists/index.country.m3u` in commit `b1c51d9`, made by the upstream author before the fork. The file was a copy of iptv-org's public channel list and was removed from the tree in version 1.2.0. The findings are tokens inside third-party stream addresses published by iptv-org (8 matched as generic API keys, 1 as a JWT), not credentials of this project, so there is nothing of ours to revoke. They remain in the history. Not resolved: see "Open decisions". GitHub's own secret scanning and push protection are on. |
| npm audit | `quality.yml`, `dependencies` job | PASS locally and in CI: `found 0 vulnerabilities` (the only dependency is the test tool Playwright). |
| osv-scanner 1.9.2 on the lockfile | `quality.yml`, `dependencies` job | PASS in CI: 4 packages scanned, "No issues found". |
| OWASP ZAP baseline 2.16.0 (DAST) | `.github/workflows/nightly.yml`, against the app on `localhost` | UNVERIFIED until its first nightly run. Report only: its findings concern the test server's headers, and the real host's headers are GitHub's. |

## Tests and coverage

| Suite | What it covers | Result |
|---|---|---|
| `test/defences.test.js` | The defensive checks above | 13 of 13 pass |
| `test/guide-build.test.js` | The whole guide build on fixture data: channel filtering, the time window, order, decoding, cut descriptions, failure when nothing is found, and a bad address stopping the build | 4 of 4 pass |
| `scripts/test-guide.js` | Guide builder units and download rules | 16 of 16 pass |
| `scripts/test.js` | Playlist reader, list window, guide lookup, versions | 20 of 20 pass |
| `e2e/app.spec.js` | Ten flows in Chromium: boot with no errors and no requests outside the test policy, every top-level menu item, every Settings section, a Settings switch, categories, the guide, full screen, hostile markup, a `__proto__` group, and a failing playlist | 10 of 10 pass |
| `e2e/crawl.spec.js` | Clicks every visible control on ten screens, each in a new browser with empty storage; fails on any error or blocked request | 40 controls, 0 errors. 13 changed nothing visible, all expected: the 4 channel rows and 8 guide cells are driven by the remote, not by clicks, and the diagnostics box redraws the same text. The Updates section has no controls outside a TV. |

Coverage is enforced on the guide builder, which is the part of the code that runs without a browser: **92.5% of lines, 72.2% of branches and 90.3% of functions**, with CI failing below 90%, 70% and 85%. The uncovered branches are its command-line entry point and a few error paths.

The app script (`js/main.js`) cannot be measured the same way: almost all of it runs only inside a page. In Node only its exported helpers load, which gives 6.9% line coverage of the file. The browser tests are its coverage instead.

## Performance

| Measure | What it does | Result |
|---|---|---|
| `perf/bench.js` | Median of 7 runs: reading a 13,000-channel playlist, and reading a guide feed with 33,600 programmes | On this Mac: 11.6 ms and 48.7 ms; `main` measured 12.2 ms and 52.9 ms. |
| Regression check | `perf/compare.js` runs the same timing on the pull request and its base, on the same CI machine, and fails above +25% | Passes locally (−4.9% and −7.9%) and in CI (playlist 26.0 → 23.6 ms, −9.2%; guide feed 122.7 → 119.0 ms, −3.0%). |
| Load tests (k6, Artillery) | — | NOT APPLICABLE: there is no server of ours to load. |
| Lighthouse | `nightly.yml`, three runs of the app page | Measures only. Limits for LCP and CLS need agreed targets. Lighthouse measures in a lab, so INP is not available; Total Blocking Time stands in for it. |

## What was not tested

- **The app on a real TV.** All browser tests run in desktop Chromium with a stand-in for the Samsung player.
- **The Samsung player itself**, and every stream: the tests never fetch a real stream.
- **GitHub's hosting** (TLS, HTTP/2, caching, headers): outside this repository.
- **A Content Security Policy.** The page has none. Adding one could block the Samsung player's own script on the TV, so it needs a test on a TV before it ships.
- **Lint and type checking.** The app is plain ES5 in one file, without a linter or type checker. `node --check` and the rules in `scripts/check.sh` are the current lint.

## Open decisions

1. **Old tokens in the history.** Either list the nine findings by fingerprint in a `.gitleaksignore` file with the reason above, so every other commit and any new token still fails the scan; or rewrite the history to remove the file, which needs a force push to the protected `main` and breaks existing clones. Until one is chosen, the secret scan fails.
2. **Required checks.** The new jobs are not required on `main` yet; making them required is a repository setting.

## Defects found and fixed in this branch

1. A guide feed channel named `__proto__` crashed the guide build.
2. A playlist group named `__proto__` broke the app's category list.
3. An out-of-range character reference in a guide title crashed the guide build.
4. Clicking a Settings section without first moving the remote onto it did not open that section. Found by the browser tests; fixed in `js/main.js`.
