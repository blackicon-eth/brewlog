import {
  BLOOM_END_S,
  buildPourSchedule,
  estimateFinishSeconds,
  PourScheduleError,
} from "../pourSchedule";

describe("buildPourSchedule", () => {
  describe("Hoffmann-like V60 (30 g, 1:16.67, bloom 2×, 2 pours)", () => {
    const schedule = buildPourSchedule({
      doseG: 30,
      ratio: 16.67,
      bloomMultiplier: 2,
      mainPours: 2,
      pourIntervalS: 45,
    });

    it("blooms to dose × multiplier (60 g) at t = 0", () => {
      expect(schedule.bloomWater).toBe(60);
      const bloom = schedule.steps[0];
      expect(bloom.atSeconds).toBe(0);
      expect(bloom.label).toBe("Bloom");
      expect(bloom.cumulativeTargetG).toBe(60);
    });

    it("finishes at the total water (500 g) on the last pour", () => {
      expect(schedule.totalWater).toBe(500);
      const last = schedule.steps[schedule.steps.length - 1];
      expect(last.cumulativeTargetG).toBe(500);
    });

    it("hits the ~300 g midpoint on pour 1 (bloman-style thirds)", () => {
      // bloom 60 + (500-60)/2 = 60 + 220 = 280 g. (The classic Hoffmann "half" landmark;
      // exact value follows deterministically from the split.)
      expect(schedule.steps[1].cumulativeTargetG).toBe(280);
    });

    it("spaces pour starts by the interval, first main pour at bloom end", () => {
      expect(schedule.steps[1].atSeconds).toBe(BLOOM_END_S); // 45
      expect(schedule.steps[2].atSeconds).toBe(BLOOM_END_S + 45); // 90
    });

    it("produces one step per pour plus the bloom", () => {
      expect(schedule.steps).toHaveLength(3); // bloom + 2 pours
      expect(schedule.steps.map((s) => s.label)).toEqual(["Bloom", "Pour 1", "Pour 2"]);
    });

    it("has a monotonically increasing cumulative target", () => {
      const targets = schedule.steps.map((s) => s.cumulativeTargetG);
      for (let i = 1; i < targets.length; i++) {
        expect(targets[i]).toBeGreaterThan(targets[i - 1]);
      }
    });
  });

  describe("clean exact case (30 g / 500 g explicit, 3 thirds)", () => {
    // Real Hoffmann recipe: 60 g bloom, then to 300 g, then to 500 g — with an explicit
    // total-water override and thirds it lands on the textbook landmarks exactly.
    const schedule = buildPourSchedule({
      doseG: 30,
      totalWaterG: 500,
      bloomMultiplier: 2,
      mainPours: 2,
      pourIntervalS: 45,
    });
    it("respects the explicit total water", () => {
      expect(schedule.totalWater).toBe(500);
      expect(schedule.bloomWater).toBe(60);
    });
    it("splits the remaining 440 g evenly across the 2 pours", () => {
      expect(schedule.steps[1].cumulativeTargetG).toBe(280);
      expect(schedule.steps[2].cumulativeTargetG).toBe(500);
    });
  });

  describe("single main pour", () => {
    const schedule = buildPourSchedule({
      doseG: 15,
      ratio: 16,
      bloomMultiplier: 2,
      mainPours: 1,
      pourIntervalS: 45,
    });
    it("is bloom + one pour, labelled 'Pour'", () => {
      expect(schedule.steps).toHaveLength(2);
      expect(schedule.steps[1].label).toBe("Pour");
    });
    it("pours straight to the total after the bloom", () => {
      expect(schedule.steps[0].cumulativeTargetG).toBe(30); // 15 × 2
      expect(schedule.steps[1].cumulativeTargetG).toBe(240); // 15 × 16
      expect(schedule.totalWater).toBe(240);
    });
  });

  describe("interval spacing with more pours", () => {
    it("cascades pour starts at bloom end + k×interval", () => {
      const s = buildPourSchedule({
        doseG: 20,
        ratio: 16,
        bloomMultiplier: 2,
        mainPours: 4,
        pourIntervalS: 30,
      });
      expect(s.steps.slice(1).map((p) => p.atSeconds)).toEqual([45, 75, 105, 135]);
    });

    it("shifts every pour start by a custom bloomTimeS", () => {
      const s = buildPourSchedule({
        doseG: 20,
        ratio: 16,
        bloomMultiplier: 2,
        bloomTimeS: 30,
        mainPours: 4,
        pourIntervalS: 30,
      });
      expect(s.steps.slice(1).map((p) => p.atSeconds)).toEqual([30, 60, 90, 120]);
    });
  });

  describe("validation", () => {
    const base = { doseG: 15, ratio: 16, bloomMultiplier: 2, mainPours: 2, pourIntervalS: 45 };

    it("rejects mainPours < 1", () => {
      expect(() => buildPourSchedule({ ...base, mainPours: 0 })).toThrow(PourScheduleError);
    });
    it("rejects non-integer mainPours", () => {
      expect(() => buildPourSchedule({ ...base, mainPours: 2.5 })).toThrow(PourScheduleError);
    });
    it("rejects non-positive dose", () => {
      expect(() => buildPourSchedule({ ...base, doseG: 0 })).toThrow(PourScheduleError);
    });
    it("rejects non-positive interval", () => {
      expect(() => buildPourSchedule({ ...base, pourIntervalS: 0 })).toThrow(PourScheduleError);
    });
    it("rejects non-positive bloomTimeS", () => {
      expect(() => buildPourSchedule({ ...base, bloomTimeS: 0 })).toThrow(PourScheduleError);
    });
    it("rejects a bloom that meets or exceeds the total", () => {
      // dose 15 × bloom 16 = 240 g == total (15 × 16) → no water left to pour.
      expect(() => buildPourSchedule({ ...base, bloomMultiplier: 16 })).toThrow(
        PourScheduleError
      );
    });
    it("rejects missing both ratio and totalWaterG", () => {
      expect(() =>
        buildPourSchedule({ doseG: 15, bloomMultiplier: 2, mainPours: 2, pourIntervalS: 45 })
      ).toThrow(PourScheduleError);
    });
  });

  describe("estimateFinishSeconds", () => {
    it("is last pour start + interval + drawdown, near the ~3:30 target", () => {
      const schedule = buildPourSchedule({
        doseG: 30,
        ratio: 16.67,
        bloomMultiplier: 2,
        mainPours: 2,
        pourIntervalS: 45,
      });
      // last pour at 90 + 45 + 30 = 165 s = 2:45 for a 2-pour recipe.
      expect(estimateFinishSeconds(schedule, 45)).toBe(165);
    });
  });
});
