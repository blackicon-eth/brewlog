# Brewlog

On-device pour-over coffee journal with an offline AI brewing advisor (QVAC + Qwen3 1.7B).
Log coffees and brews; the advisor reasons over your own data to suggest next-brew
adjustments and the best recipe per bean. Everything runs locally — no cloud, no account.

## Requirements

- A **physical** Android device with **8 GB+ RAM** (developed/tested on a Galaxy S23). QVAC
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

First time the advisor is used, it downloads the model (**~1.1 GB** for Qwen3 1.7B) — keep the
phone on Wi-Fi and watch the terminal. The model is cached on-device after that.

> The debug build loads its JavaScript from the **Metro** dev server on this machine (over
> `adb reverse tcp:8081`). Keep Metro running while using the app. To launch **without** the
> laptop, build a release APK: `npx expo run:android --variant release` (bundles the JS).

## Tests (pure logic, no device)

```bash
npm test
```

Covers ratio math, brew formatting, the SQLite data layer (in-memory `better-sqlite3`), and
the prompt builders. 34 tests; `npx tsc --noEmit` is clean.

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

The advisor pill shows **Downloading… %** while it fetches the model (~1.1 GB, one time). Then
it goes **Loading → Advisor ready**, and Diagnose / Best recipe stream token-by-token.

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

## Troubleshooting

| Symptom | Fix |
|---|---|
| Gradle "invalid source release" / JDK error | Wrong Java — confirm `java -version` is **17**. |
| `adb devices` shows `unauthorized` | Unlock phone, accept the USB-debugging prompt. |
| `Could not find device with name: ip:port` | Don't pass `--device ip:port`; with one phone connected just run `npx expo run:android`. |
| `:react-native-bare-kit:link` exits **139** | bare-posix still in the addon manifest — run `npm run prebuild` (or `node scripts/fix-addons-manifest.js`). |
| Startup crash: `TurboModuleRegistry … 'PlatformConstants' could not be found` | bare-kit 0.15.0 regression; this repo pins **0.14.5** (see Notes). Re-run `npm install`. |
| App self-closes to home a few seconds after "loading 100%" | Out-of-memory: the model is too big for free RAM. We ship 1.7B; don't switch to 4B without more headroom (`src/qvac/modelConfig.ts`). |
| White screen / crash when reopening during dev | Metro isn't running, or you resumed a stale activity. Start Metro (`npx expo start`) and **fully close + reopen** the app (cold start). |
| App stuck "Downloading…" | Phone needs Wi-Fi for the one-time model fetch; watch the terminal logs. |
| SDK location not found | Ensure `ANDROID_HOME` is set; `android/local.properties` should contain `sdk.dir`. |

## Architecture

- `src/db` — SQLite schema + data layer (testable via a `better-sqlite3` adapter).
- `src/lib` — pure helpers (ratio, formatting, ids).
- `src/qvac` — all `@qvac/sdk` use: model lifecycle, streaming, prompt builders, React context.
- `src/screens` — five screens wired through `@react-navigation/native-stack`.

Design + plan: `docs/superpowers/specs/` and `docs/superpowers/plans/`.

## Notes (QVAC workarounds & versions)

These are pinned/scripted because of upstream QVAC SDK issues found while bringing the app up on
a real device:

- **Model: `QWEN3_1_7B_INST_Q4`** (~1.1 GB), set in `src/qvac/modelConfig.ts`. The larger
  `QWEN3_4B_INST_Q4_K_M` pins ~2.5 GB on the GPU and gets OOM-killed on an 8 GB phone.
- **`react-native-bare-kit` is pinned to `0.14.5`** via a `package.json` `overrides` block.
  0.15.0's android binary links the platform-private `libnativehelper.so`, which can't load in
  an app and crashes startup with the `PlatformConstants` error above.
- **`scripts/fix-bare-posix.js`** (postinstall) creates a placeholder so `expo prebuild`'s
  verifier passes, and restores QVAC's manifest-aware `link.mjs` after each `npm install`.
- **`scripts/fix-addons-manifest.js`** (run by `npm run prebuild`) strips `bare-posix` from the
  generated addon manifest so the native link step doesn't segfault.

`android/`, `ios/`, `qvac/`, and `node_modules/` are gitignored and regenerated by
`npm install` + `npm run prebuild`.
