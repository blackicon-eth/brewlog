# Brewlog

On-device pour-over coffee journal with an offline AI brewing advisor (QVAC + Qwen3 4B).
Log coffees and brews; the advisor reasons over your own data to suggest next-brew
adjustments and the best recipe per bean. Everything runs locally — no cloud.

## Requirements
- A **physical** Android device (Galaxy S23-class, 8 GB RAM). QVAC does **not** run on
  emulators/simulators.
- Node ≥ 22.17, npm ≥ 10.9.

## Setup
```bash
npm install
npx expo prebuild
npx expo run:android --device   # builds and installs on a connected phone
```
First launch downloads the model (~2.5 GB) on first AI use — watch the terminal.

## Tests (pure logic)
```bash
npm test
```
Covers ratio math, brew formatting, the SQLite data layer (in-memory), and prompt builders.

## Manual on-device checklist
- [ ] App launches to the Coffees list.
- [ ] Add / edit / delete a coffee.
- [ ] Log / edit / delete a brew; ratio preview updates live; brews sort newest-first.
- [ ] Deleting a coffee removes its brews.
- [ ] Advisor status pill shows downloading → loading → ready.
- [ ] Diagnose streams reasoning + suggestion token-by-token.
- [ ] Best recipe streams a justified recipe.
- [ ] Stop halts a stream; leaving the screen mid-stream doesn't crash.
- [ ] Backgrounding then foregrounding the app keeps the advisor working (suspend/resume).

## Architecture
- `src/db` — SQLite schema + data layer (testable via a `better-sqlite3` adapter).
- `src/lib` — pure helpers (ratio, formatting, ids).
- `src/qvac` — all `@qvac/sdk` use: model lifecycle, streaming, prompt builders, React context.
- `src/screens` — five screens wired through `@react-navigation/native-stack`.

Design + plan: `docs/superpowers/specs/` and `docs/superpowers/plans/`.
