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

- [ ] **2. Wire up TDS & extraction yield (or drop them)**
  `brews.tds` and `brews.ey` exist in the schema but the form saves both as
  `null` (`BrewFormScreen.tsx`) and BrewDetail never shows them. Natural
  pairing: un-gate the Extraction Yield tool and let a brew record TDS with
  EY computed from dose/water. Decide: implement the pair, or remove the
  dead columns.

- [ ] **3. "Log brew" from the Brews tab**
  The global ledger has no FAB — logging requires Home → coffee →
  Log brew. Add a FAB on BrewsScreen that first asks which coffee
  (small picker), then opens BrewForm.

- [ ] **4. Delete on detail pages + archive for finished bags**
  Deleting a coffee/brew is only possible through the Edit form. Add a
  quiet delete action to CoffeeDetail and BrewDetail (confirm dialogs, same
  copy voice). Consider an **archive** flag for coffees so finished bags
  leave the Home list without losing their brew history.

## Finding things as the ledger grows

- [ ] **5. Search & filters**
  No search anywhere; the Brews ledger can't be filtered by method or
  coffee (`BrewsScreen.tsx`, fixed `brewed_at DESC`). With four methods
  supported, "only my espresso shots" is an obvious ask. Scope: search box
  on Coffees, method (and maybe coffee) filter chips on Brews.

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
