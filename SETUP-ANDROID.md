# Brewlog — Android device setup & smoke test (Fedora → Galaxy S23)

This app **cannot run in Expo Go or an emulator** — it has native QVAC code and QVAC
requires a real device. You build a **local development build** with Gradle and install it
on a physical Galaxy S23 over USB.

The native `android/` project already exists (from `npx expo prebuild`), and a `postinstall`
script auto-applies the `bare-posix` workaround after every `npm install`. What's missing is
the Android toolchain.

**Targets to install:** JDK **17** and the Android SDK command-line tools. The first Gradle
build then **auto-downloads** everything else it needs at the exact pinned versions —
**NDK `27.0.12077973`**, **CMake**, build-tools, and the SDK platform — so you don't have to
install those by hand (Phase A3 is optional / a head start).

Tip: in the Claude chat you can run any verify command by prefixing it with `!`
(e.g. `! java -version`) so the output comes back to Claude for debugging.

---

## Phase A — Install the toolchain (one-time)

### A1. JDK 17 (React Native 0.81 needs 17 — newer JDKs break the Gradle build)
**Fedora 44 no longer ships JDK 17** (`dnf` only offers 25/26). Install Eclipse Temurin 17
as a tarball in your home dir — no sudo, no system pollution:
```bash
curl -fsSL -o /tmp/temurin17.tar.gz \
  "https://api.adoptium.net/v3/binary/latest/17/ga/linux/x64/jdk/hotspot/normal/eclipse"
mkdir -p ~/jdks && tar -xzf /tmp/temurin17.tar.gz -C ~/jdks
~/jdks/jdk-17.0.19+10/bin/java -version    # expect 17.x  (dir name may differ by patch)
```
`JAVA_HOME` is set in Phase B below.

### A2. Android SDK via command-line tools (no Android Studio GUI needed)
Headless — installs the SDK to `~/Android/Sdk`. Get the current cmdline-tools URL from
https://developer.android.com/studio (look for `commandlinetools-linux-<build>_latest.zip`):
```bash
curl -fsSL -o /tmp/cmdtools.zip \
  "https://dl.google.com/android/repository/commandlinetools-linux-14742923_latest.zip"
mkdir -p ~/Android/Sdk/cmdline-tools
rm -rf /tmp/cmdtools-extract && mkdir /tmp/cmdtools-extract
unzip -q /tmp/cmdtools.zip -d /tmp/cmdtools-extract
mv /tmp/cmdtools-extract/cmdline-tools ~/Android/Sdk/cmdline-tools/latest
```

### A3. (Optional) Pre-install SDK packages
The Gradle build downloads the NDK/CMake/build-tools/platform it needs on its own, so this is
only to front-load the downloads. After Phase B exports are set (`ANDROID_HOME`, `sdkmanager`
on PATH):
```bash
yes | sdkmanager --licenses
sdkmanager "platform-tools" "platforms;android-36" "build-tools;36.0.0" \
           "ndk;27.0.12077973" "cmake;3.22.1"
```
The project pins **NDK `27.0.12077973`** (set in `android/build.gradle`); if you let Gradle
auto-install, it picks the right version regardless.

(GUI alternative: install Android Studio, run the wizard as **Standard** — it provisions the SDK;
the build still pulls the pinned NDK/CMake itself.)

---

## Phase B — Environment variables (one-time)
Add to `~/.bashrc` (adjust the JDK dir name if your patch version differs):
```bash
# --- Brewlog Android toolchain ---
export JAVA_HOME="$HOME/jdks/jdk-17.0.19+10"
export PATH="$JAVA_HOME/bin:$PATH"
export ANDROID_HOME="$HOME/Android/Sdk"
export PATH="$PATH:$ANDROID_HOME/platform-tools:$ANDROID_HOME/cmdline-tools/latest/bin"
# --- end Brewlog ---
```
Then:
```bash
source ~/.bashrc
java -version          # expect 17.x
yes | sdkmanager --licenses   # accept SDK licenses (after Android Studio installs the SDK)
adb --version          # should print a version
```

---

