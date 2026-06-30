/**
 * fix-addons-manifest.js — run AFTER `npx expo prebuild`.
 *
 * `expo prebuild` regenerates `qvac/addons.manifest.json` from the bundle's dependency
 * graph, which includes `bare-posix`. bare-posix has NO android native binary (it routes
 * to `unsupported.js` on Android — see scripts/fix-bare-posix.js), so the Gradle
 * `:react-native-bare-kit:link` step feeds bare-link a zero-byte placeholder and segfaults
 * (`Process 'command 'node'' finished with non-zero exit value 139`).
 *
 * This strips `bare-posix` from the generated manifest so the link step succeeds. Safe:
 * Android never loads the bare-posix binary at runtime. Idempotent — a no-op if already
 * removed or if the manifest doesn't exist yet.
 *
 * Remove once @qvac/sdk stops listing android-unsupported addons in the manifest.
 */

'use strict';

const fs = require('fs');
const path = require('path');

try {
  const manifestPath = path.join(__dirname, '..', 'qvac', 'addons.manifest.json');
  if (!fs.existsSync(manifestPath)) {
    console.log('[fix-addons-manifest] No qvac/addons.manifest.json yet — run `expo prebuild` first.');
    process.exit(0);
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  if (!Array.isArray(manifest.addons) || !manifest.addons.includes('bare-posix')) {
    console.log('[fix-addons-manifest] bare-posix not in manifest — nothing to do.');
    process.exit(0);
  }

  manifest.addons = manifest.addons.filter((a) => a !== 'bare-posix');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  console.log('[fix-addons-manifest] Removed bare-posix from qvac/addons.manifest.json.');
} catch (err) {
  console.warn('[fix-addons-manifest] Warning:', err.message);
  process.exit(0);
}
