import { formatPivotLabel, PIVOT_KEY_SEP, type PivotGridResult } from "@/lib/pivot-engine";
import type { PivotVizType, WidgetAppearance } from "@/types/analytics-pivot";
import { parseSafeHexColor } from "@/lib/widget-appearance-utils";

const DEFAULT_ECHARTS_COLORS = ["#5470c6", "#91cc75", "#fac858", "#ee6666", "#73c0de", "#3ba272", "#fc8452", "#9a60b4"];

function mergeAxisSplitLine(axis: unknown, showGrid: boolean): unknown {
  if (Array.isArray(axis)) {
    return axis.map((a) =>
      a && typeof a === "object" ? { ...(a as object), splitLine: { show: showGrid } } : a,
    );
  }
  if (axis && typeof axis === "object") return { ...(axis as object), splitLine: { show: showGrid } };
  return axis;
}

/** Aplica colores, leyenda y rejilla sobre una option de ECharts ya construida. */
export function mergeChartAppearance(
  option: Record<string, unknown>,
  appearance?: WidgetAppearance | null,
): Record<string, unknown> {
  if (!appearance) return option;
  const next: Record<string, unknown> = { ...option };

  const chartBg = parseSafeHexColor(appearance.backgroundColor);
  if (chartBg) {
    next.backgroundColor = chartBg;
  }

  const palette =
    appearance.accentPalette && appearance.accentPalette.length > 0
      ? appearance.accentPalette
      : appearance.primaryColor
        ? [appearance.primaryColor, ...DEFAULT_ECHARTS_COLORS.slice(1)]
        : null;
  if (palette) next.color = palette;

  if (appearance.showLegend === false) {
    next.legend = { show: false };
  } else if (appearance.showLegend === true && next.legend === undefined) {
    next.legend = { type: "scroll", bottom: 0 };
  }

  if (appearance.showGridLines === false) {
    next.xAxis = mergeAxisSplitLine(next.xAxis, false);
    next.yAxis = mergeAxisSplitLine(next.yAxis, false);
  } else if (appearance.showGridLines === true) {
    next.xAxis = mergeAxisSplitLine(next.xAxis, true);
    next.yAxis = mergeAxisSplitLine(next.yAxis, true);
  }

  if (appearance.primaryColor && vizUsesSingleSeriesColor(next)) {
    const series = next.series;
    if (Array.isArray(series) && series[0] && typeof series[0] === "object") {
      const s0 = { ...(series[0] as object) };
      (s0 as { itemStyle?: object }).itemStyle = {
        ...((s0 as { itemStyle?: object }).itemStyle ?? {}),
        color: appearance.primaryColor,
      };
      next.series = [s0, ...series.slice(1)];
    }
  }

  if (appearance.primaryColor && next.visualMap && typeof next.visualMap === "object") {
    next.visualMap = {
      ...(next.visualMap as object),
      inRange: { color: [appearance.secondaryColor ?? "#e0f2fe", appearance.primaryColor] },
    };
  }

  return next;
}

function vizUsesSingleSeriesColor(opt: Record<string, unknown>): boolean {
  const s = opt.series;
  if (!Array.isArray(s) || !s[0]) return false;
  const t = (s[0] as { type?: string }).type;
  return t === "gauge";
}

function parseKey(k: string): string[] {
  return k.split(PIVOT_KEY_SEP);
}

/** Suma de todas las celdas visibles para una medida (KPI / gauge). */
export function grandTotalMeasure(grid: PivotGridResult, measureId: string): number {
  let t = 0;
  for (const colMap of grid.cells.values()) {
    for (const cell of colMap.values()) {
      t += cell.get(measureId) ?? 0;
    }
  }
  return t;
}

export function firstCellValue(grid: PivotGridResult, measureId: string): number {
  const rk = grid.rowKeys[0];
  const ck = grid.colKeys[0];
  if (rk == null || ck == null) return 0;
  return grid.cells.get(rk)?.get(ck)?.get(measureId) ?? 0;
}

