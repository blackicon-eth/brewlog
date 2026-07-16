import { parseRecipeNumber, normalizeRecipeText } from "../recipe";

describe("parseRecipeNumber", () => {
  it("parses a number, blanks to null, junk to null", () => {
    expect(parseRecipeNumber("18")).toBe(18);
    expect(parseRecipeNumber("  ")).toBeNull();
    expect(parseRecipeNumber("abc")).toBeNull();
  });
});

describe("normalizeRecipeText", () => {
  it("trims and blanks empty to null", () => {
    expect(normalizeRecipeText("  hi  ")).toBe("hi");
    expect(normalizeRecipeText("   ")).toBeNull();
  });
});
