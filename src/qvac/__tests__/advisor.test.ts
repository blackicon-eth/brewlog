import {
  buildDiagnosePrompt,
  buildBestRecipePrompt,
  coffeeHeader,
  buildChatHistory,
  buildLedgerContext,
  buildChatSystemPrompt,
  type LedgerCoffee,
} from "../advisor";
import {
  RECENT_BREWS_CAP,
  BEST_RECIPE_BREWS_CAP,
  SYSTEM_PROMPT,
  CHAT_SYSTEM_PROMPT,
  CHAT_BREVITY_HINT,
  LEDGER_CONTEXT_COFFEES_CAP,
} from "../promptConfig";
import type { Brew, Coffee } from "../../models/types";

const coffee: Coffee = {
  id: "c1", roaster: "Sey", name: "Kenya", origin: "Kenya", process: "washed",
  roastLevel: "light", roastDate: "2026-06-10", notes: null, createdAt: 1,
};
const brew = (over: Partial<Brew> = {}): Brew => ({
  id: "b1", coffeeId: "c1", brewedAt: 10, method: "filter" as const, doseG: 15, waterG: 250, ratio: 16.6667,
  grind: "medium-fine", waterTempC: 94, dripper: "V60", pours: 3, pourIntervalS: 30,
  totalTimeS: 165, filterType: null,
  acidity: 4, sweetness: 3, bitterness: 2, body: 3, clarity: 4, rating: 4, notes: "sharp",
  createdAt: 10, ...over,
});
const NOW = Date.parse("2026-06-20T00:00:00Z");

describe("coffeeHeader", () => {
  it("includes roaster, name, origin, process, roast, days off roast", () => {
    const h = coffeeHeader(coffee, NOW);
    expect(h).toContain("Sey");
    expect(h).toContain("Kenya");
    expect(h).toContain("washed");
    expect(h).toContain("10 days off roast");
  });
});

describe("buildDiagnosePrompt", () => {
  it("starts with a system message then a user message", () => {
    const msgs = buildDiagnosePrompt(coffee, brew(), [brew()], NOW);
    expect(msgs).toHaveLength(2);
    expect(msgs[0].role).toBe("system");
    expect(msgs[1].role).toBe("user");
  });
  it("asks about the NEXT brew and includes the coffee header", () => {
    const msgs = buildDiagnosePrompt(coffee, brew(), [brew()], NOW);
    const user = msgs[1].content;
    expect(user).toContain("adjust my next");
    expect(user).toContain("Sey");
  });
  it(`caps recent brews at ${RECENT_BREWS_CAP}`, () => {
    const many = Array.from({ length: 20 }, (_, i) => brew({ id: `b${i}`, brewedAt: i }));
    const user = buildDiagnosePrompt(coffee, many[0], many, NOW)[1].content;
    const rows = user.split("\n").filter((l) => /^\d+\)/.test(l.trim()));
    expect(rows.length).toBe(RECENT_BREWS_CAP);
  });
  it("diagnose speaks the selected brew's method", () => {
    const msgs = buildDiagnosePrompt(coffee, { ...brew(), method: "moka" }, [], NOW);
    const user = msgs[1].content;
    expect(user).toContain("My recent moka pot brews of this coffee");
    expect(user).toContain("adjust my next moka pot brew");
    expect(user).toContain("(grind, dose, water preheating, heat level)");
  });
});

describe("buildBestRecipePrompt", () => {
  it("asks for the best recipe and includes all brews' ratios", () => {
    const msgs = buildBestRecipePrompt(coffee, [brew(), brew({ id: "b2", ratio: 15 })], "filter", NOW);
    expect(msgs).toHaveLength(2);
    const user = msgs[1].content;
    expect(user).toContain("best");
    expect(user).toContain("recipe");
    expect(user).toContain("1:16.7");
    expect(user).toContain("1:15.0");
  });
  it(`caps brews at BEST_RECIPE_BREWS_CAP (${BEST_RECIPE_BREWS_CAP})`, () => {
    const many = Array.from({ length: 30 }, (_, i) =>
      brew({ id: `b${i}`, ratio: 15 + i * 0.1 })
    );
    const user = buildBestRecipePrompt(coffee, many, "filter", NOW)[1].content;
    const rows = user.split("\n").filter((l) => /^\d+\)/.test(l.trim()));
    expect(rows.length).toBe(BEST_RECIPE_BREWS_CAP);
  });
  it("best recipe targets the chosen method", () => {
    const msgs = buildBestRecipePrompt(coffee, [{ ...brew(), method: "espresso" }], "espresso", NOW);
    const user = msgs[1].content;
    expect(user).toContain("My espresso brews of this coffee");
    expect(user).toContain("best espresso recipe");
    expect(user).toContain("grind, dose, yield, shot time, water temperature");
  });
  it("best recipe estimates when no brews of the method exist", () => {
    const msgs = buildBestRecipePrompt(coffee, [], "french_press", NOW);
    const user = msgs[1].content;
    expect(user).toContain("I haven't logged any French press brews of this coffee yet");
    expect(user).toContain("suggest a good starting French press recipe");
    expect(user).not.toContain("most recent first");
  });
});