## Phase C — Prepare the Galaxy S23
1. **Settings → About phone → Software information →** tap **"Build number" 7 times** (enables Developer mode).
2. **Settings → Developer options →** turn on **USB debugging**.
3. Plug the phone into the PC via USB; set the phone's USB mode to **File transfer (MTP)**.
4. Accept the **"Allow USB debugging?"** prompt on the phone (tick "Always allow" → Allow).
5. Verify:
```bash
adb devices            # your phone's serial should show status "device" (not "unauthorized")
```

---

## Phase D — Build & run
```bash
cd /home/blackicon/Desktop/Projects/Current/qvac-expo-chat
npx expo run:android --device
```
- First build takes several minutes (Gradle compiles the native QVAC code), then installs the
  dev build on the phone and starts the Metro bundler.
- If prompted, pick the S23.

---

## Phase E — First launch + smoke test
- On the **Coffees** screen the advisor status pill shows **Downloading…%** — it's pulling the
  **Qwen3 4B model (~2.5 GB)**. **Keep the phone on Wi-Fi**; this happens only once.
- Then walk the checklist:
  - [ ] App launches to the Coffees list.
  - [ ] Add a coffee; edit it; (later) delete it.
  - [ ] Log a brew — the ratio preview updates live; brews sort newest-first.
  - [ ] Status pill goes Downloading → Loading → **Advisor ready**.
  - [ ] Tap **Diagnose** on a brew → reasoning (collapsible) + advice **stream in token-by-token**.
  - [ ] Tap **Best recipe** on a coffee with ≥1 brew → streamed recipe with justification.
  - [ ] **Stop** halts a stream; leaving the screen mid-stream doesn't crash.
  - [ ] Background then foreground the app → advisor still works (suspend/resume).
  - [ ] Deleting a coffee removes its brews.

---

## Likely snags
| Symptom | Fix |
|---|---|
| `adb devices` shows `unauthorized` | Unlock phone, accept the USB-debugging prompt. |
| Gradle "invalid source release" / JDK error | Wrong Java picked up — confirm `java -version` is **17**. |
| "Failed to install SDK components" / NDK not found | Let Gradle auto-install, or `sdkmanager "ndk;27.0.12077973"` (Phase A3). |
| Build fails right after a fresh `npm install` | Re-run the build; `postinstall` re-applies the `bare-posix` fix automatically. |
| SDK location not found | Ensure `ANDROID_HOME` is set (Phase B); `android/local.properties` should contain `sdk.dir`. |
| App opens but advisor stuck "Downloading…" | Phone needs Wi-Fi for the one-time model fetch (~1.1 GB for 1.7B); watch the terminal logs. |
| App self-closes to home a few seconds after "loading 100%" | Out-of-memory: the model is too big for free RAM. The Galaxy S23 OOM-killed Qwen3 **4B** on GPU; we ship **1.7B**. Don't switch back to 4B without more headroom (see modelConfig.ts). |
| White screen / crash on reopen during dev | A dev build needs Metro running. Start it (`npx expo start`), then **fully close and reopen** the app (cold start, not resume). For laptop-free launch, build a release APK. |
| `react-native-bare-kit:link` exits 139 | Stale stock `link.mjs`; `postinstall` restores QVAC's manifest-aware version. Re-run `npm install` then rebuild. |

---

## Project facts (for reference)
- Model: `QWEN3_1_7B_INST_Q4` (~1.1 GB; GPU, ctx 4096, thinking mode), set in `src/qvac/modelConfig.ts`. The bigger `QWEN3_4B_INST_Q4_K_M` OOM-kills on an 8 GB S23.
- `react-native-bare-kit` is pinned to **0.14.5** (via `package.json` `overrides`); 0.15.0 links the platform-private `libnativehelper.so` and won't load in an app.
- minSdk 29; project pins **NDK `27.0.12077973`** (Gradle auto-installs); Expo SDK 54 / RN 0.81 / React 19.1.
- Pure-logic tests: `npm test` (34 Jest tests, no device needed).
- Design & plan: `docs/superpowers/specs/` and `docs/superpowers/plans/`.
- Branch `brewlog`; on-device smoke test **passed** on a Galaxy S23 (2026-06-30).
