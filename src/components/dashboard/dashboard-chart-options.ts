import type { EChartsOption } from "echarts";
import { EXEC, type TimeViz, type CatViz } from "./dashboard-chart-theme";
import type { DailyPoint, NamedCount, WeeklyPoint, ComparisonMetric, LeadVentasStats } from "@/lib/dashboard-leads-analytics";

function dailyValuesForMetric(daily: DailyPoint[], metric: ComparisonMetric): number[] {
  return daily.map((d) =>
    metric === "leads"
      ? d.leads
      : metric === "ventas"
        ? d.ventas
        : d.leads > 0
          ? (d.ventas / d.leads) * 100
          : 0,
  );
}

const SERIE_LABEL: Record<ComparisonMetric, string> = {
  leads: "Leads",
  ventas: "Ventas",
  efectividad: "Efectividad %",
};

function baseTooltip(): EChartsOption["tooltip"] {
  return {
    trigger: "axis",
    backgroundColor: EXEC.tooltipBg,
    borderColor: EXEC.tooltipBorder,
    borderWidth: 1,
    padding: [10, 14],
    textStyle: { color: EXEC.tooltipText, fontSize: 12, fontFamily: "inherit" },
    extraCssText: "box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1); border-radius: 12px; backdrop-filter: blur(8px);",
  };
}

function itemTooltip(): EChartsOption["tooltip"] {
  return {
    trigger: "item",
    backgroundColor: EXEC.tooltipBg,
    borderColor: EXEC.tooltipBorder,
    borderWidth: 1,
    padding: [10, 14],
    textStyle: { color: EXEC.tooltipText, fontSize: 12, fontFamily: "inherit" },
    extraCssText: "box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1); border-radius: 12px; backdrop-filter: blur(8px);",
  };
}

export type ChartType = "line" | "bar" | "area" | "combo";

export function dynamicTimeSeriesOption(
  data: { 
    date: string; 
    leads: number; 
    ventas: number; 
    contactados?: number; 
    gestionados?: number;
    prev_leads?: number;
    prev_ventas?: number;
  }[],
  type: ChartType,
  title: string
): EChartsOption {
  const cats = data.map((d) => d.date.slice(5));
  const leads = data.map((d) => d.leads);
  const ventas = data.map((d) => d.ventas);
  const prevLeads = data.map((d) => d.prev_leads ?? 0);
  const prevVentas = data.map((d) => d.prev_ventas ?? 0);
  
  const hasComparison = data.some(d => d.prev_leads !== undefined);

  const series: EChartsOption["series"] = [];

  const getStyle = (name: string, chartType: ChartType, isPrev: boolean = false) => {
    const baseColor = name.includes("Leads") ? EXEC.teal : name.includes("Ventas") ? EXEC.violet : EXEC.amber;
    const color = isPrev ? "#94a3b8" : baseColor; // Slate-400 for comparison
    
    if (chartType === "bar") {
      return {
        type: "bar",
        itemStyle: { 
          color: isPrev ? "#cbd5e1" : color, // Slate-300 for prev bars
          borderRadius: [4, 4, 0, 0],
          opacity: isPrev ? 0.4 : 1
        },
        barMaxWidth: 16
      };
    }
    
    return {
      type: "line",
      smooth: true,
      lineStyle: { 
        color, 
        width: isPrev ? 1.5 : 2,
        type: isPrev ? "dashed" : "solid" 
      },
      itemStyle: { color },
      symbol: isPrev ? "none" : "circle",
      symbolSize: 4,
      areaStyle: chartType === "area" ? { 
        color: isPrev ? "transparent" : (name.includes("Leads") ? EXEC.tealDim : EXEC.violetDim) 
      } : undefined
    };
  };

  if (type === "combo") {
    // Current
    series.push({
      name: "Leads",
      type: "bar",
      data: leads,
      itemStyle: { color: EXEC.tealDim, borderRadius: [4, 4, 0, 0] },
      barMaxWidth: 20,
    });
    series.push({
      name: "Ventas",
      type: "line",
      smooth: true,
      data: ventas,
      lineStyle: { width: 2, color: EXEC.violet },
      itemStyle: { color: EXEC.violet },
      symbol: "circle",
      symbolSize: 6,
    });
    
    // Previous (dashed)
    if (hasComparison) {
      series.push({
        name: "Leads (Ant.)",
        type: "line",
        smooth: true,
        data: prevLeads,
        lineStyle: { width: 1, type: "dashed", color: "#94a3b8" },
        itemStyle: { color: "#94a3b8" },
        symbol: "none",
      });
      series.push({
        name: "Ventas (Ant.)",
        type: "line",
        smooth: true,
        data: prevVentas,
        lineStyle: { width: 1, type: "dashed", color: "#cbd5e1" },
        itemStyle: { color: "#cbd5e1" },
        symbol: "none",
      });
    }
  } else {
    series.push({ name: "Leads", ...getStyle("Leads", type), data: leads } as any);
    series.push({ name: "Ventas", ...getStyle("Ventas", type), data: ventas } as any);
    
    if (hasComparison) {
      series.push({ name: "Leads (Ant.)", ...getStyle("Leads", type, true), data: prevLeads } as any);
      series.push({ name: "Ventas (Ant.)", ...getStyle("Ventas", type, true), data: prevVentas } as any);
    }
  }

  return {
    backgroundColor: "transparent",
    title: {
      text: title,
      left: 0,
      top: 0,
      textStyle: { color: EXEC.text, fontSize: 13, fontWeight: 600 },
    },
    legend: {
      show: true,
      top: 0,
      right: 8,
      textStyle: { color: EXEC.textMuted, fontSize: 10 },
    },
    grid: { ...EXEC.grid, top: 40 },
    xAxis: {
      type: "category",
      data: cats,
      axisLine: { lineStyle: { color: EXEC.axis } },
      axisLabel: { color: EXEC.textMuted, fontSize: 9, rotate: cats.length > 20 ? 35 : 0 },
    },
    yAxis: {
      type: "value",
      minInterval: 1,
      splitLine: { lineStyle: { color: EXEC.split, type: "dashed" } },
      axisLabel: { color: EXEC.textMuted, fontSize: 10 },
    },
    tooltip: baseTooltip(),
    series,
  };
}

