import { METHODS, METHODS_BY_ID, isBrewMethodId, methodSpec, methodFilterSql, defaultPickerMethod, type MethodFilter } from "../brewMethods";
import { en } from "../i18n/en";
import type { Brew } from "../../models/types";

const mkBrew = (method: Brew["method"]): Brew => ({
  id: `b-${Math.random()}`, coffeeId: "c1", brewedAt: 1, method,
  doseG: 15, waterG: 250, ratio: 16.7, grind: null, waterTempC: null, dripper: null,
  pours: null, pourIntervalS: null, totalTimeS: null, filterType: null, preheat: null, heat: null,
  acidity: null, sweetness: null, bitterness: null, body: null, clarity: null, rating: null,
  notes: null, createdAt: 1,
});

describe("brewMethods registry", () => {
  it("contains exactly the four methods in shelf order", () => {
    expect(METHODS.map((m) => m.id)).toEqual(["filter", "french_press", "moka", "espresso"]);
  });

  it("resolves each id and falls back to filter for unknown/absent", () => {
    for (const m of METHODS) expect(methodSpec(m.id)).toBe(METHODS_BY_ID[m.id]);
    expect(methodSpec("aeropress").id).toBe("filter");
    expect(methodSpec(null).id).toBe("filter");
    expect(methodSpec(undefined).id).toBe("filter");
    expect(methodSpec("v60").id).toBe("filter"); // pre-rename rows read as filter
  });

  it("type-guards method ids", () => {
    expect(isBrewMethodId("moka")).toBe(true);
    expect(isBrewMethodId("v60")).toBe(false); // retired id
    expect(isBrewMethodId(3)).toBe(false);
  });

  it("gives every spec complete prompt/behavioral metadata", () => {
    for (const m of METHODS) {
      expect(m.noun.length).toBeGreaterThan(0);
      expect(m.adjustables.length).toBeGreaterThan(0);
      expect(m.process.length).toBeGreaterThan(0);
    }
  });

  it("moka is the only temp-less method", () => {
    expect(METHODS.filter((m) => !m.showTemp).map((m) => m.id)).toEqual(["moka"]);
  });

  it("espresso is the only yield-labeled method (per the en dictionary)", () => {
    expect(en.methods.espresso.waterLabel).toBe("Yield (g)");
    expect(METHODS.filter((m) => m.id !== "espresso").every((m) => en.methods[m.id].waterLabel === "Water (g)")).toBe(true);
    expect(en.methods.espresso.ratioNoun).toBe("dose to yield");
  });

  it("filter's process matches today's form; moka carries preheat and heat", () => {
    expect(METHODS_BY_ID.filter.process).toEqual(["filterType", "pours", "time"]);
    expect(METHODS_BY_ID.moka.process).toEqual(["preheat", "heat"]); // no time: tracks pot size, not technique
    expect(METHODS_BY_ID.french_press.process).toEqual(["time"]);
    expect(METHODS_BY_ID.espresso.process).toEqual(["time"]);
  });
});

describe("methodFilterSql", () => {
  it("returns an empty clause for 'all' (no constraint)", () => {
    expect(methodFilterSql("all")).toEqual({ clause: "", params: [] });
  });

  it("exact-matches a concrete non-filter method", () => {
    expect(methodFilterSql("espresso")).toEqual({ clause: "method = ?", params: ["espresso"] });
    expect(methodFilterSql("moka")).toEqual({ clause: "method = ?", params: ["moka"] });
    expect(methodFilterSql("french_press")).toEqual({ clause: "method = ?", params: ["french_press"] });
  });

  it("matches 'filter' plus legacy/NULL/unknown rows for the filter view", () => {
    expect(methodFilterSql("filter")).toEqual({
      clause: "(method IS NULL OR method NOT IN ('french_press','moka','espresso'))",
      params: [],
    });
  });

  it("emits unqualified column names (safe in both the join and count queries)", () => {
    expect(methodFilterSql("espresso").clause).not.toContain("b.method");
    expect(methodFilterSql("filter").clause).not.toContain("b.method");
  });
});

describe("defaultPickerMethod", () => {
  it("returns filter when there are no brews", () => {
    expect(defaultPickerMethod([])).toBe("filter");
  });

  it("returns the most-brewed method", () => {
    const brews = [mkBrew("moka"), mkBrew("moka"), mkBrew("espresso")];
    expect(defaultPickerMethod(brews)).toBe("moka");
  });

  it("breaks ties by shelf order (filter before french_press)", () => {
    const brews = [mkBrew("french_press"), mkBrew("filter")];
    expect(defaultPickerMethod(brews)).toBe("filter");
  });
});
