# Accessibility test report: WCAG 2.2 AA

What was checked in MyTvApp against WCAG 2.2 Level A and AA, how, and what remains open. Written for version 0.12.8 on the branch `dev`.

This report does not say the app is accessible in general. It gives a verdict for every Level A and AA success criterion (4.1.1 Parsing is left out because WCAG 2.2 removed it), the evidence for each verdict, and what was not tested. No code was changed for this report.

## What the app is, and what that changes

MyTvApp is a single-page app for Samsung smart TVs, driven by a TV remote (arrow keys, OK, Back, channel keys and play/pause). It has no login, no forms except the playlist address field, no links, no images of text and no prerecorded media. The page is a fixed 1920×1080 canvas with overflow hidden.

Two consequences shape the results:

- **Remote focus is drawn by code, not by the browser.** Every button has `tabindex="-1"`, and the app moves a `.focused` CSS class around. The browser's own focus never moves (`document.activeElement` stays `BODY`), and the page has no ARIA roles, states or live regions. Sighted users see focus well. Screen readers such as Samsung Voice Guide get nothing to announce.
- **Zoom and reflow do not apply to a TV.** The viewer cannot zoom a TV page, and the layout is built for 1920×1080. These criteria are marked as limits, not passes.

## Status key

- **PASS**: the criterion is met, with the evidence given.
- **FAIL**: the criterion is not met. The evidence is given.
- **NOT APPLICABLE**: the app has no content of the kind the criterion covers.
- **NOT TESTED**: not checked, or not checkable without more information. The reason is given.

## Results

### Level A

