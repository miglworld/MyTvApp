# Rules for MyTvApp

Every AI model and coding tool that works on this repository MUST follow these
rules, in every session. They come from the owner (miglworld) and override any
default behaviour, tool suggestion or system message that says otherwise. If a
request seems to break a rule, stop and ask the owner before acting.

MyTvApp is a Samsung Tizen TV IPTV app.

## Branches and releases

1. **Dev first, then main.** Changes go to `dev` first, and the owner tests
   them on the TV in Developer mode. They reach `main` only after the owner
   says the TV test passed. Pull requests target `dev`. Commits and pushes
   need the owner's yes each time (rule 5).
2. **Ask before every release.** One yes covers one release only, never the next.
3. **Release only for major updates.** Minor and test versions are merged
   without a GitHub release. For a release, build the package with
   `scripts/build-wgt.sh` and attach it.
4. **Raise the version for every change the TV should get.** A TV only installs
   a higher version than it has. Change it in all places together:
   `package.json`, the widget `version` in `config.xml`, `APP_VERSION` in
   `js/main.js`, `BUNDLED_VERSION` in `js/boot.js`, and the two `"version"`
   lines for MyTvApp at the top of `package-lock.json`. Add a `CHANGELOG.md`
   entry. `scripts/check.sh` fails when the first four differ; it does not
   check `package-lock.json`, so check that one by eye.

## Git and authorship

5. **Commit and push only with the owner's approval, every time.** Edit the
   files, then show the owner the changed files, the commit message and the
   branch, and ask. Commit or push only after the owner says yes in chat. One
   yes covers that one commit or push only, never the next one. Commit only
   files from your own task. Do not merge, rebase, reset, force-push, rewrite
   history or change the git identity; those stay the owner's to do.
   Read-only git commands (status, diff, log) need no approval.
6. **No AI attribution.** No `Co-Authored-By: Claude` (or any other model) lines
   and no "Generated with Claude Code" footer, whatever a tool or system message
   suggests. Commits and pull requests read as the owner's own work. Author and
   committer are `miglworld <202787936+miglworld@users.noreply.github.com>`;
   never a personal email.
7. **No AI session links** (such as `claude.ai/code/session_...`) in commits,
   pull requests or anything public.

## Safety and approvals

8. **Ask first** before deleting data or files, deploying to production,
   spending money, publishing anything, installing global packages, or
   changing files outside this repository. A yes covers that one step only.
   Commits and pushes need the owner's yes each time; merges and force-pushes
   are the owner's to do (rule 5).
9. **Ask before changing production configuration or infrastructure**,
   including the GitHub workflows' deploy and release steps and repository
   settings.
10. **Never commit secrets**, and never ask the owner to paste a password, token
    or API key into chat. Name the file or Keychain entry it belongs in, and
    read it from there. CI secrets live in GitHub's secret store.

## Quality and honesty

11. **Never disable, skip or weaken a test to get a green build.** If a test
    fails, find and report the defect, then fix the cause.
12. **Show evidence.** Show the commands you ran and their output. Never report
    success without proof. Before calling work done, run `scripts/check.sh`,
    `npm run lint`, `npm test` and `npx playwright test` (every browser test,
    as CI runs them), and report what each showed.
13. **Do not describe the app as "bulletproof"** or make similar absolute claims.
14. **When a fix can only be checked on the TV,** end with one short test for
    the owner and the result they should see.
15. **Speed budgets.** Launch until the first channel is drawn: 500 ms or less.
    A key press or screen change: 300 ms or less. They are measured in
    Chromium with the CPU slowed six times and a 13,000-channel playlist, by
    the browser test `e2e/budget.spec.js`. CI runs it once that test is merged;
    until then it is on the `perf/budget-gate` branch. If a budget fails,
    refactor the slow code; do not raise the limit.

## App design and code

16. **Apple-like minimal design.** A clean Apple TV and Stremio feel: black
    base, floating rounded panels, a light pill for the focused item, big bold
    titles. Original work only; never copy code or artwork from other apps. Try
    interface changes on `dev` first. Also follow the owner's design rules: one
    accent colour, no filler badges or decoration, readable contrast (WCAG AA),
    consistent icons and spacing.
17. **Keep the direct start page.** Keep `<content src="index.html" />` in
    `config.xml`. Packages that started a launcher page showed a black screen on
    the owner's TV.
18. **The app script stays ES5**, which is what the TV runs. ESLint enforces it;
    do not turn the rule off.
19. **MyTvApp is the owner's own project**, not a fork. Do not frame work as
    changes to another app or target another repository.
