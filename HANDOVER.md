# Handover: MyTvApp session, 19 November 2026

Delete this file when it is no longer needed. It is not part of the app.

## Read first

- `AGENTS.md` holds the owner's rules for this repository. They override anything else. It is not committed yet (shown as untracked).
- **Rule 5: commit and push only with the owner's approval, every time.** The owner changed this rule on 2026-11-19: the assistant may commit and push after showing the files, message and branch and getting a yes in chat. One yes covers one commit or push. Merges, rebases, resets and force-pushes stay the owner's.
- **Rule 6 says no AI attribution.** Two commits on `dev` still carry a `Co-Authored-By: Claude` line (see below).

## Where things stand

- **`dev`** is at `83f72bc` ("MyTvApp 0.12.9: Screen reader follows the remote; remove a stale patch") and matches `origin/dev`.
- **`main`** is at `0ec496b` and has not been touched in this session. Rule 1: `main` gets changes only after the owner's TV test on `dev` passes.
- The **working tree** has uncommitted edits to `CHANGELOG.md`, `config.xml`, `js/boot.js`, `js/main.js`, `package.json` and `package-lock.json`. The assistant did not review these in this session. Check them with `git diff` before committing. Also untracked: `AGENTS.md`. `CLAUDE.md` is modified to point to `AGENTS.md`.
- The file `navigation-focus.patch` was removed in `83f72bc`.

## What was done in this session

1. **Apple TV check.** MyTvApp is a Samsung Tizen app. It has no tvOS code. A plan for a tvOS wrapper was written and then deleted at the owner's request. Nothing was built.
2. **Focus column fix** (Up and Down keep the column after a shorter row). In `js/main.js`, `Focus.move` and `Focus.setZone`. Test: "navigation: Up and Down return to the same button after a shorter row" in `e2e/app.spec.js`. Now on `dev` as `6a4ca48`, with the later hash `061e296` before the history was rewritten.
3. **Dim behind the menu, Settings and Add Playlist.** A `.video-dim` layer in `index.html`, styled in `css/style.css`, switched by `syncMenuDim()` in `js/main.js` (sets `html.menu-dim`). Test: "dim: the picture is dimmed under the menu and Settings, not in the channel list". Now on `dev` as `edface6`.
4. **Version 0.12.8** (fix plus dim), on `dev` as `47729e5`. Entry in `CHANGELOG.md`. The owner then committed 0.12.9 (accessibility work: screen reader follows the remote, browser focus moves with the remote, `AGENTS.md`/`CLAUDE.md`).

## Commit history on `dev` and the attribution problem

Hashes changed during the session because `dev` was rewritten (someone force-pushed or reset). Current hashes:

| Commit | Subject | Attribution line |
|---|---|---|
| `6a4ca48` | Keep the focus column across Up and Down | `Co-Authored-By: Claude` present |
| `edface6` | Dim the picture behind the menu and Settings | `Co-Authored-By: Claude` present |
| `47729e5` | MyTvApp 0.12.8 | none |

Removing the two trailers means rewriting `dev` with a force push. This has not been done and needs the owner's yes (rule 8).

## Version rules (rule 4)

Change the version in all of these together:

- `package.json`
- `config.xml` (the `version` attribute)
- `APP_VERSION` in `js/main.js`
- `BUNDLED_VERSION` in `js/boot.js`
- the two MyTvApp `"version"` lines at the top of `package-lock.json`

Add a `CHANGELOG.md` entry. `scripts/check.sh` checks the first four, not the lock file.

## Checks

Before saying work is done (rule 12), run and report:

```bash
npm run lint
npm test
npx playwright test
scripts/check.sh
```

At the end of this session the results were: 59 unit tests passing, and 17 end-to-end tests passing (`npx playwright test e2e/app.spec.js`). `scripts/check.sh` was **not** run, and `npx playwright test` was not run in full (only `e2e/app.spec.js`).

## Waiting on the owner

1. **TV test on `dev`** for the focus fix and the dim. One short test, from the earlier answer:
   - Open the menu with Left. The picture behind it should go dark. Press Right to return to the channel list. The picture should brighten.
   - On Settings, the Playlists section: Right to reach Delete, then Down and Up. Focus should return to Delete.
2. **Merge `dev` to `main`** only after the TV test passes (rule 1).
3. **Decide on the history rewrite** to remove the two `Co-Authored-By` lines (see above).
4. **Releases** need a yes each time (rule 2). Minor versions are not released (rule 3).

## Ideas not done

- Up and Down on the Live TV list wrap from the last channel to the first.
- On the Live TV list, Right toggles a favourite. This may not match what the owner expects.
- Focus does not pick the nearest button by screen position. It uses row and column indexes only.
