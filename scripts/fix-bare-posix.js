/**
 * fix-bare-posix.js — postinstall workarounds for two QVAC/bare-kit packaging issues.
 *
 * Runs as `postinstall` so both fixes survive every `npm install` (npm reinstalls clobber
 * node_modules, undoing patches that `expo prebuild` would otherwise have applied).
 *
 * FIX 1 — bare-posix missing android-arm64 prebuild:
 *   @qvac/sdk 0.13.x runs `expo prebuild` with a bundle verifier that requires every package
 *   marked `addon: true` to have a prebuild for every target host, including android-arm64.
 *   bare-posix@1.0.1 ships NO android-arm64 prebuild because it correctly declares
 *   `"android": "./unsupported.js"` in its package.json exports — the native binary is never
 *   loaded at runtime on Android. However, the verifier does not consult export conditions and
 *   fails with "Missing prebuild: bare-posix@1.0.1 for android-arm64".
 *   Fix: create a zero-byte placeholder at the expected path so the verifier is satisfied.
 *   The placeholder is never loaded on device; Android always resolves to unsupported.js.
 *
 * FIX 2 — restore QVAC's manifest-aware android/link.mjs:
 *   During `expo prebuild`, @qvac/sdk copies a patched link.mjs over
 *   react-native-bare-kit/android/link.mjs so the Gradle `link` task only links the addons in
 *   qvac/addons.manifest.json (which we trim to exclude bare-posix — its zero-byte placeholder
 *   above would otherwise segfault bare-link, exit 139). A plain `npm install` reinstalls
 *   react-native-bare-kit and reverts link.mjs to the stock "link ALL addons" version, bringing
 *   the segfault back. Re-copy the patch from the SDK so the build stays green without re-running
 *   prebuild.
 *
 *   Remove both once @qvac/sdk fixes its verifier and react-native-bare-kit drops the
 *   libnativehelper.so dependency (the reason we pin react-native-bare-kit to 0.14.5).
 */

'use strict';

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

// FIX 1 — bare-posix android-arm64 placeholder.
try {
  const pkgDir = path.join(root, 'node_modules', 'bare-posix');
  if (fs.existsSync(pkgDir)) {
    const prebuildDir = path.join(pkgDir, 'prebuilds', 'android-arm64');
    const placeholder = path.join(prebuildDir, 'bare-posix.bare');
    if (!fs.existsSync(placeholder)) {
      fs.mkdirSync(prebuildDir, { recursive: true });
      fs.writeFileSync(placeholder, '');
      console.log('[postinstall] Created bare-posix android-arm64 placeholder (QVAC SDK prebuild workaround).');
    }
  }
} catch (err) {
  console.warn('[postinstall] Warning: bare-posix placeholder step failed:', err.message);
}

// FIX 2 — restore manifest-aware android/link.mjs from the SDK patch.
try {
  const src = path.join(root, 'node_modules', '@qvac', 'sdk', 'expo', 'plugins', 'patches', 'android-link.mjs');
  const dst = path.join(root, 'node_modules', 'react-native-bare-kit', 'android', 'link.mjs');
  if (fs.existsSync(src) && fs.existsSync(path.dirname(dst))) {
    const current = fs.existsSync(dst) ? fs.readFileSync(dst, 'utf8') : '';
    if (!current.includes('addons.manifest.json')) {
      fs.copyFileSync(src, dst);
      console.log('[postinstall] Restored QVAC manifest-aware react-native-bare-kit/android/link.mjs.');
    }
  }
} catch (err) {
  console.warn('[postinstall] Warning: link.mjs restore step failed:', err.message);
}
