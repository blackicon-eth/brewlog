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

- [x] **6. Fix the Coffees N+1 stats query — shipped 2026-07-14.**
  `CoffeesScreen` used to fetch every coffee, then loop one
  `listBrewsForCoffee` per coffee (each a `SELECT *` materializing full
  brew rows) just to read a count and average rating. Replaced with a
  single aggregate query `listCoffeesWithStats` in `src/db/coffees.ts`:
  `LEFT JOIN brews … GROUP BY c.id` with `COUNT(b.id)` (brew-less coffees →
  0, not the null-joined 1) and `AVG(rating)` (ignores NULLs, null when
  none — matching `avgRating`). One round trip instead of N+1, no full brew
  rows materialized. `listCoffees`/`listBrewsForCoffee`/`avgRating` stay
  (CoffeeDetail still needs them); the screen swap is a superset row type,
  so the archived filter, fade/rise, and card rendering are untouched.

## Insights

- [ ] **7. Stats / insights**
  Nothing aggregates the ledger. Start small: a per-coffee stats block on
  CoffeeDetail (avg ratio, avg temp, rating trend across brews). Later: a
  cross-ledger view (per-method comparison, rating over time). The taste
  pentagon + assistant already point this direction.

## The assistant

- [ ] **8. Chat memory & ledger context** — sub-step (b) shipped 2026-07-15.
  Two sub-steps, separable:
  - [x] **(b) Ledger context — shipped 2026-07-15.** Free-form chat now sees
    the ledger: each send prepends a compact, always-fresh per-coffee roll-up
    to the chat system prompt, so "what did I think of the Gardelli?" works.
    `listCoffeesWithStats` gained `lastBrewedAt` (MAX(brewed_at)); pure
    `buildLedgerContext`/`buildChatSystemPrompt` (in `advisor.ts`, layer-pure)
    render one line per coffee — `roaster — name (origin, process, roast) ·
    N brews · avg X.X · last Nd ago` — sorted most-recently-brewed first,
    archived tagged, capped at `LEDGER_CONTEXT_COFFEES_CAP` (24) with a
    "(+N more)" note to stay inside the 4096-token ctx budget.
    `ChatScreen.send()` fetches it fresh per message (always-mounted tabs fire
    no focus event; logging a brew emits no `ledgerReplaced`) and falls back to
    the bare prompt if the query fails. New `formatDaysAgo` helper.
  - [ ] **(a) Persist chat sessions** — still open. Chat is session-only, lost
    on app close. Save chat history (SQLite, like the rest of the ledger) so it
    survives restarts.

## Small / cosmetic (batch when convenient)

- [ ] Filter-type chips only offer White / Unbleached — extend or leave.
- [ ] Coffee photos (bag shot on CoffeeDetail).
- [ ] Dark mode; unit settings (°F, oz).
- [ ] "Clear ledger" action in Settings (today only import-replace).
- [ ] Remove dead `ComingSoon` component (`src/components/ui/ComingSoon.tsx` — exported, never used).
- [ ] Bundle id is `com.anonymous.brewlog` — rename before any store release (forces reinstall).
