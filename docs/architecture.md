# Architecture Note (MVP)

## Main principles

- Keep gameplay state logic and drawing logic separated inside `RhythmGame` methods (`update`/`applyJudgment` vs `draw`).
- Keep chart data data-driven (`Chart` + `ChartNote`) so adding songs means adding data rather than rewriting systems.
- Drive note timing from audio time (`AudioContext.currentTime`) via `PulseAudioTrack#getSongTime`.

## Runtime flow

1. `start` scene waits for user input (required by browser audio autoplay policy).
2. `playing` scene:
   - song time is read from audio clock
   - misses are resolved by hit window
   - render computes note y-position from `note.time - songTime`
3. `paused` scene freezes progression by storing song time and stopping scheduling.
4. `result` scene shows score/judgment summary.

## Why generated audio

To keep prototype fully legal and runnable from a fresh repo without external asset downloads, audio is generated with Web Audio oscillators. This still allows practical rhythm/timing testing.
