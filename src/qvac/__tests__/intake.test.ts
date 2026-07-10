import { extractJson, buildBrewIntakePrompt, parseBrewIntake, buildCoffeeIntakePrompt, parseCoffeeIntake } from "../intake";

describe("extractJson", () => {
  it("parses a plain object", () => {
    expect(extractJson('{"a":1}')).toEqual({ a: 1 });
  });
  it("ignores surrounding prose", () => {
    expect(extractJson('Sure! {"a":1} hope that helps')).toEqual({ a: 1 });
  });
  it("strips json code fences", () => {
    expect(extractJson("```json\n{\"a\":1}\n```")).toEqual({ a: 1 });
  });
  it("returns null on a bare array", () => {
    expect(extractJson("[1,2,3]")).toBeNull();
  });
  it("returns null on garbage", () => {
    expect(extractJson("no json here")).toBeNull();
  });
  it("keeps braces inside string values", () => {
    expect(extractJson('{"notes":"pour to ~60% }","doseG":15}')).toEqual({ notes: "pour to ~60% }", doseG: 15 });
  });
});

describe("buildBrewIntakePrompt", () => {
  it("is a system+user pair embedding the text and allowed values", () => {
    const m = buildBrewIntakePrompt("15g 250g v60");
    expect(m).toHaveLength(2);
    expect(m[0].role).toBe("system");
    expect(m[1].role).toBe("user");
    expect(m[1].content).toContain("15g 250g v60");
    expect(m[0].content.toLowerCase()).toContain("white");
    expect(m[0].content).toContain("V60");
  });
});

describe("parseBrewIntake", () => {
  it("maps numbers and strings from a clean object", () => {
    const r = parseBrewIntake(
      '{"doseG":15,"waterG":250,"grind":"medium-fine","waterTempC":94,"dripper":"V60","pours":3,"pourIntervalS":30,"totalTimeS":165,"filterType":"white","notes":"juicy"}'
    );
    expect(r).toEqual({
      doseG: 15, waterG: 250, grind: "medium-fine", waterTempC: 94, dripper: "V60",
      pours: 3, pourIntervalS: 30, totalTimeS: 165, filterType: "white", notes: "juicy",
    });
  });
  it("omits nulls and unknown keys", () => {
    expect(parseBrewIntake('{"doseG":15,"waterG":null,"foo":"bar"}')).toEqual({ doseG: 15 });
  });
  it("coerces numeric strings", () => {
    expect(parseBrewIntake('{"doseG":"15"}').doseG).toBe(15);
  });
  it("clamps water temp to 0-100", () => {
    expect(parseBrewIntake('{"waterTempC":999}').waterTempC).toBe(100);
    expect(parseBrewIntake('{"waterTempC":-5}').waterTempC).toBe(0);
  });
  it("drops non-positive dose/water", () => {
    expect(parseBrewIntake('{"doseG":0,"waterG":-1}')).toEqual({});
  });
  it("rounds pours and requires >= 1", () => {
    expect(parseBrewIntake('{"pours":2.6}').pours).toBe(3);
    expect(parseBrewIntake('{"pours":0}').pours).toBeUndefined();
  });
  it("normalizes filterType/dripper case and drops invalid", () => {
    expect(parseBrewIntake('{"filterType":"White","dripper":"v60"}')).toEqual({ filterType: "white", dripper: "V60" });
    expect(parseBrewIntake('{"filterType":"brown","dripper":"Kalita"}')).toEqual({});
  });
  it("returns empty on garbage", () => {
    expect(parseBrewIntake("not json")).toEqual({});
  });
  it("parses the method, with common synonyms", () => {
    expect(parseBrewIntake('{"method":"moka"}').method).toBe("moka");
    expect(parseBrewIntake('{"method":"french press"}').method).toBe("french_press");
    expect(parseBrewIntake('{"method":"frenchpress"}').method).toBe("french_press");
    expect(parseBrewIntake('{"method":"V60"}').method).toBe("v60");
    expect(parseBrewIntake('{"method":"aeropress"}').method).toBeUndefined();
  });
  it("parses preheat only when strictly boolean", () => {
    expect(parseBrewIntake('{"preheat":true}').preheat).toBe(true);
    expect(parseBrewIntake('{"preheat":false}').preheat).toBe(false);
    expect(parseBrewIntake('{"preheat":"yes"}').preheat).toBeUndefined();
  });
  it("parses heat only from the three levels", () => {
    expect(parseBrewIntake('{"heat":"Medium"}').heat).toBe("medium");
    expect(parseBrewIntake('{"heat":"max"}').heat).toBeUndefined();
  });
  it("documents the new keys in the prompt", () => {
    const sys = buildBrewIntakePrompt("x")[0].content;
    expect(sys).toContain('"french_press"');
    expect(sys).toContain("preheat");
    expect(sys).toContain("yield");
  });
});

describe("buildCoffeeIntakePrompt", () => {
  it("is a system+user pair embedding the text and key list", () => {
    const m = buildCoffeeIntakePrompt("Sey Kenya washed");
    expect(m).toHaveLength(2);
    expect(m[1].content).toContain("Sey Kenya washed");
    expect(m[0].content).toContain("roastDate");
  });
});

describe("parseCoffeeIntake", () => {
  it("maps and trims fields", () => {
    expect(
      parseCoffeeIntake('{"roaster":" Sey ","name":"Kenya","origin":"Kenya","process":"washed","roastLevel":"light","roastDate":"2026-06-10","notes":"floral"}')
    ).toEqual({ roaster: "Sey", name: "Kenya", origin: "Kenya", process: "washed", roastLevel: "light", roastDate: "2026-06-10", notes: "floral" });
  });
  it("drops a malformed roastDate", () => {
    expect(parseCoffeeIntake('{"roastDate":"June 10"}')).toEqual({});
  });
  it("omits nulls and empty strings", () => {
    expect(parseCoffeeIntake('{"roaster":"Sey","name":null,"origin":""}')).toEqual({ roaster: "Sey" });
  });
  it("returns empty on garbage", () => {
    expect(parseCoffeeIntake("nope")).toEqual({});
  });
});
