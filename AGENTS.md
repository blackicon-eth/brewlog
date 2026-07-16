# Brewlog — agent guide

Offline pour-over coffee journal for a **physical Android phone** (developed on a Galaxy S23).
Users log coffees (with photos), brews across four methods, and a per-method recipe page in
SQLite; an on-device LLM (QVAC + Qwen3 1.7B) reasons over their own data. No cloud, no account,
no emulator support (QVAC needs a real GPU).

## Expo HAS CHANGED

This is **Expo SDK 54** (React Native 0.81). Read the exact versioned docs at
https://docs.expo.dev/versions/v54.0.0/ before writing any code — APIs you remember from
older SDKs have moved or been replaced (e.g. expo-file-system 19 has a new class-based
`File`/`Directory` API with built-in SAF pickers; no expo-document-picker needed).

## Commands

```bash
npm test                                   # all Jest tests (pure logic, no device/emulator)
npx jest src/lib/__tests__/ratio.test.ts   # one test file
npx jest -t "rejects a newer version"      # one test by name
npx tsc --noEmit                           # typecheck — keep this clean
npm install                                # postinstall applies QVAC workarounds (see README Notes)
npm run prebuild                           # expo prebuild + strip bare-posix addon
npx expo run:android                       # native build + install + Metro (device must be on adb)
npx expo start                             # Metro only (debug builds load JS from it via adb reverse)
```

Dev loop on the device: JS/TS edits hot-reload through Metro (Fast Refresh) — do **not**
force-stop/relaunch the app to see UI changes. Check Metro with `curl localhost:8081/status`.
README.md has the full toolchain setup (JDK 17 tarball, headless Android SDK) and a
troubleshooting table for the known QVAC/bare-kit build failures.

## Hard constraints

- **Zero new dependencies, zero native risk.** Any new native module forces a dev-client
  rebuild and risks the fragile QVAC native setup. Use built-ins: RN `Animated`,
  `PanResponder`, `KeyboardAvoidingView` — no reanimated/gesture-handler/svg. Check whether
  an already-installed Expo package covers the need before proposing anything new.
- **Version pins are load-bearing** (see README "Notes"): `react-native-bare-kit` 0.14.5
  (0.15.0 crashes at startup), model `QWEN3_1_7B_INST_Q4` (4B gets OOM-killed on 8 GB
  phones), and the two `scripts/fix-*.js` workarounds run by postinstall/prebuild.

## Architecture

The codebase is split into a **pure, Jest-tested core** and a **thin untested UI layer**.
Put every piece of logic that can be pure (math, formatting, validation, prompt building,
SQL) in the core; screens should only wire hooks to components.

- `src/lib` — pure helpers (ratio math, brew tools, ledger file format/validation,
  `ledgerEvents` pub-sub). No React, no Expo imports. Fully tested.
- `src/db` — data layer over a minimal async `Db` interface (`src/db/types.ts`). At runtime
  it's expo-sqlite; tests wrap in-memory `better-sqlite3` behind the same interface
  (`src/db/testdb.ts`), so the whole layer is testable on Node. Schema: `coffees` with three
  child tables — `brews`, `coffee_photos`, and per-method `recipes` (PK `(coffee_id, method)`)
  — all `ON DELETE CASCADE`. Small key-value persistence uses `expo-sqlite/kv-store`
  (`Storage.getItemSync/setItemSync`; `src/hooks/usePersistedState.ts`). Photo files live on
  disk via `src/media/photoStore.ts` (rows hold the `uri`); the ledger export embeds them as
  base64.
- `src/qvac` — the **only** place `@qvac/sdk` is used. `service.ts` owns the model lifecycle
  (download/load/unload) behind a FIFO mutex; `QvacProvider.tsx` exposes it as React context
  plus the persisted AI settings (enabled/model/onboarded); `advisor.ts`/`intake.ts` are pure
  prompt builders (tested). Screens never touch the SDK directly.
- `src/screens` + `src/navigation` — a native-stack root whose first route is `MainTabs`,
  a **hand-rolled tab container that keeps all five tabs permanently mounted** (inactive tabs
  get `display: "none"`). Consequence: switching tabs never fires navigation focus events —
  `useFocusEffect` only runs when the stack pops back. Cross-tab data invalidation therefore
  goes through `src/lib/ledgerEvents.ts` (`emitLedgerReplaced`/`onLedgerReplaced`); subscribe
  in any screen that must refetch when the ledger changes underneath it.
- `src/components/ui` — hand-styled UI kit ("Artisanal Brew Ledger" look: warm paper, ruled
  lines, EB Garamond headlines + Hanken Grotesk body). Everything derives from
  `src/design/tokens.ts` — colors, spacing, type variants, and **`motion`** (never hardcode
  animation durations/springs; always use the motion tokens).

## Android/UI gotchas (all learned on-device)

- **EB Garamond descenders clip on Android** (g/y tails). Headline text over ~2 words needs
  `lineHeight` bumped (34 for `headlineMd`, 48 for `headlineLg`) and
  `includeFontPadding: false`.
- **Fabric flickers elevation shadows and native-driver opacity on restyle.** Surfaces that
  restyle frequently use hairline borders instead of elevation; small fades in
  re-render-heavy trees use the JS animation driver.
- Long lists: Android's subview clipping blanks lists mid-fling — see the SectionList props
  in `src/screens/BrewsScreen.tsx` for the working recipe.
- **Streaming text**: never grow one big `Text` — Android re-runs line-breaking over the
  whole node per change. Freeze settled content in memoized chunks/lines (see
  `MarkdownText`, `ReasoningDisclosure`, `chunkPlainText`), batch token flushes, use
  `textBreakStrategy="simple"`, and follow the stream only via `useStickyScroll`
  (gesture-guarded, non-animated). Know the ceiling: scrolling WILL still stutter while
  the model generates — that's the 1.7B saturating the S23's CPU/GPU, verified 2026-07-12
  by A/B (same content scrolls smoothly after generation ends). Don't burn time trying
  to fix it in view code; the only lever is a smaller model.

## Copy voice

Calm ledger language. The data is the user's **"ledger"** (never "database"); the AI is
**"the assistant"** (never "coach"); model descriptions never say "this phone". Match the
existing sentence-case, unhurried tone in modals and empty states.
