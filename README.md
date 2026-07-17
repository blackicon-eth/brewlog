# Brewlog

On-device pour-over coffee journal with an offline AI assistant (QVAC + Qwen3). Log
coffees and brews in a warm paper ledger; the assistant reasons over your own data to
chat about your brewing, autofill forms from plain English, diagnose a brew, and propose
the best recipe per bean. Everything runs locally — no cloud, no account.

## What's inside

- **Journal** — coffees (each with photos) and their brews across four methods (filter,
  French press, moka, espresso): dose, water, ratio, grind, temperature, time, rating,
  tasting notes. Keep a per-method **recipe** page per coffee. Deleting a coffee removes its
  brews, photos, and recipes.
- **AI assistant** (opt-in, fully on-device) — freeform chat, "Autofill with AI" on the
  coffee/brew forms, per-brew **Diagnose**, and a **Best recipe** per bean. A model
  picker in Settings offers Qwen3 0.6B–4B and Llama 3.2 1B; models too big for the
  device's RAM are disabled.
- **Tools** — deterministic offline calculators: **Brew Ratio**, a guided **Brew
  Timer**, and the **4:6 Method** planner live today; Extraction Yield and Coffee
  Compass are built but gated behind "coming soon" cards.
- **Your data** — export the whole ledger (coffees, brews, photos, and recipes) to a
  versioned JSON file and import it back (validated, all-or-nothing replace).
- **Two languages** — English and Italian, switchable live in Settings (first launch
  follows the device locale). The assistant itself always speaks English.

## Requirements

- A **physical** Android device (developed/tested on a Galaxy S23; its 8 GB RAM runs the
  default Qwen3 1.7B comfortably — lower-RAM devices are offered smaller models). QVAC
  uses llama.cpp and does **not** run on emulators/simulators.
