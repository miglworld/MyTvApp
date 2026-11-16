# lib

Third-party code bundled with the app, unchanged.

| File | What it is |
|---|---|
| `hls.min.js` | [hls.js](https://github.com/video-dev/hls.js/) 1.6.19, the official minified build. The app's third player: used when neither Samsung's player nor the browser's own can play a channel. |
| `hls.LICENSE` | Its license (Apache 2.0). |

`scripts/check.sh` compares `hls.min.js` with the SHA-256 of the official 1.6.19 build, so a changed or replaced copy fails the checks. To move to a newer hls.js, take the official build from its release, update the checksum and version in `scripts/check.sh`, and build a new package: this file is part of the installed app and is not replaced by self-update.
