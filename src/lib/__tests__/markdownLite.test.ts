import { parseMarkdownLite, parseSpans } from "../markdownLite";

describe("parseSpans", () => {
  it("passes plain text through as one span", () => {
    expect(parseSpans("just words")).toEqual([{ text: "just words" }]);
  });

  it("styles bold, italic, and code spans", () => {
    expect(parseSpans("a **bold** and *slanted* `18g` mix")).toEqual([
      { text: "a " }, { text: "bold", bold: true },
      { text: " and " }, { text: "slanted", italic: true },
      { text: " " }, { text: "18g", code: true }, { text: " mix" },
    ]);
  });

  it("runs an unclosed ** to the end of the line (streaming half-state)", () => {
    expect(parseSpans("start **still typ")).toEqual([
      { text: "start " }, { text: "still typ", bold: true },
    ]);
  });

  it("keeps arithmetic asterisks literal", () => {
    expect(parseSpans("dose * 16.7 = water")).toEqual([{ text: "dose * 16.7 = water" }]);
  });

  it("keeps an unclosed backtick literal", () => {
    expect(parseSpans("press ` once")).toEqual([{ text: "press ` once" }]);
  });
});

describe("parseMarkdownLite", () => {
  it("reads headings, bullets, ordered items, and paragraphs", () => {
    const blocks = parseMarkdownLite("## Adjustments\n- grind finer\n1. bloom 45g\nKeep the rest.");
    expect(blocks.map((b) => b.type)).toEqual(["heading", "bullet", "ordered", "para"]);
    expect(blocks[2]).toMatchObject({ marker: "1" });
  });

  it("treats a lone bold line as a heading", () => {
    expect(parseMarkdownLite("**Best recipe:**")).toEqual([
      { type: "heading", spans: [{ text: "Best recipe" }] },
    ]);
  });

  it("drops blank lines and trims edges", () => {
    expect(parseMarkdownLite("\n\n  hello  \n\n")).toEqual([
      { type: "para", spans: [{ text: "hello" }] },
    ]);
  });

  it("accepts every bullet glyph the models use", () => {
    const blocks = parseMarkdownLite("- one\n* two\n• three");
    expect(blocks.every((b) => b.type === "bullet")).toBe(true);
  });
});