- **JDK 17** (newer JDKs break the React Native 0.81 Gradle build).
- Node ≥ 22.17, npm ≥ 10.9.
- The Android SDK (platform-tools/`adb`); the Gradle build auto-installs the NDK/CMake it
  needs. See [Android setup from scratch](#android-setup-from-scratch) if you don't have these.

## Quick start

If your machine already has JDK 17 + the Android SDK and a phone is connected (`adb devices`
shows it):

```bash
npm install            # postinstall applies two QVAC workarounds (see Notes)
npm run prebuild       # = expo prebuild + strip the bare-posix addon (see Notes)
npx expo run:android   # builds the native app, installs it, starts Metro
```

The assistant is opt-in: the first launch offers it (you can also enable it later in
Settings → The advisor), and enabling downloads the model — **~1.1 GB** for the default
Qwen3 1.7B — so keep the phone on Wi-Fi. The model is cached on-device after that.

> The debug build loads its JavaScript from the **Metro** dev server on this machine (over
> `adb reverse tcp:8081`). Keep Metro running while using the app. To launch **without** the
> laptop, build a release APK: `npx expo run:android --variant release` (bundles the JS).

## Tests (pure logic, no device)

```bash
npm test
```

Covers the tool math (ratio, extraction yield, 4:6, pour schedules, coffee compass),
brew formatting, the SQLite data layer including coffee photos and per-method recipes
(in-memory `better-sqlite3` behind the same `Db` interface), the ledger file
format/validation and the import transaction, the prompt builders, and the assistant's
model lifecycle. 330 tests across 25 suites; `npx tsc --noEmit` is clean.

## Android setup from scratch

One-time toolchain setup for a Linux machine with no Android tooling (commands shown for
Fedora; adapt the package step for your distro).

### 1. JDK 17

React Native 0.81 needs JDK **17**. If your distro no longer ships it (e.g. Fedora 44 only has
25/26), install Eclipse Temurin 17 as a tarball in your home dir — no sudo:

```bash
curl -fsSL -o /tmp/temurin17.tar.gz \
  "https://api.adoptium.net/v3/binary/latest/17/ga/linux/x64/jdk/hotspot/normal/eclipse"
mkdir -p ~/jdks && tar -xzf /tmp/temurin17.tar.gz -C ~/jdks
~/jdks/jdk-17.0.19+10/bin/java -version    # expect 17.x (dir name varies by patch)
```

### 2. Android SDK (headless command-line tools — no Android Studio needed)

```bash
# Get the current cmdline-tools URL from https://developer.android.com/studio
curl -fsSL -o /tmp/cmdtools.zip \
  "https://dl.google.com/android/repository/commandlinetools-linux-14742923_latest.zip"
mkdir -p ~/Android/Sdk/cmdline-tools
rm -rf /tmp/cmdtools-extract && mkdir /tmp/cmdtools-extract
unzip -q /tmp/cmdtools.zip -d /tmp/cmdtools-extract
mv /tmp/cmdtools-extract/cmdline-tools ~/Android/Sdk/cmdline-tools/latest
```

### 3. Environment variables

Add to `~/.bashrc` (adjust the JDK dir name if your patch version differs), then
`source ~/.bashrc`:

```bash
export JAVA_HOME="$HOME/jdks/jdk-17.0.19+10"
export PATH="$JAVA_HOME/bin:$PATH"
export ANDROID_HOME="$HOME/Android/Sdk"
export PATH="$PATH:$ANDROID_HOME/platform-tools:$ANDROID_HOME/cmdline-tools/latest/bin"
```

Accept the SDK licenses and install platform-tools (`adb`):

```bash
yes | sdkmanager --licenses
sdkmanager "platform-tools"
java -version && adb --version    # sanity check
```

The first Gradle build auto-downloads the rest at the versions the project pins — **NDK
`27.0.12077973`**, CMake, build-tools, and the SDK platform. To front-load them:
`sdkmanager "platforms;android-36" "build-tools;36.0.0" "ndk;27.0.12077973" "cmake;3.22.1"`.

### 4. Connect your phone

Enable **Developer options** (Settings → About phone → tap *Build number* 7×), then either:

**USB (most stable):** turn on **USB debugging**, plug in, set USB mode to *File transfer*,
accept the *Allow USB debugging?* prompt. `adb devices` should list it as `device`.

**Wireless** (same Wi-Fi): turn on **Wireless debugging** → *Pair device with pairing code*,
then:

```bash
adb pair    192.168.x.x:<pairingPort>   # enter the 6-digit code shown on the phone
adb connect 192.168.x.x:<connectPort>   # the main screen's port (differs from the pairing one)
adb devices                             # expect status "device"
```

The wireless connect port changes whenever you toggle Wireless debugging, and the link drops on
sleep — turn on *Stay awake* and keep the screen on during long builds. If two entries appear
for one phone (manual + mDNS `adb-XXXX…`), `adb disconnect` the manual `ip:port` one so tools
don't see "more than one device".

### 5. Build & run

```bash
cd <repo>
npm install
npm run prebuild
npx expo run:android   # first native build takes several minutes
```

### 6. First launch

The app opens on the Home ledger with a two-step welcome card: a short overview, then an
optional offer to enable the assistant (model download progress shows in the card).
Decline and Brewlog is a plain journal — enable the assistant any time in **Settings →
The advisor**. Once ready, chat, Diagnose, and Best recipe stream token-by-token.

## Manual on-device checklist

- [ ] App launches to the Home ledger; all five tabs (Home, Brews, Chat, Tools, Settings)
      switch instantly with no flicker.
- [ ] Add / edit / delete a coffee.
- [ ] Attach, reorder, and remove photos on a coffee; tap a photo to open it full-screen.
- [ ] Log / edit / delete a brew; ratio preview updates live; brews sort newest-first.
- [ ] Open a coffee's recipe book, add/edit a per-method recipe, and see it on return.
- [ ] Deleting a coffee removes its brews, photos, and recipes.
- [ ] "Autofill with AI" prefills the coffee/brew form from a plain-English description;
      "Enter manually" skips it.
- [ ] The Home advisor badge fills with download progress, then reads ready; it shows a
      cross seal while the assistant is off.
- [ ] Chat streams replies; Diagnose streams reasoning + suggestion; Best recipe streams
      a justified recipe.
- [ ] Stop halts a stream; leaving the screen mid-stream doesn't crash.
- [ ] Backgrounding then foregrounding the app keeps the advisor working (suspend/resume).
- [ ] Settings: toggling the assistant off unloads the model (the file stays cached);
      switching model downloads the new one immediately.
- [ ] Tools: Brew Ratio solves the third value from any two; Brew Timer walks a pour
      schedule; tool inputs survive an app restart.
- [ ] Export ledger writes `brewlog-ledger-YYYY-MM-DD.json` into the folder you picked
      once (remembered afterwards).
- [ ] Import ledger validates the file, warns before replacing a non-empty ledger, and
      every tab shows the imported data without a reload.

## Troubleshooting

| Symptom | Fix |
|---|---|
| Gradle "invalid source release" / JDK error | Wrong Java — confirm `java -version` is **17**. |
| `adb devices` shows `unauthorized` | Unlock phone, accept the USB-debugging prompt. |
| `Could not find device with name: ip:port` | Don't pass `--device ip:port`; with one phone connected just run `npx expo run:android`. |
| `:react-native-bare-kit:link` exits **139** | bare-posix still in the addon manifest — run `npm run prebuild` (or `node scripts/fix-addons-manifest.js`). |
| Startup crash: `TurboModuleRegistry … 'PlatformConstants' could not be found` | bare-kit 0.15.0 regression; this repo pins **0.14.5** (see Notes). Re-run `npm install`. |
| App self-closes to home a few seconds after "loading 100%" | Out-of-memory: the model is too big for free RAM. Pick a smaller model in Settings; the picker's RAM floors live in `src/lib/aiModels.ts` — don't loosen them without headroom. |
| White screen / crash when reopening during dev | Metro isn't running, or you resumed a stale activity. Start Metro (`npx expo start`) and **fully close + reopen** the app (cold start). |
| App stuck "Downloading…" | Phone needs Wi-Fi for the one-time model fetch; watch the terminal logs. |
| SDK location not found | Ensure `ANDROID_HOME` is set; `android/local.properties` should contain `sdk.dir`. |

## Architecture

A pure, Jest-tested core with a thin UI layer on top:

- `src/lib` — pure helpers: ratio and tool math, brew formatting, the ledger file
  format/validation, the cross-tab `ledgerEvents` pub-sub.
- `src/db` — SQLite schema + data layer behind a minimal async `Db` interface (tested via
  an in-memory `better-sqlite3` adapter). `coffees` cascades to `brews`, `coffee_photos`,
  and per-method `recipes`; `importLedger.ts` replaces the ledger in one transaction.
- `src/media` — coffee photo files on device (`photoStore.ts`: write/read/delete),
  embedded as base64 in the ledger export and restored on import.
- `src/qvac` — all `@qvac/sdk` use: serialized model lifecycle (`service.ts`), React
  context + persisted AI settings (`QvacProvider.tsx`), pure prompt builders.
- `src/screens` — a native-stack root over `MainTabs`, a hand-rolled tab container that
  keeps all five tabs mounted (so tab switches never fire navigation focus — cross-tab
  refreshes go through `ledgerEvents`). Each tool under `src/screens/tools/` is its own
  module, assembled in `registry.ts`.
- `src/components/ui` + `src/design/tokens.ts` — hand-styled UI kit on shared design
  tokens (colors, spacing, type, motion).

Agent/contributor guide: `AGENTS.md`.

## Notes (QVAC workarounds & versions)

These are pinned/scripted because of upstream QVAC SDK issues found while bringing the app up on
a real device:

- **Default model: `QWEN3_1_7B_INST_Q4`** (~1.1 GB). The model shelf and its RAM floors
  live in `src/lib/aiModels.ts` (SDK asset mapping in `src/qvac/modelConfig.ts`): the 4B
  pins ~2.5 GB on the GPU and gets OOM-killed on an 8 GB phone, so it requires 12 GB and
  is never auto-picked.
- **`react-native-bare-kit` is pinned to `0.14.5`** via a `package.json` `overrides` block.
  0.15.0's android binary links the platform-private `libnativehelper.so`, which can't load in
  an app and crashes startup with the `PlatformConstants` error above.
- **`scripts/fix-bare-posix.js`** (postinstall) creates a placeholder so `expo prebuild`'s
  verifier passes, and restores QVAC's manifest-aware `link.mjs` after each `npm install`.
- **`scripts/fix-addons-manifest.js`** (run by `npm run prebuild`) strips `bare-posix` from the
  generated addon manifest so the native link step doesn't segfault.

`android/`, `ios/`, `qvac/`, and `node_modules/` are gitignored and regenerated by
`npm install` + `npm run prebuild`.
