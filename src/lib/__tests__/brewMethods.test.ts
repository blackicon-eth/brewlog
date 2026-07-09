import { METHODS, METHODS_BY_ID, isBrewMethodId, methodSpec } from "../brewMethods";

describe("brewMethods registry", () => {
  it("contains exactly the four methods in shelf order", () => {
    expect(METHODS.map((m) => m.id)).toEqual(["v60", "french_press", "moka", "espresso"]);
  });

  it("resolves each id and falls back to v60 for unknown/absent", () => {
    for (const m of METHODS) expect(methodSpec(m.id)).toBe(METHODS_BY_ID[m.id]);
    expect(methodSpec("aeropress").id).toBe("v60");
    expect(methodSpec(null).id).toBe("v60");
    expect(methodSpec(undefined).id).toBe("v60");
  });

  it("type-guards method ids", () => {
    expect(isBrewMethodId("moka")).toBe(true);
    expect(isBrewMethodId("V60")).toBe(false);
    expect(isBrewMethodId(3)).toBe(false);
  });

  it("gives every spec complete display metadata", () => {
    for (const m of METHODS) {
      expect(m.label.length).toBeGreaterThan(0);
      expect(m.shortLabel.length).toBeGreaterThan(0);
      expect(m.noun.length).toBeGreaterThan(0);
      expect(m.adjustables.length).toBeGreaterThan(0);
      expect(m.process).toContain("time");
    }
  });

  it("espresso is the only yield-labeled method; moka the only temp-less one", () => {
    expect(METHODS.filter((m) => m.waterLabel === "Yield (g)").map((m) => m.id)).toEqual(["espresso"]);
    expect(METHODS.filter((m) => !m.showTemp).map((m) => m.id)).toEqual(["moka"]);
    expect(METHODS_BY_ID.espresso.ratioNoun).toBe("dose to yield");
  });

  it("v60's process matches today's form; moka carries preheat and heat", () => {
    expect(METHODS_BY_ID.v60.process).toEqual(["dripper", "filterType", "pours", "time"]);
    expect(METHODS_BY_ID.moka.process).toEqual(["preheat", "heat", "time"]);
    expect(METHODS_BY_ID.french_press.process).toEqual(["time"]);
    expect(METHODS_BY_ID.espresso.process).toEqual(["time"]);
  });
});