export function weeklyBarsOption(
  weekly: WeeklyPoint[],
  mode: TimeViz,
  opts?: { compareLine?: { name: string; data: number[] } },
): EChartsOption {
  const cats = weekly.map((w) => w.label);
  const leads = weekly.map((w) => w.leads);
  const ventas = weekly.map((w) => w.ventas);

  const series: EChartsOption["series"] = [];
  if (mode === "combo") {
    series.push({
      name: "Leads",
      type: "bar",
      data: leads,
      itemStyle: { color: EXEC.tealDim, borderRadius: [4, 4, 0, 0] },
      barMaxWidth: 20,
    });
    series.push({
      name: "Ventas",
      type: "line",
      smooth: true,
      data: ventas,
      lineStyle: { width: 2, color: EXEC.violet },
      itemStyle: { color: EXEC.violet },
    });
  } else if (mode === "bar") {
    series.push({
      name: "Leads",
      type: "bar",
      data: leads,
      itemStyle: { color: EXEC.teal, borderRadius: [4, 4, 0, 0] },
      barMaxWidth: 22,
    });
  } else if (mode === "area") {
    series.push({
      name: "Leads",
      type: "line",
      smooth: true,
      areaStyle: { color: EXEC.tealDim },
      lineStyle: { color: EXEC.teal, width: 2 },
      data: leads,
      symbol: "none",
    });
  } else {
    series.push({
      name: "Leads",
      type: "line",
      smooth: true,
      data: leads,
      lineStyle: { color: EXEC.teal, width: 2 },
      symbol: "circle",
      symbolSize: 5,
    });
  }

  const cmp = opts?.compareLine;
  const cmpOk = cmp && cmp.data.length === weekly.length;
  if (cmpOk) {
    series.push({
      name: cmp!.name,
      type: "line",
      smooth: true,
      data: cmp!.data,
      lineStyle: { width: 2, type: "dashed", color: EXEC.amber },
      symbol: "circle",
      symbolSize: 5,
      z: 10,
    });
  }

  return {
    backgroundColor: "transparent",
    title: {
      text: "Serie semanal (ISO)",
      left: 0,
      top: 4,
      textStyle: { color: EXEC.text, fontSize: 13, fontWeight: 600 },
    },
    legend: {
      show: mode === "combo" || cmpOk,
      top: 4,
      right: 8,
      textStyle: { color: EXEC.textMuted, fontSize: 10 },
    },
    grid: EXEC.grid,
    xAxis: {
      type: "category",
      data: cats,
      axisLine: { lineStyle: { color: EXEC.axis } },
      axisLabel: { color: EXEC.textMuted, fontSize: 9, rotate: 28 },
    },
    yAxis: {
      type: "value",
      splitLine: { lineStyle: { color: EXEC.split, type: "dashed" } },
      axisLabel: { color: EXEC.textMuted, fontSize: 10 },
    },
    tooltip: baseTooltip(),
    series,
  };
}

