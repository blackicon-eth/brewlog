# Brewlog — roadmap

Gaps found by a full app exploration on 2026-07-12 (excluding the three
coming-soon tools). Meant to be tackled **one at a time, top to bottom** —
each item is small enough to design, build, and verify on-device as its own
unit. Check items off as they ship.

## Loose ends in existing features

- [x] **1. Editable brew date/time** — shipped 2026-07-13. A "Brewed on"
  section (between Taste and Notes) opens a picker sheet: day chips (Today +
  5 back, an edited brew's older day prepended) and hh:mm fields, with a
  future guard. Untouched new logs keep the stamp-at-save behavior. Pure
  helpers in `src/lib/brewedAt.ts`; sheet in `src/components/BrewedAtModal.tsx`.

- [x] **2. TDS & extraction yield — dropped 2026-07-13.** These need a
  refractometer most brewers don't own, so the dead `brews.tds`/`brews.ey`
  columns and all their plumbing (schema, db queries, `Brew`/`BrewRow`
  types, ledger file, form) were removed rather than built out. The
  standalone Extraction Yield and Coffee Compass *tools* are untouched
  (separate calculators, still coming-soon). Note: existing on-device DBs
  keep two orphan NULL columns — harmless, never read or written; new
  installs don't have them.

- [x] **3. "Log brew" from the Brews tab** — shipped 2026-07-13. A blue
  circular "+" FAB on BrewsScreen opens a coffee picker
  (`CoffeePickerModal`, mirrors the Best-recipe picker), then the brew form
  for the chosen coffee. One coffee → skips the picker; hidden on an empty
  ledger. Added a `round` variant to the `Fab` component.

- [x] **4. Delete + archive for finished bags** — shipped 2026-07-13.
  Delete moved onto the coffee/brew **edit** pages as a labeled trash pill
  (top-right, themed confirm modal), replacing the old bottom pill — the
  user preferred it there over the detail pages. Archive is a full `archived`
  flag on coffees (schema migration, ledger export/import): an Archive /
  Unarchive button (grey) beside Delete on the coffee edit page (archive
  confirms, unarchive is instant); a Home **Active / Archived** filter via
  the new reusable animated `SegmentedTabs`; an "Archived" header badge;
  archived coffees leave the active shelf, the Brews-tab picker, and lose
  their "Log brew" FAB — while their past brews stay in the ledger.

## Finding things as the ledger grows

- [x] **5. Search & filters — shipped 2026-07-14 (rescoped to the brew filter).**
  A method-filter chip strip on the Brews tab: a horizontal, scrollable
  `MethodFilterBar` (All / Filter / Press / Moka / Espresso) in the masthead
  that narrows the paginated ledger via SQL. A pure `methodFilterSql` builds
  the `WHERE` fragment (the "filter" view also matches legacy `v60`/unknown
  rows, mirroring `methodSpec`); `listAllBrews`/`countAllBrews` splice it in
  so count and infinite-scroll paging stay correct; changing the filter
  refetches page 1 with a request-generation guard so a mid-fling page load
  can't append the old filter's rows. Filtered-empty state per method. The
  originally-listed **Coffees search box was dropped**; the N+1 stats query
  (#6) is untouched and stays its own item.

- [ ] **6. Fix the Coffees N+1 stats query**
  Each coffee card fetches *all* its brews just to compute count and
  average rating (`CoffeesScreen.tsx`). Replace with one aggregate SQL
  query (`GROUP BY coffee_id`). Fold into whichever of #4/#5 touches that
  screen first.

## Insights

- [ ] **7. Stats / insights**
  Nothing aggregates the ledger. Start small: a per-coffee stats block on
  CoffeeDetail (avg ratio, avg temp, rating trend across brews). Later: a
  cross-ledger view (per-method comparison, rating over time). The taste
  pentagon + assistant already point this direction.

## The assistant

- [ ] **8. Chat memory & ledger context**
  Chat is session-only (lost on app close) and free-form chat can't see
  the ledger — only Diagnose/Best recipe inject data, so "what did I think
  of the Gardelli?" fails. Two sub-steps, separable: (a) persist chat
  sessions; (b) give chat a compact ledger summary as context (mind the
  4096-token ctx budget — see `src/qvac/advisor.ts` for the pattern).

## Small / cosmetic (batch when convenient)

- [ ] Filter-type chips only offer White / Unbleached — extend or leave.
- [ ] Coffee photos (bag shot on CoffeeDetail).
- [ ] Dark mode; unit settings (°F, oz).
- [ ] "Clear ledger" action in Settings (today only import-replace).
- [ ] Remove dead `ComingSoon` component (`src/components/ui/ComingSoon.tsx` — exported, never used).
- [ ] Bundle id is `com.anonymous.brewlog` — rename before any store release (forces reinstall).
