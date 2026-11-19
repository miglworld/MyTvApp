# Changelog

MyTvApp's own history starts at v0.1. Newest first.

## v0.12.15 (dev branch, not released yet)
- Fixed: a channel the Samsung player could not open, and the TV player or hls.js played instead, could play sound with no picture, because the Samsung player's surface stayed over the picture. It is now hidden whenever another player plays.

## v0.12.14 (dev branch, not released yet)
- Channel names no longer show "[Geo-blocked]" or "[Not 24/7]". These marks are now small tags under the channel's name in full screen. They still dim or hide the channel as set in Settings, Channels. Favorites saved with a mark in their name lose it the same way.

## v0.12.13 (dev branch, not released yet)
- Channels whose names are the same after tidying get their quality in brackets, so "BBC One FHD" and "BBC One SD" show as "BBC One (FHD)" and "BBC One (SD)". Copies are still matched by their plain name, so copy switching is unchanged. Two channels with the same name and no quality stay the same.

## v0.12.12 (dev branch, not released yet)
- Copies of a channel: when a channel will not play on any player, the app tries the next copy of the same channel (same playlist, same name, same tvg-id when both give one), such as HD after FHD. A toast and a diagnostics line say which copy it is trying. Copies that failed recently are tried last, and at most two other copies are tried in one go. The row in the list does not move.

## v0.12.11 (dev branch, not released yet)
- Channel names are tidied as the playlist loads: quality tags (FHD, UHD, HD, SD, 4K and resolutions such as 720p or 576p) and the small "ᴴᴰ" marks are left out, a two-letter country prefix such as "UK |" is removed, and emoji are removed. Three-letter prefixes such as "USA |" are kept. "[Geo-blocked]" and "[Not 24/7]" still dim a channel, because they are read from the name as the playlist gave it. Favorites saved earlier are tidied the same way.

## v0.12.10 (dev branch, not released yet)
- Playlists: **Xtream Codes accounts.** In Settings, Playlists, "Add an Xtream Codes account" takes the server address, username and password from your provider. The app asks the server's `player_api.php` for the live categories and live channels only, so they show in Live TV like an M3U playlist, without downloading the account's films and series. A wrong username or password says so. An account can be edited, switched off and deleted like any playlist.
- Privacy: the password of an Xtream account is replaced with dots in the diagnostics list, the last app error and the error box, so it never reaches About or Report a problem. Settings shows the account's server and username only.
- Each field opens the TV keyboard only when you press OK on it. Done on the keyboard moves to the next field, and from the password to Save.

## v0.12.9 (dev branch, not released yet)
- Accessibility: the TV's screen reader (Voice Guide) can follow the remote. The control the remote is on now also takes the browser's focus, so it is read out. Settings switches say whether they are on, channel rows and guide programmes read their name and programme, the menu's icons keep their names when the menu folds, and messages such as "Could not load" are announced.
- The address field still opens the TV keyboard only when you press OK on it.
- Repository: a WCAG 2.2 AA accessibility report (`ACCESSIBILITY_TEST_REPORT.md`), browser tests for the focus behaviour, and a leftover patch file removed.

## v0.12.8 (dev branch, not released yet)
- Remote: Up and Down return to the same button after passing a shorter row. Before, the focus jumped to the first button.
- The picture behind the side menu, Settings and Add Playlist is dimmed, so the text reads clearly. The channel list keeps the picture bright.

## v0.12.7 (dev branch, not released yet)
- Settings: the channel keeps playing while Settings is open, as it does behind the TV Guide, instead of stopping.

## v0.12.6 (dev branch, not released yet)
- Updates: while the app runs, it checks GitHub for a newer version every two minutes (when automatic updates are on). A downloaded update shows the corner notice ("Update now" or "Later") as soon as it arrives, not only at the next start. Nothing is checked again while a downloaded update is waiting.

## v0.12.5 (2026-11-16)
- Fixed: a key press after the app reopened the last channel could stop the app with "Maximum call stack size exceeded". Removing a stored value called itself until the stack ran out.

## v0.12.4 (2026-11-15)
- Settings, **Report a problem**: a QR code that opens a new GitHub issue on your phone, already filled in with the app version, the TV's software and the last events. Web addresses in it are cut to their server name, so playlist logins stay on the TV. The screen shows the whole report before you scan.