export type DateVsDateChartConfig = {
  /** Título secundario bajo el título principal */
  subtitle: string;
  /** Leyenda serie actual */
  actualName?: string;
  /** Leyenda serie de comparación */
  comparisonName?: string;
  /** Si la métrica es porcentaje (eje Y) */
  yPercent?: boolean;
};

export type ComparisonViz = "line" | "area" | "bar";

export function comparisonDualSeriesOption(
  points: { label: string; actual: number; anterior: number }[],
  title: string,
  cfg: DateVsDateChartConfig & { viz: ComparisonViz },
): EChartsOption {
  const actual = points.map((p) => p.actual);
  const anterior = points.map((p) => p.anterior);
  const cats = points.map((p) => p.label);
  const aName = cfg.actualName ?? "Periodo actual";
  const cName = cfg.comparisonName ?? "Comparación";

  const series: EChartsOption["series"] =
    cfg.viz === "bar"
      ? [
          {
            name: aName,
            type: "bar",
            data: actual,
            itemStyle: { color: EXEC.teal, borderRadius: [4, 4, 0, 0] },
            barMaxWidth: 16,
            barGap: "12%",
          },
          {
            name: cName,
            type: "bar",
            data: anterior,
            itemStyle: { color: EXEC.violetDim, borderRadius: [4, 4, 0, 0] },
            barMaxWidth: 16,
          },
        ]
      : [
          {
            name: aName,
            type: "line",
            smooth: true,
            data: actual,
            lineStyle: { width: 2, color: EXEC.teal },
            areaStyle: cfg.viz === "area" ? { color: EXEC.tealDim } : undefined,
            symbol: cfg.viz === "line" ? "circle" : "none",
            symbolSize: cfg.viz === "line" ? 5 : 0,
          },
          {
            name: cName,
            type: "line",
            smooth: true,
            data: anterior,
            lineStyle: { width: 2, type: "dashed", color: EXEC.violet },
            itemStyle: { color: EXEC.violet },
            symbol: "circle",
            symbolSize: 4,
          },
        ];

  return {
    backgroundColor: "transparent",
    grid: { ...EXEC.grid, top: 56 },
    title: {
      text: title,
      subtext: cfg.subtitle,
      left: 0,
      top: 0,
      textStyle: { color: EXEC.text, fontSize: 13, fontWeight: 600 },
      subtextStyle: { color: EXEC.textMuted, fontSize: 10 },
    },
    legend: { top: 32, right: 8, textStyle: { color: EXEC.textMuted, fontSize: 10 } },
    tooltip: baseTooltip(),
    xAxis: {
      type: "category",
      data: cats,
      axisLine: { lineStyle: { color: EXEC.axis } },
      axisLabel: { color: EXEC.textMuted, fontSize: 8, rotate: 40 },
    },
    yAxis: {
      type: "value",
      splitLine: { lineStyle: { color: EXEC.split, type: "dashed" } },
      axisLabel: {
        color: EXEC.textMuted,
        fontSize: 10,
        formatter: cfg.yPercent ? (v: number) => `${v}%` : undefined,
      },
    },
    series,
  };
}

export function dateVsDateOption(
  points: { label: string; actual: number; anterior: number }[],
  title: string,
  cfg: DateVsDateChartConfig,
): EChartsOption {
  return comparisonDualSeriesOption(points, title, { ...cfg, viz: "area" });
}

