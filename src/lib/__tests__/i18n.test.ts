import { en } from "../i18n/en";
import { it as itDict } from "../i18n/it";
import { t, tn, resolveLocale } from "../i18n/t";
import {
  methodLabel,
  methodShortLabel,
  methodOptions,
  methodDosePlaceholder,
  toolTitle,
  toolBlurb,
  aiModelNote,
  compassCellText,
  extractionBandText,
} from "../i18n/labels";

describe("t", () => {
  it("looks up a dot-path key", () => {
    expect(t(en, "common.save")).toBe("Save");
    expect(t(itDict, "common.save")).toBe("Salva");
  });
  it("interpolates {vars} and leaves unknown placeholders literal", () => {
    // settings.language.testGreeting exists only to pin interpolation behavior
    expect(t(en, "common.greeting", { name: "Mattia" })).toBe("Hello Mattia");
    expect(t(en, "common.greeting")).toBe("Hello {name}");
  });
  it("returns the key itself for a missing path (never throws)", () => {
    expect(t(en, "nope.missing" as never)).toBe("nope.missing");
  });
});

describe("tn", () => {
  it("picks one/other and interpolates {n}", () => {
    expect(tn(en, "common.brewCount", 1)).toBe("1 brew");
    expect(tn(en, "common.brewCount", 3)).toBe("3 brews");
    expect(tn(itDict, "common.brewCount", 1)).toBe("1 estrazione");
    expect(tn(itDict, "common.brewCount", 3)).toBe("3 estrazioni");
  });
});

describe("resolveLocale", () => {
  it("maps it/it-IT to it and everything else to en", () => {
    expect(resolveLocale("it")).toBe("it");
    expect(resolveLocale("it-IT")).toBe("it");
    expect(resolveLocale("en-US")).toBe("en");
    expect(resolveLocale("de-DE")).toBe("en");
    expect(resolveLocale(null)).toBe("en");
    expect(resolveLocale(undefined)).toBe("en");
  });
});

describe("method labels", () => {
  it("resolves method labels per dictionary", () => {
    expect(methodLabel(en, "french_press")).toBe("French Press");
    expect(methodLabel(itDict, "french_press")).toBe("French Press");
    expect(methodShortLabel(itDict, "filter")).toBe("Filtro");
  });
  it("builds method options in shelf order", () => {
    expect(methodOptions(en).map((o) => o.value)).toEqual(["filter", "french_press", "moka", "espresso"]);
  });
  it("keeps numeric placeholders locale-independent", () => {
    expect(methodDosePlaceholder("espresso")).toBe("18");
  });
});

describe("tool metas", () => {
  it("resolves tool titles/blurbs per dictionary", () => {
    expect(toolTitle(en, "ratio")).toBe("Brew Ratio");
    expect(toolTitle(itDict, "ratio")).toBe("Rapporto di estrazione");
    expect(toolBlurb(en, "ratio")).toBe("Solve dose, water, or ratio");
    expect(toolBlurb(itDict, "ratio")).toBe("Calcola dose, acqua o rapporto");
  });
});

// Coverage that used to live on coffeeCompass.test.ts / extraction.test.ts as verdict-text
// assertions: the copy itself now lives in the dictionary (src/lib/coffeeCompass.ts and
// src/lib/extraction.ts only classify into ids), so it's exercised here instead.
describe("compassCellText", () => {
  it("resolves distinct title/advice text for all nine cells, in both locales", () => {
    const exAxes = ["under", "ideal", "over"] as const;
    const strAxes = ["weak", "ideal", "strong"] as const;
    const titles = new Set<string>();
    for (const ex of exAxes)
      for (const str of strAxes) {
        const cell = compassCellText(en, ex, str);
        expect(cell.title.length).toBeGreaterThan(0);
        expect(cell.advice.length).toBeGreaterThan(0);
        titles.add(cell.title);
        expect(compassCellText(itDict, ex, str).title.length).toBeGreaterThan(0);
      }
    expect(titles.size).toBe(9);
  });

  it("matches the fix advice to the diagnosis (grind finer for under-extraction, coarser for over)", () => {
    expect(compassCellText(en, "under", "weak").advice.toLowerCase()).toContain("finer");
    expect(compassCellText(en, "over", "strong").advice.toLowerCase()).toContain("coarser");
  });
});

describe("extractionBandText", () => {
  it("resolves a verdict + note for every band, in both locales", () => {
    for (const b of ["under", "ideal", "over"] as const) {
      expect(extractionBandText(en, b).verdict.length).toBeGreaterThan(0);
      expect(extractionBandText(itDict, b).note.length).toBeGreaterThan(0);
    }
  });
});

describe("aiModelNote", () => {
  it("resolves a non-empty note for a known model in both locales", () => {
    expect(aiModelNote(en, "QWEN3_1_7B_INST_Q4")).not.toBe("");
    expect(aiModelNote(itDict, "QWEN3_1_7B_INST_Q4")).not.toBe("");
  });
  it("falls back to the model id for an unknown model", () => {
    expect(aiModelNote(en, "SOME_REMOVED_MODEL")).toBe("SOME_REMOVED_MODEL");
  });
});