describe("buildChatHistory", () => {
  it("prepends the chat system prompt and appends the brevity hint to the newest user turn", () => {
    const msgs = buildChatHistory([
      { role: "user", content: "why sour?" },
      { role: "assistant", content: "grind finer" },
    ]);
    expect(msgs).toEqual([
      { role: "system", content: CHAT_SYSTEM_PROMPT },
      { role: "user", content: "why sour?" + CHAT_BREVITY_HINT },
      { role: "assistant", content: "grind finer" },
    ]);
  });
  it("adds the brevity hint only to the last user message, leaving earlier ones untouched", () => {
    const msgs = buildChatHistory([
      { role: "user", content: "first" },
      { role: "assistant", content: "ok" },
      { role: "user", content: "second" },
    ]);
    expect(msgs[1]).toEqual({ role: "user", content: "first" });
    expect(msgs[3]).toEqual({ role: "user", content: "second" + CHAT_BREVITY_HINT });
  });
  it("returns just the system prompt for an empty transcript", () => {
    expect(buildChatHistory([])).toEqual([{ role: "system", content: CHAT_SYSTEM_PROMPT }]);
  });
  it("honours a custom system prompt", () => {
    const msgs = buildChatHistory([{ role: "user", content: "hi" }], "SYS");
    expect(msgs[0]).toEqual({ role: "system", content: "SYS" });
  });
});

describe("system prompts", () => {
  it("the system prompts cover all four methods", () => {
    for (const s of [SYSTEM_PROMPT, CHAT_SYSTEM_PROMPT]) {
      expect(s).toContain("pour-over");
      expect(s).toContain("French press");
      expect(s).toContain("moka");
      expect(s).toContain("espresso");
    }
  });
});

describe("buildLedgerContext", () => {
  const lc = (over: Partial<LedgerCoffee> = {}): LedgerCoffee => ({
    id: "c1", roaster: "Gardelli", name: "Kieni", origin: "Kenya", process: "washed",
    roastLevel: "light", roastDate: null, notes: null, archived: false, createdAt: 1,
    brewCount: 6, avg: 4.166, lastBrewedAt: Date.parse("2026-06-08T00:00:00Z"), ...over,
  });

  it("returns empty string for an empty ledger", () => {
    expect(buildLedgerContext([], NOW)).toBe("");
  });

  it("formats a full-detail line with rounded average and relative last-brewed", () => {
    const out = buildLedgerContext([lc()], NOW);
    expect(out).toContain("Gardelli — Kieni (Kenya, washed, light)");
    expect(out).toContain("6 brews");
    expect(out).toContain("avg 4.2");
    expect(out).toContain("last 12d ago");
  });

  it("includes only the present origin/process/roast fields", () => {
    const out = buildLedgerContext([lc({ origin: "Kenya", process: null, roastLevel: null })], NOW);
    expect(out).toContain("Kieni (Kenya) ·");
  });

  it("omits the parenthetical entirely when origin/process/roast are all null", () => {
    const out = buildLedgerContext([lc({ origin: null, process: null, roastLevel: null })], NOW);
    expect(out).toContain("Gardelli — Kieni ·");
    expect(out).not.toContain("Kieni (");
  });

  it("tags archived coffees", () => {
    const out = buildLedgerContext([lc({ archived: true })], NOW);
    expect(out).toContain("(archived)");
  });

  it("shows 'unrated' when there are ratings-free brews", () => {
    const out = buildLedgerContext([lc({ avg: null })], NOW);
    expect(out).toContain("avg unrated");
  });

  it("shows 'no brews yet' for a brew-less coffee and no avg/last", () => {
    const out = buildLedgerContext([lc({ brewCount: 0, avg: null, lastBrewedAt: null })], NOW);
    expect(out).toContain("no brews yet");
    expect(out).not.toContain("avg");
    expect(out).not.toContain("last ");
  });

  it("sorts by last-brewed descending with brew-less coffees last", () => {
    const older = lc({ id: "old", name: "Older", lastBrewedAt: Date.parse("2026-06-01T00:00:00Z") });
    const newer = lc({ id: "new", name: "Newer", lastBrewedAt: Date.parse("2026-06-19T00:00:00Z") });
    const none = lc({ id: "none", name: "Brewless", brewCount: 0, avg: null, lastBrewedAt: null });
    const out = buildLedgerContext([older, none, newer], NOW);
    const order = ["Newer", "Older", "Brewless"].map((n) => out.indexOf(n));
    expect(order[0]).toBeLessThan(order[1]);
    expect(order[1]).toBeLessThan(order[2]);
  });

  it("caps at LEDGER_CONTEXT_COFFEES_CAP and notes the remainder", () => {
    const many = Array.from({ length: LEDGER_CONTEXT_COFFEES_CAP + 3 }, (_, i) =>
      lc({ id: `c${i}`, name: `Coffee${i}`, lastBrewedAt: 1000 + i }));
    const out = buildLedgerContext(many, NOW);
    const lines = out.split("\n").filter((l) => l.startsWith("- "));
    expect(lines).toHaveLength(LEDGER_CONTEXT_COFFEES_CAP);
    expect(out).toContain("(+3 more coffees not shown)");
  });
});

describe("buildChatSystemPrompt", () => {
  const lc: LedgerCoffee = {
    id: "c1", roaster: "Gardelli", name: "Kieni", origin: null, process: null,
    roastLevel: null, roastDate: null, notes: null, archived: false, createdAt: 1,
    brewCount: 2, avg: 4, lastBrewedAt: 1000,
  };
  it("appends the ledger block after the chat system prompt", () => {
    const out = buildChatSystemPrompt([lc], Date.parse("2026-06-20T00:00:00Z"));
    expect(out.startsWith(CHAT_SYSTEM_PROMPT)).toBe(true);
    expect(out).toContain("Gardelli — Kieni");
    expect(out.length).toBeGreaterThan(CHAT_SYSTEM_PROMPT.length);
  });
  it("returns the bare prompt when the ledger is empty", () => {
    expect(buildChatSystemPrompt([], 0)).toBe(CHAT_SYSTEM_PROMPT);
  });
});
