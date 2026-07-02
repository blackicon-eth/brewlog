import { buildDiagnosePrompt, buildBestRecipePrompt, coffeeHeader, buildChatHistory } from "../advisor";
import { RECENT_BREWS_CAP, BEST_RECIPE_BREWS_CAP, CHAT_SYSTEM_PROMPT, CHAT_BREVITY_HINT } from "../promptConfig";
import type { Brew, Coffee } from "../../models/types";

const coffee: Coffee = {
  id: "c1", roaster: "Sey", name: "Kenya", origin: "Kenya", process: "washed",
  roastLevel: "light", roastDate: "2026-06-10", notes: null, createdAt: 1,
};
const brew = (over: Partial<Brew> = {}): Brew => ({
  id: "b1", coffeeId: "c1", brewedAt: 10, doseG: 15, waterG: 250, ratio: 16.6667,
  grind: "medium-fine", waterTempC: 94, dripper: "V60", pours: 3, pourIntervalS: 30,
  totalTimeS: 165, filterType: null, tds: null, ey: null,
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
    expect(user).toContain("next brew");
    expect(user).toContain("Sey");
  });
  it(`caps recent brews at ${RECENT_BREWS_CAP}`, () => {
    const many = Array.from({ length: 20 }, (_, i) => brew({ id: `b${i}`, brewedAt: i }));
    const user = buildDiagnosePrompt(coffee, many[0], many, NOW)[1].content;
    const rows = user.split("\n").filter((l) => /^\d+\)/.test(l.trim()));
    expect(rows.length).toBe(RECENT_BREWS_CAP);
  });
});

describe("buildBestRecipePrompt", () => {
  it("asks for the best recipe and includes all brews' ratios", () => {
    const msgs = buildBestRecipePrompt(coffee, [brew(), brew({ id: "b2", ratio: 15 })], NOW);
    expect(msgs).toHaveLength(2);
    const user = msgs[1].content;
    expect(user.toLowerCase()).toContain("best recipe");
    expect(user).toContain("1:16.7");
    expect(user).toContain("1:15.0");
  });
  it(`caps brews at BEST_RECIPE_BREWS_CAP (${BEST_RECIPE_BREWS_CAP})`, () => {
    const many = Array.from({ length: 30 }, (_, i) =>
      brew({ id: `b${i}`, ratio: 15 + i * 0.1 })
    );
    const user = buildBestRecipePrompt(coffee, many, NOW)[1].content;
    const rows = user.split("\n").filter((l) => /^\d+\)/.test(l.trim()));
    expect(rows.length).toBe(BEST_RECIPE_BREWS_CAP);
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
