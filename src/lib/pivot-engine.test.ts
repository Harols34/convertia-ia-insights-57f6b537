import { describe, expect, it } from "vitest";
import { buildPivotGrid, formatPivotLabel, PIVOT_KEY_SEP, runPivotAggregation, toScalarString } from "./pivot-engine";

describe("pivot-engine", () => {
  const rows = [
    { region: "N", city: "A", mkt: "X", amount: 10 },
    { region: "N", city: "A", mkt: "Y", amount: 20 },
    { region: "N", city: "B", mkt: "X", amount: 30 },
    { region: "S", city: "C", mkt: "X", amount: 40 },
  ];

  it("agrupa filas y columnas y suma", () => {
    const { rowKeys, colKeys, raw } = runPivotAggregation(rows as Record<string, unknown>[], {
      rowFields: ["region", "city"],
      colFields: ["mkt"],
      filters: [],
      measures: [{ id: "m1", kind: "field", field: "amount", aggregation: "sum", showAs: "none" }],
    });
    expect(rowKeys.length).toBeGreaterThan(0);
    expect(colKeys).toContain(["X"].join(PIVOT_KEY_SEP));
    const rkN_A = ["N", "A"].join(PIVOT_KEY_SEP);
    const ckX = ["X"].join(PIVOT_KEY_SEP);
    expect(raw.get(rkN_A)?.get(ckX)?.get("m1")).toBe(10);
  });

  it("% del total general", () => {
    const grid = buildPivotGrid(rows as Record<string, unknown>[], {
      rowFields: ["region"],
      colFields: [],
      filters: [],
      measures: [{ id: "m1", kind: "field", field: "amount", aggregation: "sum", showAs: "percentGrand" }],
    });
    const rkN = ["N"].join(PIVOT_KEY_SEP);
    const ck = ["Σ"].join(PIVOT_KEY_SEP);
    const total = 10 + 20 + 30 + 40;
    const vN = grid.cells.get(rkN)?.get(ck)?.get("m1") ?? 0;
    expect(vN).toBeCloseTo(((10 + 20 + 30) / total) * 100, 5);
  });

  it("respeta filtros", () => {
    const { raw } = runPivotAggregation(rows as Record<string, unknown>[], {
      rowFields: ["city"],
      colFields: [],
      filters: [{ field: "region", values: ["N"] }],
      measures: [{ id: "m1", kind: "field", field: "amount", aggregation: "count", showAs: "none" }],
    });
    const vals = [...raw.values()].flatMap((m) => [...m.values()].map((c) => c.get("m1")));
    const sum = vals.reduce((a, b) => a + b, 0);
    expect(sum).toBe(3);
  });

  it("medida calculada divide dos sumas", () => {
    const grid = buildPivotGrid(rows as Record<string, unknown>[], {
      rowFields: ["region"],
      colFields: [],
      filters: [],
      measures: [
        { id: "a", kind: "field", field: "amount", aggregation: "sum", showAs: "none" },
        { id: "b", kind: "field", field: "amount", aggregation: "count", showAs: "none" },
        {
          id: "c",
          kind: "calculated",
          calculated: { op: "divide", leftId: "a", rightId: "b" },
          showAs: "none",
        },
      ],
    });
    const rkN = ["N"].join(PIVOT_KEY_SEP);
    const ck = ["Σ"].join(PIVOT_KEY_SEP);
    const avg = grid.cells.get(rkN)?.get(ck)?.get("c") ?? 0;
    expect(avg).toBeCloseTo(60 / 3, 5);
  });

  it("formatPivotLabel y toScalarString", () => {
    expect(formatPivotLabel(["a", "b"])).toBe("a · b");
    expect(toScalarString(null)).toBe("");
  });
});
