# Project Q Architecture Notes

## Runtime flow

- `RhythmGame` owns scene state (`start`, `playing`, `paused`, `result`).
- Main loop (`requestAnimationFrame`) runs `update()` then `draw()`.
- Input handlers route global keys into scene transitions and lane hits.

## Song system (current)

- Song catalog lives in `builtInSongs` in `src/main.ts`.
- Each song references a `Chart` and a playback mode:
  - `file`: real audio file (`HTMLAudioElement`)
  - `generated`: oscillator/metronome fallback (`AudioContext` scheduler)
- The demo file-backed song loads chart data from `src/charts/demo-audio.json` and resolves `audioAssetId` to a runtime WAV Blob/ObjectURL generated from deterministic text synthesis code (no committed binary audio file required).
- Player settings are stored in `localStorage` (`project-q-settings-v1`) and currently include timing offset, selected song index, and note speed.

## Timing model

- Gameplay timing is pulled from the selected audio backend via `getSongTime()`.
- Judgment timing uses `getSongTime() + timingOffsetMs/1000`, where `timingOffsetMs` is user-controlled in settings.
- Hit detection compares input time vs nearest note time in lane.
- Misses are auto-resolved when notes pass beyond the `Good` window.

## Calibration UX

- Start screen includes a **Settings / Calibration** entry point.
- Settings screen supports manual offset controls (±10ms, clamped to ±250ms) and a simple test-tick preview.
- Calibration flow is intentionally manual and retry-friendly; no automatic suggestion logic yet.

## Scoring / judgments

- Judgment windows: `Perfect` 50ms, `Good` 110ms, otherwise `Miss`.
- Existing score/combo/health behavior is intentionally simple and preserved.

## Chart model (v1)

Each chart note uses:
- `lane` (0-3)
- `time` (seconds)

Chart-level metadata includes title/artist/bpm/audio path/offset/duration/preview.

## Non-goals (for now)

- Hold notes and release judgments
- Dynamic BPM changes / stops
- Modifiers and skins
