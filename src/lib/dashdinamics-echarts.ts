/**
 * Cambio de tipo en runtime para gráficos ECharts cartesianos (bar / line / area).
 */

export type CartesianChartType = "bar" | "line" | "area";

/** Solo entradas objeto (el LLM a vez devuelve basura tipo strings en series[]) */
function seriesAsObjects(raw: unknown): Record<string, unknown>[] {
  if (Array.isArray(raw)) {
    return (raw as unknown[]).filter(
      (s): s is Record<string, unknown> => s !== null && typeof s === "object" && !Array.isArray(s),
    );
  }
  if (raw !== null && typeof raw === "object" && !Array.isArray(raw)) {
    return [raw as Record<string, unknown>];
  }
  return [];
}

function firstSeriesObject(opt: Record<string, unknown>): Record<string, unknown> | null {
  const list = seriesAsObjects(opt.series);
  return list[0] ?? null;
}

/**
 * Fuerza tooltip con valores visibles al hover: evita `show:false`, `trigger:none`, `showContent:false`
 * y el recorte típico dentro de contenedores con overflow (p. ej. ScrollArea del chat).
 */
export function ensureDashboardTooltip(opt: Record<string, unknown>): Record<string, unknown> {
  const clone = { ...opt } as Record<string, unknown>;
  const series = seriesAsObjects(clone.series);
  const types = new Set(series.map((s) => s.type).filter(Boolean) as string[]);
  const isPieLike = ["pie", "sunburst", "funnel", "treemap", "sankey"].some((t) => types.has(t));
  const hasCartesian =
    clone.xAxis != null &&
    clone.yAxis != null &&
    (types.size === 0 || ["bar", "line", "scatter", "candlestick"].some((t) => types.has(t)));

  let defaultTrigger: "axis" | "item" = "item";
  if (hasCartesian && !isPieLike) defaultTrigger = "axis";

  const prevRaw = clone.tooltip;
  const prev =
    prevRaw && typeof prevRaw === "object" && !Array.isArray(prevRaw)
      ? { ...(prevRaw as Record<string, unknown>) }
      : {};

  let trigger = prev.trigger as string | undefined;
  if (trigger === "none" || trigger == null) trigger = defaultTrigger;
  if (trigger !== "axis" && trigger !== "item") trigger = defaultTrigger;

  const { show: _ignoreShow, showContent: _ignoreContent, trigger: _ignoreTr, appendTo: prevAppendTo, ...prevRest } =
    prev;

  const tooltip: Record<string, unknown> = {
    confine: false,
    backgroundColor: "rgba(255, 255, 255, 0.98)",
    borderColor: "rgba(148, 163, 184, 0.55)",
    borderWidth: 1,
    padding: [8, 12],
    textStyle: { color: "#0f172a", fontSize: 12 },
    extraCssText: "box-shadow: 0 4px 20px rgba(15,23,42,0.12); z-index: 100;",
    ...prevRest,
    show: true,
    showContent: true,
    appendTo: prevAppendTo ?? "body",
    trigger,
  };

  if (trigger === "axis" && tooltip.axisPointer == null) {
    tooltip.axisPointer = {
      type: "line",
      lineStyle: { width: 1, type: "dashed", color: "rgba(100,116,139,0.6)" },
    };
  }

  clone.tooltip = tooltip;
  return clone;
}

export function isCartesianEChartsOption(opt: Record<string, unknown>): boolean {
  const s0 = firstSeriesObject(opt);
  if (!s0) return false;
  const t = s0.type as string | undefined;
  return Boolean(opt.xAxis && t && ["bar", "line", "scatter"].includes(t));
}

function firstAxisType(axis: unknown): string | undefined {
  if (axis == null) return undefined;
  const a = Array.isArray(axis) ? (axis[0] as { type?: string }) : (axis as { type?: string });
  return a?.type;
}

/**
 * Solo gráficos cartesianos “verticales” (categoría/tiempo en X, valor en Y).
 * Barras horizontales (value en X, category en Y) rompen al forzar líneas/área → yAxis "0" not found.
 */
export function isVerticalCartesianForTypeSwitch(opt: Record<string, unknown>): boolean {
  if (!isCartesianEChartsOption(opt)) return false;
  const xt = firstAxisType(opt.xAxis);
  const yt = firstAxisType(opt.yAxis);
  if (xt === "value" && (yt === "category" || yt === "time")) return false;
  const s0 = firstSeriesObject(opt);
  const cs = s0?.coordinateSystem as string | undefined;
  if (cs && cs !== "cartesian2d") return false;
  return true;
}

export function inferCartesianType(opt: Record<string, unknown>): CartesianChartType {
  const s0 = firstSeriesObject(opt);
  if (!s0) return "bar";
  const t = s0.type as string;
  if (t === "line" && s0.areaStyle) return "area";
  if (t === "line") return "line";
  return "bar";
}

export function applyCartesianChartType(
  opt: Record<string, unknown>,
  next: CartesianChartType,
): Record<string, unknown> {
  let clone: Record<string, unknown>;
  try {
    clone = JSON.parse(JSON.stringify(opt)) as Record<string, unknown>;
  } catch {
    return opt;
  }
  const raw = clone.series as unknown;
  if (!Array.isArray(raw)) return clone;

  const cleaned = (raw as unknown[]).filter(
    (s): s is Record<string, unknown> => s !== null && typeof s === "object" && !Array.isArray(s),
  );
  if (cleaned.length === 0) return clone;

  cleaned.forEach((s) => {
    if (next === "area") {
      s.type = "line";
      s.areaStyle = {};
    } else {
      s.type = next;
      delete s.areaStyle;
    }
  });
  clone.series = cleaned;
  return clone;
}
