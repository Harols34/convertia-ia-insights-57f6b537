import { describe, expect, it } from "vitest";
import {
  fchCreacionToLocalYmd,
  getDefaultMonthToDateRange,
  normalizeLeadsDatasetForDashboard,
  type LeadRow,
} from "./dashboard-leads";

describe("getDefaultMonthToDateRange", () => {
  it("inicia en día 1 del mes y termina hoy (inclusive) en el mismo mes", () => {
    const ref = new Date("2026-04-15T14:00:00");
    const { desde, hasta } = getDefaultMonthToDateRange(ref);
    expect(desde).toBe("2026-04-01");
    expect(hasta).toBe("2026-04-15");
    expect(desde <= hasta).toBe(true);
  });
});

describe("fchCreacionToLocalYmd", () => {
  it("convierte ISO con hora a yyyy-MM-dd en calendario local (no el prefijo UTC crudo)", () => {
    const y = fchCreacionToLocalYmd("2026-01-02T12:00:00.000Z");
    expect(y).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("fecha solo se mantiene", () => {
    expect(fchCreacionToLocalYmd("2026-04-10")).toBe("2026-04-10");
  });
});

describe("normalizeLeadsDatasetForDashboard", () => {
  it("fija fch_creacion en filas", () => {
    const rows: LeadRow[] = [
      { fch_creacion: "2025-12-20T00:00:00.000Z" } as LeadRow,
      { fch_creacion: "2025-12-18" } as LeadRow,
    ];
    const n = normalizeLeadsDatasetForDashboard(rows);
    expect(n[0]!.fch_creacion).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(n[1]!.fch_creacion).toBe("2025-12-18");
  });
});