/** Una métrica por semana ISO + línea de comparación opcional (p. ej. semana anterior). */
export function weeklyScalarBarsOption(
  rows: { label: string; value: number }[],
  title: string,
  opts?: { compareLine?: { name: string; data: number[] }; yPercent?: boolean; viz?: "bar" | "line" | "area" },
): EChartsOption {
  const viz = opts?.viz ?? "bar";
  const cats = rows.map((r) => r.label);
  const vals = rows.map((r) => r.value);
  const cmp = opts?.compareLine;
  const cmpOk = cmp && cmp.data.length === rows.length;

  const series: EChartsOption["series"] = [];
  if (viz === "bar") {
    series.push({
      name: "Valor",
      type: "bar",
      data: vals,
      itemStyle: { color: EXEC.teal, borderRadius: [4, 4, 0, 0] },
      barMaxWidth: 22,
    });
  } else if (viz === "area") {
    series.push({
      name: "Valor",
      type: "line",
      smooth: true,
      data: vals,
      areaStyle: { color: EXEC.tealDim },
      lineStyle: { color: EXEC.teal, width: 2 },
      symbol: "none",
    });
  } else {
    series.push({
      name: "Valor",
      type: "line",
      smooth: true,
      data: vals,
      lineStyle: { color: EXEC.teal, width: 2 },
      symbol: "circle",
      symbolSize: 5,
    });
  }

  if (cmpOk) {
    series.push({
      name: cmp!.name,
      type: "line",
      smooth: true,
      data: cmp!.data,
      lineStyle: { width: 2, type: "dashed", color: EXEC.amber },
      symbol: "circle",
      symbolSize: 5,
      z: 10,
    });
  }

  return {
    backgroundColor: "transparent",
    title: {
      text: title,
      left: 0,
      top: 4,
      textStyle: { color: EXEC.text, fontSize: 13, fontWeight: 600 },
    },
    legend: {
      show: cmpOk,
      top: 28,
      right: 8,
      textStyle: { color: EXEC.textMuted, fontSize: 10 },
    },
    grid: { ...EXEC.grid, top: cmpOk ? 52 : 40 },
    tooltip: baseTooltip(),
    xAxis: {
      type: "category",
      data: cats,
      axisLine: { lineStyle: { color: EXEC.axis } },
      axisLabel: { color: EXEC.textMuted, fontSize: 9, rotate: 28 },
    },
    yAxis: {
      type: "value",
      splitLine: { lineStyle: { color: EXEC.split, type: "dashed" } },
      axisLabel: {
        color: EXEC.textMuted,
        fontSize: 10,
        formatter: opts?.yPercent ? (v: number) => `${v}%` : undefined,
      },
    },
    series,
  };
}

/** Serie temporal escalar (categorías MM-DD). */
export function scalarTimeSeriesOption(
  points: { date: string; value: number }[],
  title: string,
  opts?: {
    viz?: "line" | "area" | "bar";
    overlayLine?: { name: string; data: number[] };
    yPercent?: boolean;
  },
): EChartsOption {
  const viz = opts?.viz ?? "line";
  const cats = points.map((p) => p.date.slice(5));
  const vals = points.map((p) => p.value);
  const overlay = opts?.overlayLine;
  const overlayOk = overlay && overlay.data.length === points.length;

  const series: EChartsOption["series"] = [];
  if (viz === "bar") {
    series.push({
      name: "Serie",
      type: "bar",
      data: vals,
      itemStyle: { color: EXEC.teal, borderRadius: [4, 4, 0, 0] },
      barMaxWidth: 20,
    });
  } else if (viz === "area") {
    series.push({
      name: "Serie",
      type: "line",
      smooth: true,
      data: vals,
      areaStyle: { color: EXEC.tealDim },
      lineStyle: { color: EXEC.teal, width: 2 },
      symbol: "none",
    });
  } else {
    series.push({
      name: "Serie",
      type: "line",
      smooth: true,
      data: vals,
      lineStyle: { color: EXEC.teal, width: 2 },
      symbol: "circle",
      symbolSize: 4,
    });
  }

  if (overlayOk) {
    series.push({
      name: overlay!.name,
      type: "line",
      smooth: true,
      data: overlay!.data,
      lineStyle: { width: 2, type: "dashed", color: EXEC.amber },
      symbol: "circle",
      symbolSize: 4,
      z: 10,
    });
  }

  return {
    backgroundColor: "transparent",
    title: {
      text: title,
      left: 0,
      top: 4,
      textStyle: { color: EXEC.text, fontSize: 13, fontWeight: 600 },
    },
    legend: { show: overlayOk, top: 28, right: 8, textStyle: { color: EXEC.textMuted, fontSize: 10 } },
    grid: { ...EXEC.grid, top: overlayOk ? 52 : 40 },
    tooltip: baseTooltip(),
    xAxis: {
      type: "category",
      data: cats,
      axisLine: { lineStyle: { color: EXEC.axis } },
      axisLabel: { color: EXEC.textMuted, fontSize: 9, rotate: cats.length > 24 ? 35 : 0 },
    },
    yAxis: {
      type: "value",
      splitLine: { lineStyle: { color: EXEC.split, type: "dashed" } },
      axisLabel: {
        color: EXEC.textMuted,
        fontSize: 10,
        formatter: opts?.yPercent ? (v: number) => `${v}%` : undefined,
      },
    },
    series,
  };
}

