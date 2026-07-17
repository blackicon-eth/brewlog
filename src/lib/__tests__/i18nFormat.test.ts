import { formatRatio } from "../ratio";
import { formatBrewDate, formatBrewTime } from "../brewFormat";
import {
  formatNumberLocale, formatRatioLocale, formatBrewDateLocale, formatBrewTimeLocale,
} from "../i18n/format";

// Fixed brew timestamp: Fri 17 Jul 2026, 14:30 local.
const TS = new Date(2026, 6, 17, 14, 30).getTime();

describe("formatNumberLocale", () => {
  it("formats with EN (period) and IT (comma) decimal separators", () => {
    expect(formatNumberLocale(16, "en", { minimumFractionDigits: 1, maximumFractionDigits: 1 })).toBe("16.0");
    expect(formatNumberLocale(16, "it", { minimumFractionDigits: 1, maximumFractionDigits: 1 })).toBe("16,0");
  });
});

describe("formatRatioLocale", () => {
  it("matches the legacy formatRatio output for EN", () => {
    expect(formatRatioLocale(16, "en")).toBe(formatRatio(16));
    expect(formatRatioLocale(16.6667, "en")).toBe(formatRatio(16.6667));
  });

  it("uses a comma for IT", () => {
    expect(formatRatioLocale(16, "it")).toBe("1:16,0");
    expect(formatRatioLocale(16.6667, "it")).toBe("1:16,7");
  });
});

describe("formatBrewDateLocale", () => {
  it("matches the legacy formatBrewDate output for EN", () => {
    expect(formatBrewDateLocale(TS, "en")).toBe(formatBrewDate(TS));
    expect(formatBrewDateLocale(TS, "en")).toBe("17 Jul");
  });

  it("renders an Italian month for IT", () => {
    expect(formatBrewDateLocale(TS, "it")).toMatch(/lug/i);
  });
});

describe("formatBrewTimeLocale", () => {
  it("matches the legacy formatBrewTime output for EN", () => {
    expect(formatBrewTimeLocale(TS, "en")).toBe(formatBrewTime(TS));
    expect(formatBrewTimeLocale(TS, "en")).toBe("14:30");
  });

  it("renders 24h time for IT too", () => {
    expect(formatBrewTimeLocale(TS, "it")).toBe("14:30");
  });
});
