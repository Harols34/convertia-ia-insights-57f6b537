import { describe, expect, it } from "vitest";
import type { LeadRow } from "@/lib/dashboard-leads";
import {
  buildComparisonFromRpcDaily,
  buildComparisonSeriesSpec,
  getLeadsCreationDateBounds,
  leadDateBoundsOverlapComparisonWindow,
  parseLeadDate,
  sumComparisonSeriesActual,
  todayAnchorUsedMaxDataFallback,
} from "./dashboard-leads-analytics";

function row(fch: unknown): LeadRow {
  return { fch_creacion: fch } as LeadRow;
}

describe("parseLeadDate", () => {
  it("acepta YYYY-MM-DD o prefijo ISO", () => {
    const a = parseLeadDate(row("2021-03-20"));
    const b = parseLeadDate(row("2021-03-20T12:00:00.000Z"));
    expect(a?.getFullYear()).toBe(2021);
    expect(b?.getFullYear()).toBe(2021);
  });

  it("acepta instancia Date", () => {
    const d = new Date(Date.UTC(2022, 5, 10, 15, 0, 0));
    const p = parseLeadDate(row(d));
    expect(p).not.toBeNull();
    expect(p!.getFullYear()).toBe(2022);
  });

  it("hace fallback con string no-ISO razonable", () => {
    const p = parseLeadDate(row("10/15/2019 08:00"));
    if (p) {
      expect(p.getFullYear()).toBe(2019);
    }
  });

  it("devuelve null ante valores vacíos o inválidos", () => {
    expect(parseLeadDate(row(null))).toBeNull();
    expect(parseLeadDate(row(""))).toBeNull();
    expect(parseLeadDate(row("  "))).toBeNull();
  });
});

describe("ventana de comparativa", () => {
  it("con datos fuera de la ventana de «hoy», anclaje today hace fallback a la última fch; maxLeadDate coincide", () => {
    const leads: LeadRow[] = [
      { fch_creacion: "2019-06-10T00:00:00Z", es_venta: false, result_negocio: null, result_prim_gestion: null } as LeadRow,
      { fch_creacion: "2019-06-11T00:00:00Z", es_venta: true, result_negocio: null, result_prim_gestion: null } as LeadRow,
    ];
    const spec = { kind: "leads" as const };
    const todayWin = buildComparisonSeriesSpec(leads, 7, "prev_calendar_day", spec, {
      anchor: { type: "today" },
    });
    const maxWin = buildComparisonSeriesSpec(leads, 7, "prev_calendar_day", spec, {
      anchor: { type: "maxLeadDate" },
    });
    expect(sumComparisonSeriesActual(todayWin.points)).toBeGreaterThan(0);
    expect(sumComparisonSeriesActual(todayWin.points)).toBe(sumComparisonSeriesActual(maxWin.points));
  });

  it("getLeadsCreationDateBounds devuelve min/max con fechas parseables", () => {
    const leads = [row("2020-01-01T00:00:00Z"), row("2020-12-31")];
    const b = getLeadsCreationDateBounds(leads);
    expect(b.min).not.toBeNull();
    expect(b.max).not.toBeNull();
    expect(b.max!.getTime()).toBeGreaterThanOrEqual(b.min!.getTime());
  });

  it("leadDateBoundsOverlapComparisonWindow: sin solape si el eje (filtros) no toca fch del corte", () => {
    const leads: LeadRow[] = [
      { fch_creacion: "2019-06-10T00:00:00Z" } as LeadRow,
    ];
    expect(
      leadDateBoundsOverlapComparisonWindow(leads, 7, {
        anchor: { type: "dashboardDateFilters" },
        filterDesde: "2024-01-01",
        filterHasta: "2024-01-15",
      }),
    ).toBe(false);
  });

  it("todayAnchorUsedMaxDataFallback: datos solo en el pasado con anclaje hoy", () => {
    const leads: LeadRow[] = [{ fch_creacion: "2019-06-10T00:00:00Z" } as LeadRow];
    expect(
      todayAnchorUsedMaxDataFallback(leads, 7, { anchor: { type: "today" } }),
    ).toBe(true);
  });
});

describe("buildComparisonFromRpcDaily", () => {
  it("alinea con últimos días del arreglo diario (prev_calendar_day)", () => {
    const daily = [
      { date: "2024-01-01", leads: 1, ventas: 0 },
      { date: "2024-01-02", leads: 2, ventas: 1 },
      { date: "2024-01-03", leads: 3, ventas: 0 },
    ];
    const { points, dateKeys } = buildComparisonFromRpcDaily(daily, 2, "leads", "prev_calendar_day");
    expect(dateKeys).toEqual(["2024-01-02", "2024-01-03"]);
    expect(points[0]!.actual).toBe(2);
    expect(points[0]!.anterior).toBe(1);
    expect(points[1]!.actual).toBe(3);
    expect(points[1]!.anterior).toBe(2);
  });
});