export function categoryOption(data: NamedCount[], mode: CatViz, title: string): EChartsOption {
  const top = data.slice(0, 12);
  const names = top.map((d) => d.name);
  const vals = top.map((d) => d.value);
  let effective: CatViz = mode;
  if (effective === "radar" && top.length < 3) effective = "bar";

  if (effective === "donut") {
    return {
      backgroundColor: "transparent",
      title: {
        text: title,
        left: 0,
        top: 4,
        textStyle: { color: EXEC.text, fontSize: 13, fontWeight: 600 },
      },
      tooltip: itemTooltip(),
      legend: {
        type: "scroll",
        bottom: 0,
        textStyle: { color: EXEC.textMuted, fontSize: 9 },
      },
      series: [
        {
          type: "pie",
          radius: ["42%", "68%"],
          center: ["50%", "48%"],
          data: top.map((d, i) => ({
            name: d.name,
            value: d.value,
            itemStyle: {
              color: i % 2 === 0 ? EXEC.teal : EXEC.violet,
              opacity: 0.85 - (i % 5) * 0.06,
            },
          })),
          label: {
            color: EXEC.textMuted,
            fontSize: 9,
            formatter: (p: { name?: string; percent?: number }) => {
              const name = p.name ?? "";
              const n = name.length > 16 ? `${name.slice(0, 14)}…` : name;
              return `${n}\n${p.percent ?? 0}%`;
            },
          },
        },
      ],
    };
  }

  if (effective === "radar" && top.length >= 3) {
    const max = Math.max(...vals, 1);
    return {
      backgroundColor: "transparent",
      title: {
        text: title,
        left: 0,
        top: 4,
        textStyle: { color: EXEC.text, fontSize: 13, fontWeight: 600 },
      },
      radar: {
        indicator: top.map((d) => ({
          name: d.name.length > 10 ? `${d.name.slice(0, 8)}…` : d.name,
          max: max * 1.1,
        })),
        splitLine: { lineStyle: { color: EXEC.split } },
        splitArea: { show: false },
        axisName: { color: EXEC.textMuted, fontSize: 9 },
      },
      series: [
        {
          type: "radar",
          data: [{ value: vals, name: "Leads", areaStyle: { color: EXEC.tealDim }, lineStyle: { color: EXEC.teal } }],
        },
      ],
    };
  }

  if (effective === "bar_h") {
    return {
      backgroundColor: "transparent",
      title: {
        text: title,
        left: 0,
        top: 4,
        textStyle: { color: EXEC.text, fontSize: 13, fontWeight: 600 },
      },
      grid: { left: 8, right: 48, top: 48, bottom: 8, containLabel: true },
      xAxis: {
        type: "value",
        splitLine: { lineStyle: { color: EXEC.split, type: "dashed" } },
        axisLabel: { color: EXEC.textMuted, fontSize: 10 },
      },
      yAxis: {
        type: "category",
        data: names,
        axisLine: { lineStyle: { color: EXEC.axis } },
        axisLabel: {
          color: EXEC.textMuted,
          fontSize: 9,
          formatter: (v: string) => (v.length > 22 ? `${v.slice(0, 20)}…` : v),
        },
      },
      tooltip: { ...baseTooltip(), axisPointer: { type: "shadow" } },
      series: [
        {
          type: "bar",
          data: vals,
          itemStyle: {
            color: {
              type: "linear",
              x: 0,
              y: 0,
              x2: 1,
              y2: 0,
              colorStops: [
                { offset: 0, color: EXEC.teal },
                { offset: 1, color: EXEC.violet },
              ],
            },
            borderRadius: [0, 4, 4, 0],
          },
        },
      ],
    };
  }

  return {
    backgroundColor: "transparent",
    title: {
      text: title,
      left: 0,
      top: 4,
      textStyle: { color: EXEC.text, fontSize: 13, fontWeight: 600 },
    },
    grid: EXEC.grid,
    xAxis: {
      type: "category",
      data: names,
      axisLabel: {
        color: EXEC.textMuted,
        fontSize: 9,
        rotate: 28,
        formatter: (v: string) => (v.length > 12 ? `${v.slice(0, 10)}…` : v),
      },
      axisLine: { lineStyle: { color: EXEC.axis } },
    },
    yAxis: {
      type: "value",
      splitLine: { lineStyle: { color: EXEC.split, type: "dashed" } },
      axisLabel: { color: EXEC.textMuted, fontSize: 10 },
    },
    tooltip: baseTooltip(),
    series: [
      {
        type: "bar",
        data: vals,
        itemStyle: { color: EXEC.teal, borderRadius: [4, 4, 0, 0] },
        barMaxWidth: 28,
      },
    ],
  };
}