| Criterion | Status | Evidence |
|---|---|---|
| 1.1.1 Non-text content | PASS | No `<img>` elements on any screen checked. Channel logos are CSS backgrounds next to the channel name, which says the same thing. Menu icons are inline SVG beside text labels. |
| 1.2.1 Audio-only and video-only (prerecorded) | NOT APPLICABLE | The app plays live streams only. |
| 1.2.2 Captions (prerecorded) | NOT APPLICABLE | No prerecorded media. |
| 1.2.3 Audio description or alternative (prerecorded) | NOT APPLICABLE | No prerecorded media. |
| 1.3.1 Info and relationships | FAIL | Still open: Settings section titles and the TV Guide title are `<div>`s, not headings, and the lists have no list structure. Fixed in the focus step: switches now carry `role="switch"` and `aria-checked`; channel rows and guide cells are named buttons; the URL field has a name. |
| 1.3.2 Meaningful sequence | PASS | DOM order matches the visual order (menu, then screen). |
| 1.3.3 Sensory characteristics | PASS | Instructions name the remote keys with text ("OK full screen", "◀ menu"). None relies on shape, position or sound alone. |
| 1.4.1 Use of colour | PASS, with a caveat | A switch's on and off states differ in colour and knob position. The LIVE and Favorite badges carry text. Unreliable channels are shown dimmed by colour alone; their reason appears in the caption only while the row is focused. |
| 1.4.2 Audio control | PASS, with a caveat | Live channels start with sound and no mute. The remote's play/pause key pauses playback (`togglePlayPause`). There is no on-screen control. The channel preview also starts with sound after 0.7 s on focus (`PREVIEW_DELAY_MS`). Not confirmed on a TV. |
| 2.1.1 Keyboard | PASS | Every feature was reached with arrow keys, OK and Back in desktop Chromium (Live TV, TV Guide, Settings sections, Back out of each). Tested with synthetic key events, not a real remote. |
| 2.1.2 No keyboard trap | PASS | Back returns to the menu from every screen tested. While the URL field's on-screen keyboard is open, Back closes it (`closeUrlKeyboard(false)`). |
| 2.1.4 Character key shortcuts | NOT TESTED | Digit keys enter a channel number. Whether they stay active only on the player was not checked. |
| 2.2.1 Timing adjustable | PASS | No user task has a time limit. The toast (3 s), the full-screen caption (5 s) and number entry (2 s) show or commit information without requiring a response. Number entry commits what was typed, so a slow entry still works. |
| 2.2.2 Pause, stop, hide | PASS, with a caveat | Live video is the only moving content. The remote's play/pause key pauses it (see 1.4.2). The clock updates every 20 s and does not move. |
| 2.3.1 Three flashes or below threshold | PASS | The app shows no flashing. The loading spinner rotates. Flashing inside streams is not checked. |
| 2.4.1 Bypass blocks | PASS | One page. The side menu is the only repeated block and comes first. |
| 2.4.2 Page titled | PASS | `<title>MyTvApp</title>`. The title does not change per screen. |
| 2.4.3 Focus order | PASS (after the focus fix) | The browser's own focus now follows the remote's highlight (`syncDomFocus` in `js/main.js`). Checked by `e2e/app.spec.js` "focus: the browser focus follows the remote". Not checked with a screen reader. |
| 2.4.4 Link purpose (in context) | NOT APPLICABLE | The app has no links. |
| 2.5.1 Pointer gestures | NOT APPLICABLE | No multipoint or path-based gestures. Remote only. |
| 2.5.2 Pointer cancellation | NOT APPLICABLE | No pointer input. |
| 2.5.3 Label in name | PASS | Visible text labels match their names. The collapsed side menu hides its labels (see 4.1.2). |
| 2.5.4 Motion actuation | NOT APPLICABLE | No device-motion input. |
| 3.1.1 Language of page | PASS | `<html lang="en">`. |
| 3.2.1 On focus | PASS, with a caveat | Moving focus changes no page or context. Focusing a channel starts its preview (see 1.4.2). |
| 3.2.2 On input | PASS | Changing a switch or value changes only that setting. No new window or page opens. |
| 3.3.1 Error identification | PASS, with a caveat | Errors are shown as text ("Could not load …: Failed to fetch"). The toast is not announced to assistive technology (see 4.1.3). |
| 3.3.2 Labels or instructions | PASS | The URL field has visible instructions above it ("Enter the URL of your M3U / M3U8 playlist"). Its programmatic label is missing (see 1.3.1 and 4.1.2). |
| 4.1.2 Name, role, value | PASS (after the focus fix, with a caveat) | Fixed: focus reaches the element the remote is on; switches have `role="switch"` and `aria-checked`; channel rows and guide cells are named buttons, with the current programme's state; the collapsed side menu's labels are kept visually hidden so each icon has a name; the URL field and confirm dialog are named. Caveat: checked in desktop Chromium, not with Voice Guide on a TV. |

### Level AA

