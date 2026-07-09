# Ledger Export / Import — Design

**Date:** 2026-07-09
**Status:** Approved

## Goal

Wire the Settings "Your data" card to real files: export the whole ledger (coffees +
brews) to a standardized JSON file the user places anywhere on the phone, and import
such a file back — with strict validation and an explicit destructive-overwrite
confirmation. Also tighten the export icon (arrow closer to its tray).

## Scope

- **In:** coffees + brews — the irreplaceable user data.
- **Out:** AI settings and Tools-tab inputs (device-specific, trivially re-set), and
  the export/import of the kv-store in general.

## Constraints

- **Zero new dependencies, zero native risk.** Everything uses the already-installed
  `expo-file-system` ~19.0.23 (Expo SDK 54): `Directory.pickDirectoryAsync()` and
  `File.pickFileAsync()` are SAF-backed pickers — the picker itself is the Android
  permission grant, so no runtime permission dialog is requested.
- Per AGENTS.md, verify API signatures against https://docs.expo.dev/versions/v54.0.0/
  (expo-file-system page) before writing the Expo-facing code.
- Pure logic lives in `src/lib` with no Expo imports so Jest covers it (same pattern
  as `aiModels.ts`).
- Copy voice: plain, calm ledger language; the AI is never involved here.

## File format

```json
{
  "format": "brewlog-ledger",
  "version": 1,
  "exportedAt": "2026-07-09T14:03:00.000Z",
  "coffees": [ { "id": "…", "roaster": "…", "name": "…", "origin": null, "process": null, "roastLevel": null, "roastDate": null, "notes": null, "createdAt": 1720000000000 } ],
  "brews":   [ { "id": "…", "coffeeId": "…", "brewedAt": 1720000000000, "doseG": 15, "waterG": 250, "ratio": 16.7, "grind": null, "waterTempC": null, "dripper": null, "pours": null, "pourIntervalS": null, "totalTimeS": null, "filterType": null, "tds": null, "ey": null, "acidity": null, "sweetness": null, "bitterness": null, "body": null, "clarity": null, "rating": null, "notes": null, "createdAt": 1720000000000 } ]
}
```

- Records use the existing in-memory `Coffee` / `Brew` shapes from `src/db/types.ts`
  (camelCase), so serialization is `JSON.stringify` of what `listCoffees` /
  `listAllBrews` already return (minus the `BrewWithCoffee` join extras).
- `format` is a fixed marker that rejects arbitrary JSON instantly.
- `version` gates evolution: import rejects files with `version` **greater** than the
  app's current constant (1). Older versions are handled by future migration code if
  the format ever changes; today only version 1 exists.
- Filename: `brewlog-ledger-YYYY-MM-DD.json` (local date).

## Architecture

### `src/lib/ledgerFile.ts` (new, pure — no Expo imports)

- `LEDGER_FORMAT = "brewlog-ledger"`, `LEDGER_VERSION = 1`.
- `LedgerPayload = { coffees: Coffee[]; brews: Brew[] }`.
- `serializeLedger(coffees, brews, exportedAt: string): string` — builds the envelope
  and stringifies (pretty-printed, 2 spaces, human-readable).
- `parseLedgerFile(text: string): { ok: true; payload: LedgerPayload } | { ok: false; reason: string }`
  — strict, all-or-nothing validation. One bad record rejects the whole file (a
  replace-import must be atomic). Human-readable reasons, checked in this order:
  1. Not JSON / not an object.
  2. Wrong or missing `format` marker → "This doesn't look like a Brewlog ledger file."
  3. `version` missing/non-number or `> LEDGER_VERSION` → "made by a newer version of Brewlog."
  4. `coffees` / `brews` not arrays.
  5. Per-coffee: `id/roaster/name` non-empty strings; `createdAt` finite number;
     nullable fields either null/undefined (normalized to null) or the right primitive type.
  6. Per-brew: `id/coffeeId` non-empty strings; `brewedAt/doseG/waterG/ratio/createdAt`
     finite numbers; nullable numerics finite when present; nullable strings typed when present.
  7. Ids unique within each array.
  8. Every `brew.coffeeId` references a coffee in the same file (no orphans).
  Reasons include which record failed (e.g. "Coffee 3 is missing a name.").