export function statsByWeekdayOption(data: (LeadVentasStats & { day: string })[]): EChartsOption {
  const cats = data.map((d) => d.day);
  const leads = data.map((d) => d.leads);
  const ventas = data.map((d) => d.ventas);
  const eff = data.map((d) => Math.round(d.efectividad * 10) / 10);

  return {
    backgroundColor: "transparent",
    grid: EXEC.grid,
    legend: {
      show: true,
      top: 4,
      right: 8,
      textStyle: { color: EXEC.textMuted, fontSize: 10 },
    },
    tooltip: {
      ...baseTooltip(),
      formatter: (params: any) => {
        let res = `<div style="font-weight:600;margin-bottom:4px;">${params[0].axisValue}</div>`;
        params.forEach((p: any) => {
          const val = p.seriesName === "Efectividad" ? `${p.value}%` : p.value.toLocaleString();
          res += `<div style="display:flex;justify-content:space-between;gap:12px;font-size:11px;">
            <span style="display:flex;items-center;gap:4px;">
              <span style="width:8px;height:8px;border-radius:50%;background:${p.color};margin-top:4px;"></span>
              ${p.seriesName}
            </span>
            <span style="font-weight:600;">${val}</span>
          </div>`;
        });
        return res;
      },
    },
    xAxis: {
      type: "category",
      data: cats,
      axisLine: { lineStyle: { color: EXEC.axis } },
      axisLabel: { color: EXEC.textMuted, fontSize: 10 },
    },
    yAxis: [
      {
        type: "value",
        name: "Volumen",
        splitLine: { lineStyle: { color: EXEC.split, type: "dashed" } },
        axisLabel: { color: EXEC.textMuted, fontSize: 10 },
      },
      {
        type: "value",
        name: "Ef.",
        position: "right",
        splitLine: { show: false },
        axisLabel: { color: EXEC.textMuted, fontSize: 10, formatter: "{value}%" },
      },
    ],
    series: [
      {
        name: "Leads",
        type: "bar",
        data: leads,
        itemStyle: { color: EXEC.tealDim, borderRadius: [4, 4, 0, 0] },
        barMaxWidth: 20,
      },
      {
        name: "Ventas",
        type: "bar",
        data: ventas,
        itemStyle: { color: EXEC.violet, borderRadius: [4, 4, 0, 0] },
        barMaxWidth: 20,
        barGap: "-100%",
      },
      {
        name: "Efectividad",
        type: "line",
        yAxisIndex: 1,
        smooth: true,
        data: eff,
        lineStyle: { width: 2, color: EXEC.amber },
        itemStyle: { color: EXEC.amber },
        symbol: "circle",
        symbolSize: 6,
      },
    ],
  };
}

