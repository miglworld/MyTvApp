# Handover: MyTvApp, 19 November 2026

Delete this file when it is no longer needed. It is not part of the app.

## Read first

- `AGENTS.md` holds the owner's rules. They override everything else, for every model.
- **Rule 5:** the owner makes every git change. Commit or push only after showing the owner the files, message and branch and getting a yes in chat. One yes covers one commit or push. Merges, rebases, resets, force-pushes, history rewrites and git identity changes stay the owner's.
- **Rule 6:** no AI attribution. Author and committer are `miglworld <202787936+miglworld@users.noreply.github.com>`.
- **Rule 4:** every change the TV should get raises the version in all five places (`package.json`, `config.xml`, `APP_VERSION` in `js/main.js`, `BUNDLED_VERSION` in `js/boot.js`, the two `"version"` lines at the top of `package-lock.json`) and adds a `CHANGELOG.md` entry.

## Where things stand

- **Released:** v0.13.1 is the latest GitHub release, with `MyTvApp.wgt` attached: https://github.com/miglworld/MyTvApp/releases/tag/v0.13.1
- **`origin/main`** is at `9d36374`, the merge of PR #38, version 0.13.1.
- **`dev`** is at `1649262`, version 0.13.1, and is pushed (`origin/dev` is the same commit). `dev` has no commits that `main` lacks. `main` has one merge commit that `dev` lacks (`9d36374`), so bring `dev` level with `main` before new work.
- **Working tree:** clean when this was written, apart from this file.
- **Checks on `dev` at `1649262`, run in this session:** `scripts/check.sh` passed (version 0.13.1), `npm run lint` exit 0, `npm test` 74 of 74, `npx playwright test` 32 of 32.

## What the last session added (all in v0.13.0)

These are on `dev`, in `js/main.js` unless noted:

1. **Tidier channel names (0.12.11).** `cleanName` (near `parseM3U`) removes quality tags (FHD, UHD, HD, SD, 4K, resolutions such as 720p or 576p), the "ᴴᴰ" marks, a two-letter country prefix such as "UK |", and emoji. "USA |" is kept, because only two-letter prefixes are removed. Each channel keeps `rawName`, the name as the playlist gave it. `isTagged` reads `rawName`, so "[Geo-blocked]" and "[Not 24/7]" still work. Favorites saved earlier are tidied when they load.
2. **Copies of a channel (0.12.12).** `nextCopyFrom` and `tryNextEngine`. When every player fails for a channel, the app tries the next copy of it: same playlist, same base name, and the same tvg-id when both copies have one. Copies that failed recently go last. At most two extra copies are tried, and the switch count resets each time the user picks a channel. A toast and a diagnostics line say which copy is being tried. The row in the list does not move. Copies are grouped in `rebuildChannels`.
3. **Quality in brackets for clashing names (0.12.13).** `labelClashes` adds the quality to channels whose base names are the same, so "BBC One (FHD)" and "BBC One (SD)" show as two rows. Grouping still uses `baseName`, so copy switching is unaffected.

Tests for these: `test/app.test.js` (unit tests with names such as "clean names", "copies", "labelClashes") and `e2e/app.spec.js` (the "channel names" tests and the "copies" test).

## Open items for the owner

1. **TV tests of 0.13.1.** No TV result has been reported for these. Short tests:
   - **Focus:** turn on Voice Guide and move through the side menu. Each item's name should be spoken.
   - **Xtream accounts:** in Settings, Playlists, add an Xtream account. Its live channels should appear with their categories, and the password should not appear in About or in Report a problem.
   - **Clean names and copies:** add a playlist with "BBC One FHD" and "BBC One SD" (same `tvg-id`). Expect two rows reading "BBC One (FHD)" and "BBC One (SD)". Then, if one copy is dead, press OK on it: the other copy should play after a short wait, with a "Trying the … copy" toast.
2. **Speed budget not measured.** The gate test `e2e/budget.spec.js` is on `perf/budget-gate`, not on `dev`, so the 500 ms launch and 300 ms key-press budgets have not been run against the copy and name changes. A Node estimate of cleaning 13,000 names took about 6 ms; it is not a TV measurement.
3. **Copy-switch timing.** A channel with three dead copies can take up to about 78 seconds to give up, because each copy waits on the three players. Decide whether that is acceptable or whether the wait should be shorter.
4. **Identical rows.** Two channels with the same name and quality (for example, two HD copies from different providers) still look identical.
5. **Personal email is public on `main`.** It appears in author and committer fields on `main` and `dev`, from before the author rewrite and from GitHub's merge commit `9d36374`. Turning on "Keep my email addresses private" and "Block command line pushes that expose my email" in GitHub's settings stops new ones. Removing the existing ones means rewriting history with a force push, which needs the owner's decision.
6. **AI attribution lines in old history.** 67 commits still carry `Co-Authored-By: Claude`, from before rule 6. Removing them also needs a history rewrite. The last 12 commits have none.
7. **Releases** need a yes each time (rule 2), and only for major updates (rule 3).

## Ideas not done

From the TiviBro comparison (ideas only, nothing copied). Each needs a work order first:
- **Per-channel aspect ratio.** The app uses automatic aspect only. Check which display modes Tizen's player supports first.
- **Hide channels with nothing on.** Hide "Off Air" and "No Event Scheduled" channels until a new event starts.
- **Stream info panel.** Show resolution and codec in full screen, if the player exposes them.
- **Catch-up for Xtream accounts.** The biggest idea, and it depends on each provider's catch-up addresses, which have not been checked.
- **Fill in missing logos from public logo indexes.** Check the Content Security Policy first, because it loads images from other sites.
- **Set-up from a phone by QR code.** Needs a hosted server to pass the login. This is an owner decision under rules 8 and 9.
- **Mid-play drops for copy switching.** Only failures at start switch copies. A stream that drops after it has played is not switched.

## Accessibility notes (from the earlier session)

- The focus model uses row and column indexes, not on-screen position.
- Headings are still missing on the TV Guide and Settings screens (WCAG 1.3.1 and 2.4.6), and some grey text is below AA contrast. See `ACCESSIBILITY_TEST_REPORT.md`.
- Captions for live streams (WCAG 1.2.4) are not supported.