- `ledgerFilename(date: Date): string` — `brewlog-ledger-YYYY-MM-DD.json`.

### `src/db/importLedger.ts` (new)

- `replaceLedger(db: Db, payload: LedgerPayload): Promise<void>` — one transaction:
  `DELETE FROM brews; DELETE FROM coffees;` then insert every coffee, then every brew
  (reusing the existing `createCoffee` / `createBrew` column mapping). Any failure
  rolls back completely — the current ledger survives a poisoned file.

### `src/screens/SettingsScreen.tsx` (modify)

- **Export ledger:** `Directory.pickDirectoryAsync()` → load ledger via `getDb()` +
  `listCoffees` + all brews → `serializeLedger` → create + write the file in the
  picked directory → success modal naming the file and the counts ("Saved
  brewlog-ledger-2026-07-09.json — X coffees, Y brews."). Picker cancel (throws /
  returns nothing) is silent. Write failures show a plain error modal.
  - **Amendment (on-device feedback):** Android refuses to grant apps the Downloads
    *root* through the folder picker (system privacy restriction), forcing a one-time
    subfolder choice. So the folder is picked **once** and remembered
    (`settings:data:exportDir` in kv-store; the SAF grant is persistable — the native
    picker takes `takePersistableUriPermission` read+write). Later exports write
    straight to the remembered folder with no picker. The first pick opens
    pre-navigated to Downloads via `EXTRA_INITIAL_URI`. If the folder disappears or
    the grant is revoked (`exists` false, reconstruction throws, or the write fails),
    the remembered URI is forgotten and the picker returns on the next export.
- **Import ledger:** `File.pickFileAsync()` (MIME `application/json`) → read text →
  `parseLedgerFile`. Invalid → error modal with the specific reason, data untouched.
  Valid → destructive confirm via the existing AppModal `confirm` with the dangerSolid
  action: title "Replace your ledger?", message "This file holds X coffees and Y
  brews. Importing replaces everything currently in Brewlog — your current Z coffees
  and W brews will be lost." Confirm → `replaceLedger` → success modal. Cancel → nothing.
  Home/Brews lists pick up the new data through the existing re-query-on-focus behavior.
- While an export/import is in flight, the two DataAction rows ignore further taps
  (simple `busy` state) so a double-tap can't run two pickers.
- **Icon tweak:** `trayArrowUp` `marginBottom: 5` → `2` so the export arrow sits
  closer to its tray. (`trayArrowDown` stays as is unless it visibly drifts.)

## Error handling summary

| Failure | Behavior |
| --- | --- |
| Picker cancelled | Silent no-op |
| Export write fails | Error modal, generic "couldn't save" + OS message |
| File unreadable / not JSON / wrong marker / bad records | Error modal with `parseLedgerFile` reason; DB untouched |
| Insert fails mid-import | Transaction rollback; error modal; DB untouched |

## Testing

- `src/lib/__tests__/ledgerFile.test.ts` (Jest, pure): round-trip serialize→parse;
  every rejection branch (not JSON, wrong marker, future version, non-array, missing
  required field, wrong type, non-finite number, duplicate ids, orphan brew);
  normalization of missing optional fields to null; filename formatting.
- `src/db/__tests__/importLedger.test.ts` against the existing better-sqlite3
  `testdb.ts` harness: replace clears prior rows and inserts payload; rollback leaves
  prior data intact when an insert is poisoned (e.g. duplicate id inside payload
  bypassing validation).
- Manual on the S23: export to Downloads, re-import, import a hand-broken file.