export function statsByCategoryOption(data: LeadVentasStats[], mode: CatViz): EChartsOption {
  const top = data.slice(0, 10);
  const names = top.map((d) => d.name);
  const leads = top.map((d) => d.leads);
  const ventas = top.map((d) => d.ventas);
  const eff = top.map((d) => Math.round(d.efectividad * 10) / 10);

  if (mode === "donut") {
    return {
      backgroundColor: "transparent",
      tooltip: itemTooltip(),
      legend: { type: "scroll", bottom: 0, textStyle: { color: EXEC.textMuted, fontSize: 9 } },
      series: [
        {
          type: "pie",
          radius: ["40%", "65%"],
          center: ["50%", "45%"],
          data: top.map((d, i) => ({
            name: d.name,
            value: d.leads,
            itemStyle: { color: i % 2 === 0 ? EXEC.teal : EXEC.violet, opacity: 0.85 - (i % 5) * 0.06 },
          })),
          label: {
            color: EXEC.textMuted,
            fontSize: 9,
            formatter: "{b}\n{d}%",
          },
        },
      ],
    };
  }

  return {
    backgroundColor: "transparent",
    grid: { ...EXEC.grid, right: 40 },
    legend: { show: true, top: 4, right: 8, textStyle: { color: EXEC.textMuted, fontSize: 10 } },
    tooltip: {
      ...baseTooltip(),
      formatter: (params: any) => {
        let res = `<div style="font-weight:600;margin-bottom:4px;">${params[0].axisValue}</div>`;
        params.forEach((p: any) => {
          const val = p.seriesName === "Efectividad" ? `${p.value}%` : p.value.toLocaleString();
          res += `<div style="display:flex;justify-content:space-between;gap:12px;font-size:11px;">
            <span><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${p.color};margin-right:6px;"></span>${p.seriesName}</span>
            <span style="font-weight:600;">${val}</span>
          </div>`;
        });
        return res;
      },
    },
    xAxis: {
      type: "category",
      data: names,
      axisLabel: { color: EXEC.textMuted, fontSize: 9, rotate: 25, formatter: (v: string) => v.length > 15 ? v.slice(0, 13) + "…" : v },
      axisLine: { lineStyle: { color: EXEC.axis } },
    },
    yAxis: [
      { type: "value", splitLine: { lineStyle: { color: EXEC.split, type: "dashed" } }, axisLabel: { color: EXEC.textMuted, fontSize: 10 } },
      { type: "value", position: "right", splitLine: { show: false }, axisLabel: { color: EXEC.textMuted, fontSize: 10, formatter: "{value}%" } },
    ],
    series: [
      { name: "Leads", type: "bar", data: leads, itemStyle: { color: EXEC.tealDim, borderRadius: [4, 4, 0, 0] }, barMaxWidth: 20 },
      { name: "Ventas", type: "bar", data: ventas, itemStyle: { color: EXEC.violet, borderRadius: [4, 4, 0, 0] }, barMaxWidth: 20, barGap: "-100%" },
      { name: "Efectividad", type: "line", yAxisIndex: 1, smooth: true, data: eff, lineStyle: { width: 2, color: EXEC.amber }, itemStyle: { color: EXEC.amber }, symbol: "circle", symbolSize: 6 },
    ],
  };
}

export function funnelOption(stages: { name: string; value: number }[]): EChartsOption {
  return {
    backgroundColor: "transparent",
    title: {
      text: "Embudo comercial",
      left: 0,
      top: 4,
      textStyle: { color: EXEC.text, fontSize: 13, fontWeight: 600 },
    },
    tooltip: itemTooltip(),
    series: [
      {
        type: "funnel",
        left: "8%",
        top: 48,
        width: "84%",
        height: "72%",
        sort: "descending",
        gap: 4,
        label: { color: EXEC.text, fontSize: 11 },
        data: stages.map((s, i) => ({
          ...s,
          itemStyle: {
            color: [EXEC.teal, EXEC.violet, EXEC.amber, EXEC.rose][i % 4],
            opacity: 0.92 - i * 0.08,
          },
        })),
      },
    ],
  };
}

