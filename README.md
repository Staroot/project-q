# Project Q (Prototype)

Project Q is a beginner-friendly, web-based 4-key rhythm game prototype built with Vite + TypeScript using Canvas and Web Audio API.

## What this project is

A playable MVP rhythm game with:
- 4 lanes
- default keys `D F J K`
- timing judgments (`Perfect`, `Good`, `Miss`)
- score, combo, accuracy
- health / fail gauge
- start, gameplay, pause, and result flow
- one built-in demo chart driven by data
- built-in generated metronome-like audio pattern (no copyrighted assets)

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

- `Enter`: start from title
- `D F J K`: hit lanes
- `Esc`: pause/resume during play
- `R`: restart song

## Project structure

- `index.html` – app entry HTML
- `src/main.ts` – game loop, state machine, audio timing, scoring, rendering, input
- `src/styles.css` – basic UI layout and styling
- `docs/architecture.md` – small architecture note
- `AGENTS.md` – instructions for future agent tasks

## Current limitations

- Only one built-in chart is included.
- Audio is generated ticks rather than full song audio.
- No long-note/hold-note support yet.
- No settings menu or key remapping UI yet.
- Timing/judgment tuning is intentionally simple.

## Next recommended milestones

1. Add file-based song + chart loading (audio file + JSON chart).
2. Add offset calibration and settings persistence.
3. Add hold notes and more chart patterns.
4. Improve visual feedback (lane effects, hit splash, animations).
5. Add difficulty selection and multiple demo songs.