## v0.12.3 (2026-11-15)
- Settings: choosing a section with OK now opens it; before, only moving onto it did.
- A playlist group called `__proto__` no longer stops the channel list from loading.
- The app page has a Content Security Policy: scripts and styles come only from the app itself, and plugins, frames and forms from other sites are refused.
- Repository: browser tests, a page crawler, a performance comparison and security scans (secret scan, dependency audit, Semgrep, ZAP, Lighthouse) run in CI; ESLint keeps the app script to what the TV runs; dead code removed; owner licence added.

## v0.12.2 (2026-11-15)
- Caption shade: its offset now comes from the sidebar's width token instead of a fixed number.
- Repository: the guide job checks every redirect against its host list and refuses ports other than 443; a bad playlist address now produces the same error message as a bad feed address.

## v0.12.1 (2026-11-12)
- The shade behind the Live TV caption now reaches the left edge of the picture; it used to stop where the menu ends, leaving a visible seam.
- Repository: the guide job only downloads HTTPS sources on allowed hosts; new README with screenshots, and the script that takes them.

## v0.12.0 (2026-11-12)
*Tested on the `dev` branch as 0.11.0 to 0.11.14.*
- New Live TV screen in place of the home, categories and channel grid screens: the channel plays behind the whole screen, with a floating side menu (every category) and a floating numbered channel list over it, and the channel's caption at the bottom.
- One playback for browsing and full screen: OK hides the panels, Back shows them again, and the stream is not restarted.
- New minimal look: black base, rounded glass panels with a light edge, a bright pill for the focused item. The panels blur what is behind them where the browser can (not over the Samsung player's picture, which lies outside the page).
- Full screen: the caption sits at the bottom, and the channel list is a floating glass panel.
- The menu has two levels: Live TV, Favorites and Settings; Live TV opens its own menu (a "‹ Live TV" header, All channels, then the categories) in the same place.
- The menu folds into a small capsule of icons while the remote is in the channel list or on another screen, and opens again with Left.
- Lighter glass with a bright rim, larger curves, round menu and list items.
- Settings, About: the TV's software (Tizen and browser version), when the programme guide was built, the result of the last update check, and the last app error, which is now kept apart from the rolling diagnostics list.
- Repository: tests for the list window, the guide lookup and channel tags; `docs/decisions.md` records why the app is built the way it is.
- New Settings screen: five sections on the left (Playlists, Playback, Channels, Updates, About) and the chosen section's rows on the right, with real switches, current values, and a sentence under the rows explaining the one the remote is on. Playlists show their channel count; About holds the version and the diagnostics list.
- Readability: the faintest greys are lighter and the smallest texts larger, across the app. The focus pill eases in on menus, settings and buttons, and nothing animates when the TV asks for reduced motion.
- A downloaded update no longer restarts the app by itself: a small notice in the top right corner offers "Update now" or "Later". It waits while a channel is full screen, and "Later" installs the update at the next start.
- When a playlist gives a channel the browser identity (user agent) its server expects, the Samsung player uses it for that channel. Settings switch, on by default. The "referrer" some playlists also give cannot be sent by a TV app.
- Channels a playlist marks as "[Geo-blocked]" or "[Not 24/7]" are shown darker; a Settings switch can hide them or show them as normal.
- A channel that did not play is remembered, shown darker with "Did not play last time", until it plays again. Settings can forget them all.
- TV Guide screen (new menu entry): the channels that have a guide down the left, time across, a line for the present, and the highlighted programme's details at the top. Left/Right move through a channel's programmes, Up/Down change channel, OK on a programme that is on plays the channel, and Back from full screen returns to the guide.
- Programme guide, first part: channels the guide covers show what is on under their name in the list, and the caption shows the programme's title, times, progress, a short description and what is next. Full screen shows it in the info bar. The guide is the small file this repository builds every four hours.
- New menu icons, drawn as one set: outlines of a TV, a star and a gear with the same line weight.
- Updates are downloaded from one exact commit. Before, the files were fetched by branch name, where GitHub can serve a new script next to an old page for a few minutes; a TV that updated in that window got a version that could not start (this is what happened to 0.11.4). The app also checks that page and script match before storing an update, and "Check for updates now" may retry a version that failed.
- Review fixes: a channel that did not start at the last launch is not started by itself again; a category stays the same category when playlists change; "previous channel" and the channel to start on are the last ones watched full screen, not ones the list passed over; removing a favorite keeps your place in the list; the diagnostics list no longer fills up with channels passed over.
- Faster channel start (Settings switch, on by default): the Samsung player shows the picture after 2 seconds of buffer.
- Plain status texts ("Connecting…", "Playing · 1920x1080 · 4.8 Mbps", "Not available right now…"). Which player was tried and why it failed is in the diagnostics list.
- A channel the first player cannot show is given up on sooner (7 s per fallback instead of 12 s).

## v0.10.1 (2026-11-11)
Security review.
- Only real stream addresses (`http`, `https`, `rtmp`, `rtsp`, `rtp`, `udp`, `mms`) become channels; logos must be web addresses; playlists over 40 MB are refused.
- The update address used for testing can only be changed on a developer's own machine.
- Removed the unused `launcher.html`.
- Repository: security rules and hostile-playlist tests in the checks, the bundled hls.js is verified against the official build, CodeQL scanning, `SECURITY.md`.

## v0.10.0 (2026-11-11)
- Playlists are remembered on the TV: channels appear at once when the app opens, and stored copies older than 6 hours are refreshed in the background. "Reload playlists now" in Settings.
- Developer mode (Settings): follow the `dev` branch to try test versions before they are merged. "Check for updates now" in Settings.
- A failed reload keeps the channels that were already loaded.
- Repository: checks on every pull request (scripts parse, versions match, tests, version bumped).

## v0.9.2 (2026-11-11)
- No changes to the app: a second self-update run on the TV.

## v0.9.1 (2026-11-11)
- No changes to the app: the first version delivered to the TV by self-update, to confirm that it works.

## v0.9.0 (2026-11-11)
- Self-update: the app starts from its own files, checks GitHub in the background, downloads a newer version into storage and runs it from the next start (or restarts into it right away when the app has just opened).
- An update that does not start is discarded and not tried again.
- **Automatic updates** switch in Settings; update events appear in the diagnostics list.
- Needs this package installed once (`js/boot.js` is new).

## v0.8.2 (2026-11-11)
- The package starts the app directly from its own files again, as v0.5 did, instead of going through the launcher. Packages that started through the launcher showed a black screen on the TV. Updating means installing the newer package.

## v0.8.1 (2026-11-11)
- The Samsung player is no longer asked for picture size and bitrate from inside its own callbacks, which could freeze it and leave the screen black. Picture info is read only when Right/INFO is pressed.
- The app starts on its home screen. Reopening the last channel at start is now a switch in Settings (off by default), and it skips a channel that did not start the time before.
- Diagnostics: the last events (start, playlists, player, errors) are listed at the bottom of Settings and survive a restart.

## v0.8 (2026-11-11)
- The app shows its version number from this changelog: 0.8.0.
- Fixed the black screen on start: the app script starts immediately, and the launcher builds the page without `document.write()`.
- "Starting MyTvApp…" is shown until the app runs; script errors appear on screen.
- The picture settings from v0.7 are now the optional **Picture tuning** switch (off by default).
- Playback restarts when the app returns from the background.
- Messages and the loading spinner are visible on every screen.
- Back from the player returns to the channel grid it was opened from.
- Focus stays on the row after switching or deleting a playlist.
- "Buffering…" clears when the video recovers; channel names with commas in attributes; `#EXTGRP` groups.
- Faster navigation in big channel grids.
- Repository: the built package moved to GitHub Releases, `scripts/build-wgt.sh` added, icon renamed to `icon.png`.

## v0.7 (2026-11-11)
- The left menu no longer covers the video.
- Samsung player: highest start quality and original aspect ratio.
- Status line shows the stream's resolution and bitrate.

## v0.6 (2026-11-11)
- Install once: a launcher loads the current app from GitHub Pages on every start, with the bundled copy as fallback.

## v0.5 (2026-11-11)
- Renamed the app to MyTvApp.

## v0.4 (2026-11-11)
- Exit works inside TizenBrew.

## v0.3 (2026-11-11)
- Playback through Samsung's AVPlay in the installed app.

## v0.2 (2026-11-11)
- Channel list over the video, number zapping, previous channel, reopen the last channel on start.
- TizenBrew module support.

## v0.1 (2026-11-11)
- Samsung system keyboard instead of the custom on-screen keyboard.
- TV player first, hls.js fallback, 12 s no-video watchdog, on-screen status line.
- hls.js bundled and pinned; channel grids render in batches of 60.
- Removed the bundled 14k-channel playlist (iptv-org presets instead) and the Donate screen.

## Before v0.1
- The app MyTvApp started from: TVapp by KaashDev ([KaashDev/TVapp](https://github.com/KaashDev/TVapp)).