export function gaugeConversionOption(pct: number, title: string, maxScale = 100): EChartsOption {
  const max = Math.max(5, maxScale);
  const display = Math.round(pct * 10) / 10;
  const needle = Math.min(Math.max(display, 0), max);
  return {
    backgroundColor: "transparent",
    title: {
      text: title,
      left: "center",
      top: 8,
      textStyle: { color: EXEC.text, fontSize: 12, fontWeight: 600 },
    },
    series: [
      {
        type: "gauge",
        startAngle: 200,
        endAngle: -20,
        min: 0,
        max,
        splitNumber: Math.min(5, Math.max(2, Math.round(max / 20))),
        radius: "78%",
        center: ["50%", "58%"],
        axisLine: {
          lineStyle: {
            width: 14,
            color: [
              [0.35, "rgba(13,148,136,0.45)"],
              [0.65, "rgba(124,58,237,0.45)"],
              [1, "rgba(217,119,6,0.5)"],
            ],
          },
        },
        pointer: { itemStyle: { color: EXEC.teal }, width: 4 },
        axisTick: { show: false },
        splitLine: { show: false },
        axisLabel: { color: EXEC.textMuted, fontSize: 9, distance: -48 },
        detail: {
          valueAnimation: true,
          formatter: () => `${display}%`,
          color: EXEC.text,
          fontSize: 22,
          fontWeight: 700,
          offsetCenter: [0, "24%"],
        },
        data: [{ value: needle }],
      },
    ],
  };
}

export function agentComboOption(rows: { name: string; value: number; ventas: number }[]): EChartsOption {
  const top = rows.slice(0, 12);
  const fullNames = top.map((r) => r.name);
  return {
    backgroundColor: "transparent",
    title: {
      text: "Agentes: volumen vs ventas",
      left: 0,
      top: 4,
      textStyle: { color: EXEC.text, fontSize: 13, fontWeight: 600 },
    },
    legend: { top: 28, right: 8, textStyle: { color: EXEC.textMuted, fontSize: 10 } },
    grid: { ...EXEC.grid, top: 56 },
    tooltip: baseTooltip(),
    xAxis: {
      type: "category",
      data: fullNames,
      axisLabel: {
        color: EXEC.textMuted,
        fontSize: 9,
        rotate: 35,
        formatter: (v: string) => (v.length > 14 ? `${v.slice(0, 12)}…` : v),
      },
      axisLine: { lineStyle: { color: EXEC.axis } },
    },
    yAxis: [
      {
        type: "value",
        name: "Leads",
        splitLine: { lineStyle: { color: EXEC.split, type: "dashed" } },
        axisLabel: { color: EXEC.textMuted, fontSize: 10 },
      },
      {
        type: "value",
        name: "Ventas",
        splitLine: { show: false },
        axisLabel: { color: EXEC.textMuted, fontSize: 10 },
      },
    ],
    series: [
      {
        name: "Leads",
        type: "bar",
        data: top.map((r) => r.value),
        itemStyle: { color: EXEC.tealDim, borderRadius: [4, 4, 0, 0] },
      },
      {
        name: "Ventas",
        type: "line",
        yAxisIndex: 1,
        smooth: true,
        data: top.map((r) => r.ventas),
        lineStyle: { color: EXEC.violet, width: 2 },
        itemStyle: { color: EXEC.violet },
      },
    ],
  };
}

export function sparklineOption(values: number[], color: string): EChartsOption {
  return {
    backgroundColor: "transparent",
    grid: { left: 0, right: 0, top: 2, bottom: 0 },
    xAxis: { type: "category", show: false, data: values.map((_, i) => i) },
    yAxis: { type: "value", show: false },
    series: [
      {
        type: "line",
        data: values,
        smooth: true,
        symbol: "none",
        lineStyle: { width: 1.5, color },
        areaStyle: { color: `${color}33` },
      },
    ],
  };
}
