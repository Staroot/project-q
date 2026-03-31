# Project Q (Prototype)

Project Q is a beginner-friendly, web-based 4-key rhythm game prototype built with Vite + TypeScript using Canvas and Web Audio API.

## What exists now

Playable MVP loop:
- start screen
- settings/calibration screen
- song selection (built-in WAV demo + generated fallback)
- gameplay
- pause/resume
- result screen

Core rhythm systems:
- 4 lanes
- default keys `D F J K`
- timing judgments (`Perfect`, `Good`, `Miss`)
- score, combo, accuracy
- health / fail gauge

## Demo song + chart pipeline

### Built-in audio demo song

- Audio asset ID: `demo-pulse-text-v1` (inside `src/charts/demo-audio.json`).
- The demo audio is generated from deterministic text-based synthesis code in `src/main.ts` (`createDemoPulseWavObjectUrl`) and turned into a runtime Blob/ObjectURL.
- The game still uses real file-like playback via `HTMLAudioElement` for this mode (ObjectURL source).
- Judgment timing uses audio playback time (`audio.currentTime`) so note sync follows the actual song clock.

### Chart data format

- Demo chart file: `src/charts/demo-audio.json`
- Current fields:
  - `id`
  - `title`
  - `artist`
  - `bpm`
  - `offset`
  - `duration`
  - `audioPath`
  - `previewText`
  - `notes[]`
- Each note has:
  - `lane` (0-3)
  - `time` (seconds)

### Fallback generated mode

- A generated metronome/tick mode still exists as a fallback.
- It keeps the prior no-audio-file path available for quick testing.

## Settings & calibration

- Open **Settings / Calibration** from the start screen.
- Adjust **Timing Offset** in ±10ms steps (range `-250ms` to `+250ms`).
- Use **Play Test Ticks** for quick manual calibration retries.
- Optionally adjust **Note Speed** in settings.
- Press **Back to Start** (or `Esc`) to return.

### What timing offset does

- Gameplay uses `audio time + timing offset` for hit and miss judgment checks.
- Positive values shift judgment later; negative values shift judgment earlier.
- This is global and applies to both built-in WAV and generated fallback modes.

### Persistence

Settings are saved to `localStorage` key:

`project-q-settings-v1`

Persisted values:
- `timingOffsetMs` (required calibration value)
- `selectedSongIndex`
- `noteSpeed`

## Install dependencies

```bash
npm install
```

## Run locally

```bash
npm run dev
```

Then open the printed local URL (default `http://localhost:5173`).

## Build check

```bash
npm run build
```

## Controls

- `Enter`: start selected song from title screen
- `D F J K`: hit lanes
- `Esc`: pause/resume during play
- `Esc` (settings screen): return to start
- `R`: restart song

## Project structure

- `index.html` – app entry HTML
- `src/main.ts` – game loop, state machine, song selection, chart handling, scoring, rendering, input, and deterministic text-based demo audio synthesis
- `src/charts/demo-audio.json` – data-driven demo chart definition
- `src/styles.css` – basic UI layout and styling
- `docs/architecture.md` – small architecture note
- `AGENTS.md` – instructions for future agent tasks

## How to add another song/chart

1. Add an audio file under `public/audio/` (for file-backed songs).
2. Or add a text-based audio asset generator in `src/main.ts` and reference it with `audioAssetId` from chart metadata.
3. Add a chart JSON under `src/charts/` with the same fields as `demo-audio.json`.
4. Register it in `builtInSongs` in `src/main.ts`:
   - `mode: 'file'` + `audioPath` (public file) or `audioAssetId` (text-generated ObjectURL)
   - or `mode: 'generated'` for oscillator fallback
5. Verify timing, then tweak chart note times and `duration`.

## Manual test note (new feature)

- On start screen, select **Built-in WAV Demo**, press **Start**, confirm audio plays and notes can be hit in sync.
- Pause with `Esc`, resume with `Esc`, and verify sync continues.
- Return to start/retry and run **Generated Tick Fallback** to confirm fallback mode still plays.
- Open **Settings / Calibration**, change offset, run test ticks, and confirm offset value persists after reload.

## Current limitations

- Only one real file-backed demo song is included.
- Demo file mode currently uses generated text-based audio (no committed binary audio file).
- Chart format currently supports tap notes only (no hold/long notes).
- Song metadata and chart schema are intentionally minimal.
- Calibration is manual (no automatic offset suggestion yet).

## Next recommended milestones

1. Add offset calibration and settings persistence.
2. Add hold notes and richer chart patterns.
3. Add separate difficulty charts per song.
4. Improve visual feedback (lane effects, hit splash, animations).