/** Visualizaciones que no usan option ECharts estándar (tarjetas HTML). */
export function isCustomCardViz(viz: PivotVizType): boolean {
  return viz === "card" || viz === "card_ring";
}

export function buildPivotChartOption(
  viz: PivotVizType,
  measureId: string,
  grid: PivotGridResult,
  appearance?: WidgetAppearance | null,
): Record<string, unknown> | null {
  const { rowKeys, colKeys, cells, rowLabels, colLabels } = grid;
  if (!rowKeys.length) return null;

  const categories = rowKeys.map((rk) => formatPivotLabel(rowLabels.get(rk) ?? parseKey(rk)));

  if (viz === "card" || viz === "card_ring") return null;

  let base: Record<string, unknown> | null = null;

  if (viz === "pie") {
    const data = rowKeys.map((rk) => ({
      name: formatPivotLabel(rowLabels.get(rk) ?? parseKey(rk)),
      value: cells.get(rk)?.get(colKeys[0] ?? "")?.get(measureId) ?? 0,
    }));
    base = {
      tooltip: { trigger: "item" },
      series: [{ type: "pie", radius: "65%", data, emphasis: { itemStyle: { shadowBlur: 10 } } }],
    };
  } else if (viz === "donut") {
    const data = rowKeys.map((rk) => ({
      name: formatPivotLabel(rowLabels.get(rk) ?? parseKey(rk)),
      value: cells.get(rk)?.get(colKeys[0] ?? "")?.get(measureId) ?? 0,
    }));
    base = {
      tooltip: { trigger: "item" },
      series: [{ type: "pie", radius: ["45%", "70%"], data }],
    };
  } else if (viz === "funnel") {
    const data = rowKeys
      .map((rk) => ({
        name: formatPivotLabel(rowLabels.get(rk) ?? parseKey(rk)),
        value: cells.get(rk)?.get(colKeys[0] ?? "")?.get(measureId) ?? 0,
      }))
      .sort((a, b) => b.value - a.value);
    base = {
      tooltip: { trigger: "item" },
      series: [{ type: "funnel", left: "10%", width: "80%", data }],
    };
  } else if (viz === "gauge") {
    const v = grandTotalMeasure(grid, measureId);
    const max = Math.max(v * 1.2, 1);
    base = {
      series: [
        {
          type: "gauge",
          progress: { show: true },
          detail: { valueAnimation: true, formatter: "{value}" },
          data: [{ value: Math.round(v * 100) / 100, name: "Total" }],
          min: 0,
          max,
        },
      ],
    };
  } else if (viz === "scatter") {
    const data = rowKeys.map((rk, i) => {
      const y = cells.get(rk)?.get(colKeys[0] ?? "")?.get(measureId) ?? 0;
      return [i, y] as [number, number];
    });
    base = {
      tooltip: { trigger: "item" },
      xAxis: { type: "value", name: "Índice" },
      yAxis: { type: "value" },
      series: [{ type: "scatter", data, symbolSize: 10 }],
    };
  } else if (viz === "radar") {
    const indicators = rowKeys.map((rk) => ({
      name: formatPivotLabel(rowLabels.get(rk) ?? parseKey(rk)).slice(0, 20),
      max: Math.max(
        ...colKeys.map((ck) => cells.get(rk)?.get(ck)?.get(measureId) ?? 0),
        1,
      ),
    }));
    const seriesData = colKeys.map((ck) => ({
      name: formatPivotLabel(colLabels.get(ck) ?? parseKey(ck)),
      value: rowKeys.map((rk) => cells.get(rk)?.get(ck)?.get(measureId) ?? 0),
    }));
    base = {
      tooltip: {},
      radar: { indicator: indicators },
      series: [{ type: "radar", data: seriesData }],
    };
  } else if (viz === "heatmap") {
    const heatData: [number, number, number][] = [];
    rowKeys.forEach((rk, i) => {
      colKeys.forEach((ck, j) => {
        heatData.push([j, i, cells.get(rk)?.get(ck)?.get(measureId) ?? 0]);
      });
    });
    const xLabs = colKeys.map((ck) => formatPivotLabel(colLabels.get(ck) ?? parseKey(ck)));
    const yLabs = rowKeys.map((rk) => formatPivotLabel(rowLabels.get(rk) ?? parseKey(rk)));
    base = {
      tooltip: { position: "top" },
      grid: { height: "58%", top: "12%" },
      xAxis: { type: "category", data: xLabs, splitArea: { show: true } },
      yAxis: { type: "category", data: yLabs, splitArea: { show: true } },
      visualMap: {
        min: 0,
        max: Math.max(...heatData.map((d) => d[2]), 1),
        calculable: true,
        orient: "horizontal",
        left: "center",
        bottom: "2%",
      },
      series: [{ type: "heatmap", data: heatData, label: { show: false }, emphasis: { itemStyle: { shadowBlur: 10 } } }],
    };
  } else if (viz === "bar_horizontal") {
    const series = colKeys.map((ck) => ({
      name: formatPivotLabel(colLabels.get(ck) ?? parseKey(ck)),
      type: "bar",
      data: rowKeys.map((rk) => cells.get(rk)?.get(ck)?.get(measureId) ?? 0),
    }));
    base = {
      tooltip: { trigger: "axis" },
      legend: { type: "scroll", bottom: 0 },
      grid: { left: "3%", right: "4%", bottom: "15%", containLabel: true },
      xAxis: { type: "value" },
      yAxis: { type: "category", data: categories },
      series,
    };
  } else if (viz === "mixed_line_bar") {
    if (colKeys.length < 2) {
      const series = colKeys.map((ck) => ({
        name: formatPivotLabel(colLabels.get(ck) ?? parseKey(ck)),
        type: "bar",
        data: rowKeys.map((rk) => cells.get(rk)?.get(ck)?.get(measureId) ?? 0),
      }));
      base = {
        tooltip: { trigger: "axis" },
        legend: { bottom: 0 },
        xAxis: { type: "category", data: categories },
        yAxis: { type: "value" },
        series,
      };
    } else {
      const ck0 = colKeys[0];
      const ck1 = colKeys[1];
      base = {
        tooltip: { trigger: "axis" },
        legend: { bottom: 0 },
        xAxis: { type: "category", data: categories },
        yAxis: [{ type: "value" }, { type: "value" }],
        series: [
          {
            name: formatPivotLabel(colLabels.get(ck0) ?? parseKey(ck0)),
            type: "bar",
            data: rowKeys.map((rk) => cells.get(rk)?.get(ck0)?.get(measureId) ?? 0),
          },
          {
            name: formatPivotLabel(colLabels.get(ck1) ?? parseKey(ck1)),
            type: "line",
            yAxisIndex: 1,
            smooth: true,
            data: rowKeys.map((rk) => cells.get(rk)?.get(ck1)?.get(measureId) ?? 0),
          },
        ],
      };
    }
  } else if (viz === "treemap") {
    const data = rowKeys.map((rk) => ({
      name: formatPivotLabel(rowLabels.get(rk) ?? parseKey(rk)),
      value: cells.get(rk)?.get(colKeys[0] ?? "")?.get(measureId) ?? 0,
    }));
    base = {
      tooltip: { trigger: "item" },
      series: [{ type: "treemap", data, levels: [{ itemStyle: { borderColor: "#fff", borderWidth: 1, gapWidth: 1 } }] }],
    };
  } else if (viz === "sunburst") {
    const data = rowKeys.map((rk) => ({
      name: formatPivotLabel(rowLabels.get(rk) ?? parseKey(rk)),
      value: cells.get(rk)?.get(colKeys[0] ?? "")?.get(measureId) ?? 0,
    }));
    base = {
      tooltip: { trigger: "item" },
      series: [{ type: "sunburst", data, radius: [0, "90%"], label: { rotate: "radial" } }],
    };
  } else if (viz === "waterfall") {
    const data = rowKeys.map((rk) => cells.get(rk)?.get(colKeys[0] ?? "")?.get(measureId) ?? 0);
    const help: number[] = [];
    const positive: number[] = [];
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      help.push(sum);
      positive.push(data[i]);
      sum += data[i];
    }
    base = {
      tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
      xAxis: { type: "category", data: categories },
      yAxis: { type: "value" },
      series: [
        { name: "Placeholder", type: "bar", stack: "all", itemStyle: { borderColor: "transparent", color: "transparent" }, emphasis: { itemStyle: { borderColor: "transparent", color: "transparent" } }, data: help },
        { name: "Valor", type: "bar", stack: "all", label: { show: true, position: "top" }, data: positive },
      ],
    };
  } else if (viz === "ranking_horizontal" || viz === "ranking_vertical") {
    const isHorizontal = viz === "ranking_horizontal";
    const data = rowKeys
      .map((rk) => ({
        rk,
        name: formatPivotLabel(rowLabels.get(rk) ?? parseKey(rk)),
        value: cells.get(rk)?.get(colKeys[0] ?? "")?.get(measureId) ?? 0,
      }))
      .sort((a, b) => b.value - a.value);

    base = {
      tooltip: { trigger: "axis" },
      grid: { left: "3%", right: "4%", bottom: "3%", containLabel: true },
      xAxis: isHorizontal ? { type: "value" } : { type: "category", data: data.map((d) => d.name) },
      yAxis: isHorizontal ? { type: "category", data: data.map((d) => d.name).reverse() } : { type: "value" },
      series: [
        {
          type: "bar",
          data: isHorizontal ? data.map((d) => d.value).reverse() : data.map((d) => d.value),
          label: { show: true, position: isHorizontal ? "right" : "top" },
        },
      ],
    };
  } else {
    const stacked = viz === "bar_stacked" || viz === "area" || viz === "area_stacked" || viz === "bar_100_stacked" || viz === "column_100_stacked";
    const is100 = viz === "bar_100_stacked" || viz === "column_100_stacked";
    
    const series = colKeys.map((ck) => ({
      name: formatPivotLabel(colLabels.get(ck) ?? parseKey(ck)),
      type: (viz.includes("bar") || viz.includes("column")) ? "bar" : "line",
      stack: stacked ? "total" : undefined,
      areaStyle: (viz === "area" || viz === "area_stacked") ? {} : undefined,
      smooth: viz === "line" || viz.includes("area"),
      data: rowKeys.map((rk) => {
        const val = cells.get(rk)?.get(ck)?.get(measureId) ?? 0;
        if (!is100) return val;
        let total = 0;
        colKeys.forEach(ck2 => total += (cells.get(rk)?.get(ck2)?.get(measureId) ?? 0));
        return total > 0 ? (val / total) * 100 : 0;
      }),
    }));

    base = {
      tooltip: { trigger: "axis", formatter: is100 ? (params: any[]) => {
        let res = params[0].name + "<br/>";
        params.forEach(p => {
          res += `${p.marker} ${p.seriesName}: ${p.value.toFixed(1)}%<br/>`;
        });
        return res;
      } : undefined },
      legend: { type: "scroll", bottom: 0 },
      xAxis: viz.includes("horizontal") ? { type: "value", max: is100 ? 100 : undefined } : {
        type: "category",
        data: categories,
        axisLabel: { rotate: categories.some((c) => c.length > 12) ? 35 : 0 },
      },
      yAxis: viz.includes("horizontal") ? { type: "category", data: categories } : { type: "value", max: is100 ? 100 : undefined },
      series,
    };
  }

  return base ? mergeChartAppearance(base, appearance) : null;
}
