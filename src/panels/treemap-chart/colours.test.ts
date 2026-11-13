import { hashIndex, thresholdBand, thresholdBands, withAlpha } from "./colours";

const theme = { defaultColor: "#00ff00", palette: ["#111111", "#222222"] };

describe("withAlpha", () => {
  it("handles short and long hex and rgb()", () => {
    expect(withAlpha("#f00", 0.5)).toBe("rgba(255, 0, 0, 0.5)");
    expect(withAlpha("#0000ff", 0.2)).toBe("rgba(0, 0, 255, 0.2)");
    expect(withAlpha("rgb(1, 2, 3)", 1)).toBe("rgba(1, 2, 3, 1)");
    expect(withAlpha("red", 0.5)).toBe("red");
  });
});

describe("hashIndex", () => {
  it("is stable and in range", () => {
    expect(hashIndex("team-a", 6)).toBe(hashIndex("team-a", 6));
    expect(hashIndex("anything", 6)).toBeGreaterThanOrEqual(0);
    expect(hashIndex("anything", 6)).toBeLessThan(6);
    expect(hashIndex("x", 0)).toBe(0);
  });
});

describe("thresholdBand", () => {
  const thresholds = {
    steps: [{ value: 10 }, { value: 50, color: "#ff0000", name: "high" }],
  };

  it("uses the default colour below the first step", () => {
    expect(
      thresholdBand(5, 100, thresholds, { unit: "decimal" }, theme),
    ).toMatchObject({ index: 0, color: "#00ff00", label: "< 10" });
  });

  it("takes the step's colour, or the palette's, and labels it", () => {
    expect(
      thresholdBand(20, 100, thresholds, { unit: "decimal" }, theme),
    ).toMatchObject({ index: 1, color: "#111111", label: "≥ 10" });
    expect(
      thresholdBand(60, 100, thresholds, { unit: "decimal" }, theme),
    ).toMatchObject({ index: 2, color: "#ff0000", label: "high" });
  });

  it("compares the share of the total in percent mode", () => {
    const percent = { mode: "percent" as const, steps: [{ value: 25 }] };
    expect(thresholdBand(30, 100, percent, {}, theme).index).toBe(1);
    expect(thresholdBand(30, 1000, percent, {}, theme).index).toBe(0);
    expect(thresholdBand(30, 0, percent, {}, theme).index).toBe(0);
  });

  it("lists every band for the legend", () => {
    expect(
      thresholdBands(thresholds, { unit: "decimal" }, theme).map(
        (b) => b.label,
      ),
    ).toEqual(["< 10", "≥ 10", "high"]);
  });
});