| Criterion | Status | Evidence |
|---|---|---|
| 1.2.4 Captions (live) | FAIL | The app has no caption display or selection. Live streams that carry captions will not show them, and the app gives no way to turn them on. |
| 1.2.5 Audio description (prerecorded) | NOT APPLICABLE | No prerecorded media. |
| 1.3.4 Orientation | PASS | The TV runs in landscape only. |
| 1.3.5 Identify input purpose | NOT APPLICABLE | The URL field is not personal data. |
| 1.4.3 Contrast (minimum) | FAIL | Measured in the browser: channel numbers (`.live-num`, #8e8e93, 19 px) 3.97:1; menu counts ("none yet", `.menu-count`, #8e8e93, 18 px) 3.97:1; placeholder letters in channel logo tiles (`.live-logo`, 20 px) 2.11:1 to 3.29:1, lowest on dimmed rows. Estimated from CSS, not measured: the input tip ("Press OK on the field…", #636366, 20 px) about 2.8:1. See the contrast table below. |
| 1.4.4 Resize text | FAIL (limit of the fixed canvas) | No text-size setting. The layout is fixed at 1920×1080 with overflow hidden. On a 800×600 window the content is cut off and cannot be scrolled (seen in the browser). On the TV, the canvas matches the screen, so the criterion is not met only as a limit of the design. |
| 1.4.5 Images of text | PASS | All text is real text. |
| 1.4.10 Reflow | FAIL (limit of the fixed canvas) | Same cause as 1.4.4. At 320 CSS px wide, nothing reflows. |
| 1.4.11 Non-text contrast | FAIL | The URL field's border (#2c2c2e) on the panel (about #1c1c1e) is about 1.1:1 (estimated from CSS). The field is identified only by its border and its "https://" value. The focus state (white) passes. Switch states pass. |
| 1.4.12 Text spacing | NOT TESTED | Code risk: the programme description has `max-height: 58px` with `overflow: hidden`, and the next-programme line is a single line with ellipsis. Extra spacing would likely clip text. Not tested in the browser. |
| 1.4.13 Content on hover or focus | NOT APPLICABLE | No hover-only content. |
| 2.4.5 Multiple ways | NOT APPLICABLE | Screens are reached through one menu. This is not a set of web pages. |
| 2.4.6 Headings and labels | FAIL | The Live TV screen has one `<h1>`. The other screens (TV Guide, Settings sections) have no headings. The URL field has no label. |
| 2.4.7 Focus visible | PASS | The focused item is a bright white pill with dark text (screenshots of the menu and Settings). |
| 2.4.11 Focus not obscured (minimum) | PASS, with a caveat | The focused item is lifted (z-index 2) and no panel covers another. Not checked under the update notice or over the picture. |
| 2.5.7 Dragging movements | NOT APPLICABLE | No drag actions. |
| 2.5.8 Target size (minimum) | NOT APPLICABLE | Remote only. Caveat: Samsung's pointer remote mode would make this apply. Target sizes were not measured. |
| 3.1.2 Language of parts | NOT TESTED | Playlist names and programme titles can be in any language. The app does not mark them. |
| 3.2.3 Consistent navigation | PASS | The side menu stays in the same place and order on every screen (Live TV, TV Guide, Settings). |
| 3.2.4 Consistent identification | PASS | Favourite is always the star and "Favorite"; Back and OK mean the same everywhere. |
| 3.2.6 Consistent help | PASS | Help exists in one place only (Settings, Report a problem), so it is consistent. |
| 3.3.3 Error suggestion | FAIL | A failed playlist load says "Could not load …: Failed to fetch" with no suggestion (for example, check the address). |
| 3.3.4 Error prevention (legal, financial, data) | PASS | Deleting a playlist opens a confirm dialog (`confirmModal`). Not exercised in the browser. |
| 3.3.7 Redundant entry | NOT APPLICABLE | No multi-step entry. |
| 3.3.8 Accessible authentication (minimum) | NOT APPLICABLE | No login. |
| 4.1.3 Status messages | PASS (after the focus fix, with a caveat) | Fixed: the toast, loading message, live status line and update notice are `role="status"` or `aria-live="polite"`, and the error box is `role="alert"`. Caveat: the regions are in the DOM; whether the TV speaks them is not tested. |

### New in WCAG 2.2, by name

- **2.4.11 Focus Not Obscured (Minimum)**: PASS, with a caveat (see table).
- **2.5.7 Dragging Movements**: NOT APPLICABLE.
- **2.5.8 Target Size (Minimum)**: NOT APPLICABLE on the remote. Caveat: pointer mode on a Samsung remote.
- **3.2.6 Consistent Help**: PASS.
- **3.3.7 Redundant Entry**: NOT APPLICABLE.
- **3.3.8 Accessible Authentication (Minimum)**: NOT APPLICABLE.

## Contrast measurements

Measured in desktop Chromium at 1920×1080 with the app's own CSS. The browser reads the rendered colours, so these numbers are the ones to trust.

| Element | Colour | Size | Ratio | Needed | Source |
|---|---|---|---|---|---|
| `.live-num` (channel number) | #8e8e93 | 19 px | 3.97:1 | 4.5:1 | Browser, Live TV list |
| `.menu-count` ("none yet") | #8e8e93 | 18 px | 3.97:1 | 4.5:1 | Browser, Settings |
| `.live-logo` letter (dimmed row) | #aeaeb2, 0.45 opacity | 20 px | 2.11:1 | 4.5:1 | Browser, TV Guide and Live TV |
| `.live-logo` letter (normal row) | #aeaeb2 | 20 px | 3.29:1 | 4.5:1 | Browser |
| Input tip | #636366 | 20 px | about 2.8:1 | 4.5:1 | Estimated from CSS, not measured |
| URL field border | #2c2c2e | n/a | about 1.1:1 | 3:1 | Estimated from CSS, not measured |

The browser measurements are over black and the panel's dark base, not over live video. Glass panels sit over the picture on the TV, so the real background can be lighter or darker. The worst case over a bright picture was not measured.

Colours that pass in the browser or by calculation: the menu and body text (#8e8e93 on the dark panel is 5.2:1 by calculation), the dimmed focused row (#48484a on white, 8.4:1), the focused sub-line (#3a3a3c on white, 10.4:1), the LIVE badge (#ff453a on black, 6.2:1), the error colour (#ff6961 on the panel, about 6.0:1), and the channel number on the full-screen caption (white at 45%, about 4.4:1 on black, but it is about 52 px so the 3:1 large-text threshold applies).

## What was tested, and how

| Test | What it covered | Result |
|---|---|---|
| Local serve of `index.html` | Loaded the app in desktop Chromium, with a sample playlist of three channels in local storage | Rendered the Live TV screen, the TV Guide and the Settings screens |
| Contrast audit (script over every visible text node) | Computed colour and effective background, including the glass panel and the focused state | Live TV: 17 text nodes, 1 failing (`.live-logo`). After the channel list was included: `.live-num` and `.menu-count` also fail. TV Guide: 10 nodes, pass. Settings (Playback section): 15 nodes, pass |
| DOM audit | Focus, ARIA, headings, landmarks, images, live regions, button tab index | `activeElement` = `BODY`; 15 of 15 buttons `tabindex="-1"`; 1 element with an ARIA attribute; 0 roles; 0 live regions; 0 images; one `<nav>`; no `<main>` |
| Remote simulation | Synthetic key events for Left, Right, Up, Down, OK and Back | Moved focus through the menu, opened the TV Guide and Settings, and returned with Back |
| Static code review | Every CSS colour, font size, animation and motion query; every timer; the key handler; the caption and subtitle code; the switch markup; the number entry | The findings above |

## What was not tested

- **A real TV and a real remote.** All browser testing used synthetic key events in desktop Chromium.
- **A screen reader.** Samsung Voice Guide was not run. The statements about what it would announce come from the DOM audit.
- **Several screens.** In the browser, Settings was checked on its first-run Playlists view and on the Playback section only (a loop over the sections kept returning to Playback). The other Settings sections, the player overlay, the channel panel, the Add Playlist screen, the confirm dialog and the update notice were checked from CSS only. The TV Guide had no programme data, so its grid was not checked.
- **Contrast over live video.** See the contrast section.
- **Live streams.** Captions, flashing and audio were not checked against any real stream.
- **Text spacing (1.4.12).** Not run in the browser.
- **Target size.** Not measured. Only matters if pointer mode is used.

## Open decisions

1. **Focus model: done.** The remote's highlight now also moves the browser's focus (see 2.4.3 and 4.1.2). Still open: headings and list structure (1.3.1, 2.4.6), so the Settings section titles and the TV Guide title need to become headings.
2. **Captions.** Decide whether the app should show captions when a stream offers them (1.2.4).
3. **Contrast tokens.** The grey text tokens (#8e8e93, #636366, #aeaeb2 at 0.45 opacity on the logo tiles) need raising to 4.5:1 on the glass panels. This is a palette decision. The colours are the app's design direction.
4. **Preview audio.** Decide whether the channel preview should start muted (1.4.2 and 3.2.1 caveats).

## TV test to confirm the screen-reader result

Turn on Voice Guide in the TV's accessibility settings (the menu path varies by TV model). Open MyTvApp, and move the remote up and down the side menu. The expected result, from the code, is silence: no item names are spoken and no focus change is announced. If Voice Guide reads the menu items, the code finding in 4.1.2 needs to be revisited.
