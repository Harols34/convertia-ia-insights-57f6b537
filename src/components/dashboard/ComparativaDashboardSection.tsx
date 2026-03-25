import { useEffect, useMemo, useState } from "react";
import ReactECharts from "echarts-for-react";
import { format, parseISO, endOfISOWeek } from "date-fns";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { useComparativaControls } from "@/contexts/ComparativaControlsContext";
import type { LeadRow } from "@/lib/dashboard-leads";
import {
  uniqueValuesForColumn,
  formatFilterChipValue,
  LEADS_FILTER_EMPTY_TOKEN,
  rowMatchesDimensionToken,
} from "@/lib/dashboard-leads";
import {
  buildComparisonSeriesSpec,
  buildFullDailyTrendForSpec,
  buildWeeklySeriesForSpec,
  comparisonLineAlignedToDailySpec,
  weeklyPreviousPeriodValues,
  COMPARISON_MODE_META,
  COMPARATIVE_DIMENSION_SUBJECTS,
  COMPARATIVE_BREAKDOWN_GROUPS,
  comparativeSpecTitle,
  type ComparativeSeriesSpec,
  type ComparisonMode,
  type DailyComparisonOverlayMode,
} from "@/lib/dashboard-leads-analytics";
import {
  comparisonDualSeriesOption,
  weeklyScalarBarsOption,
  scalarTimeSeriesOption,
  type ComparisonViz,
} from "./dashboard-chart-options";

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "rounded-2xl border-2 border-slate-200 bg-card shadow-sm",
        className,
      )}
    >
      {children}
    </div>
  );
}

function ChartFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-2 dark:bg-muted/30">{children}</div>
  );
}

type BaseKind = "leads" | "ventas" | "efectividad" | "dimension";

function specFromMetricParts(
  baseKind: BaseKind,
  dimSubject: (typeof COMPARATIVE_DIMENSION_SUBJECTS)[number],
  dimToken: string,
): ComparativeSeriesSpec {
  if (baseKind === "leads") return { kind: "leads" };
  if (baseKind === "ventas") return { kind: "ventas" };
  if (baseKind === "efectividad") return { kind: "efectividad" };
  return { kind: "match_column", column: dimSubject.column, token: dimToken };
}

function useDimTokenSync(
  baseKind: BaseKind,
  dimOptions: string[],
  dimToken: string,
  setDimToken: (t: string) => void,
) {
  useEffect(() => {
    if (baseKind !== "dimension") return;
    if (dimOptions.length === 0) return;
    if (!dimOptions.includes(dimToken)) setDimToken(dimOptions[0]!);
  }, [baseKind, dimOptions, dimToken, setDimToken]);
}

function MetricSelectors({
  leads,
  baseKind,
  setBaseKind,
  dimSubjectId,
  setDimSubjectId,
  dimToken,
  setDimToken,
  suffix,
}: {
  leads: LeadRow[];
  baseKind: BaseKind;
  setBaseKind: (v: BaseKind) => void;
  dimSubjectId: string;
  setDimSubjectId: (v: string) => void;
  dimToken: string;
  setDimToken: (v: string) => void;
  /** Evita colisiones de id en DOM si hay varios bloques en la página. */
  suffix: string;
}) {
  const dimSubject = COMPARATIVE_DIMENSION_SUBJECTS.find((d) => d.id === dimSubjectId)!;
  const dimOptions = useMemo(
    () => uniqueValuesForColumn(leads, dimSubject.column, 80),
    [leads, dimSubject.column],
  );
  useDimTokenSync(baseKind, dimOptions, dimToken, setDimToken);

  return (
    <div className="flex flex-wrap gap-2 items-end">
      <div className="space-y-1">
        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Qué analizar</p>
        <Select value={baseKind} onValueChange={(v) => setBaseKind(v as BaseKind)}>
          <SelectTrigger className="h-8 w-[200px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="leads">Leads captados</SelectItem>
            <SelectItem value="ventas">Ventas (día)</SelectItem>
            <SelectItem value="efectividad">Efectividad % (día)</SelectItem>
            <SelectItem value="dimension">Resultado / agente (conteo)</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {baseKind === "dimension" && (
        <>
          <div className="space-y-1">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Dimensión</p>
            <Select value={dimSubjectId} onValueChange={setDimSubjectId}>
              <SelectTrigger className="h-8 w-[200px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {COMPARATIVE_DIMENSION_SUBJECTS.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Valor</p>
            <Select value={dimToken} onValueChange={setDimToken}>
              <SelectTrigger className="h-8 min-w-[180px] max-w-[240px] text-xs" id={`dim-val-${suffix}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-64">
                {dimOptions.map((t) => (
                  <SelectItem key={t} value={t}>
                    {formatFilterChipValue(t)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </>
      )}
    </div>
  );
}

export type ComparativaDashboardSectionProps = {
  leads: LeadRow[];
  onFilterByDate?: (isoDay: string) => void;
  onFilterByWeekRange?: (desde: string, hasta: string) => void;
};

export function ComparativaDashboardSection({
  leads,
  onFilterByDate,
  onFilterByWeekRange,
}: ComparativaDashboardSectionProps) {
  const { compareMode, setCompareMode, compareDays, setCompareDays } = useComparativaControls();

  const [historicTab, setHistoricTab] = useState<"window" | "trend">("window");

  const [alBase, setAlBase] = useState<BaseKind>("leads");
  const [alDimId, setAlDimId] = useState(COMPARATIVE_DIMENSION_SUBJECTS[0]!.id);
  const [alDimTok, setAlDimTok] = useState(LEADS_FILTER_EMPTY_TOKEN);
  const [dailyViz, setDailyViz] = useState<ComparisonViz>("area");

  const [trBase, setTrBase] = useState<BaseKind>("leads");
  const [trDimId, setTrDimId] = useState(COMPARATIVE_DIMENSION_SUBJECTS[0]!.id);
  const [trDimTok, setTrDimTok] = useState(LEADS_FILTER_EMPTY_TOKEN);
  const [trendViz, setTrendViz] = useState<"line" | "area" | "bar">("line");
  const [trendOverlay, setTrendOverlay] = useState<DailyComparisonOverlayMode | "off">("off");

  const [wkBase, setWkBase] = useState<BaseKind>("leads");
  const [wkDimId, setWkDimId] = useState(COMPARATIVE_DIMENSION_SUBJECTS[0]!.id);
  const [wkDimTok, setWkDimTok] = useState(LEADS_FILTER_EMPTY_TOKEN);
  const [weeklyViz, setWeeklyViz] = useState<"bar" | "line" | "area">("bar");
  const [weekCompare, setWeekCompare] = useState(true);

  const alDimSubj = COMPARATIVE_DIMENSION_SUBJECTS.find((d) => d.id === alDimId)!;
  const trDimSubj = COMPARATIVE_DIMENSION_SUBJECTS.find((d) => d.id === trDimId)!;
  const wkDimSubj = COMPARATIVE_DIMENSION_SUBJECTS.find((d) => d.id === wkDimId)!;

  const specAl = useMemo(
    () => specFromMetricParts(alBase, alDimSubj, alDimTok),
    [alBase, alDimSubj, alDimTok],
  );
  const specTr = useMemo(
    () => specFromMetricParts(trBase, trDimSubj, trDimTok),
    [trBase, trDimSubj, trDimTok],
  );
  const specWk = useMemo(
    () => specFromMetricParts(wkBase, wkDimSubj, wkDimTok),
    [wkBase, wkDimSubj, wkDimTok],
  );

  const titleAl = useMemo(() => comparativeSpecTitle(specAl, alDimSubj.label), [specAl, alDimSubj.label]);
  const titleTr = useMemo(() => comparativeSpecTitle(specTr, trDimSubj.label), [specTr, trDimSubj.label]);
  const titleWk = useMemo(() => comparativeSpecTitle(specWk, wkDimSubj.label), [specWk, wkDimSubj.label]);

  const yAl = specAl.kind === "efectividad";
  const yTr = specTr.kind === "efectividad";
  const yWk = specWk.kind === "efectividad";

  const comparisonAl = useMemo(
    () => buildComparisonSeriesSpec(leads, compareDays, compareMode, specAl),
    [leads, compareDays, compareMode, specAl],
  );

  const comparisonTrWindow = useMemo(
    () => buildComparisonSeriesSpec(leads, compareDays, compareMode, specTr),
    [leads, compareDays, compareMode, specTr],
  );

  const optAligned = useMemo(
    () =>
      comparisonDualSeriesOption(comparisonAl.points, `Ventana diaria · ${titleAl}`, {
        subtitle: comparisonAl.meta.subtitle,
        actualName: "Serie actual",
        comparisonName: comparisonAl.meta.comparisonLegend,
        yPercent: yAl,
        viz: dailyViz,
      }),
    [comparisonAl, titleAl, yAl, dailyViz],
  );

  const optHistoricWindow = useMemo(
    () =>
      comparisonDualSeriesOption(comparisonTrWindow.points, `Ventana global (${compareDays}d) · ${titleTr}`, {
        subtitle: comparisonTrWindow.meta.subtitle,
        actualName: "Serie actual",
        comparisonName: comparisonTrWindow.meta.comparisonLegend,
        yPercent: yTr,
        viz: trendViz,
      }),
    [comparisonTrWindow, compareDays, titleTr, yTr, trendViz],
  );

  const trend = useMemo(() => buildFullDailyTrendForSpec(leads, 90, specTr), [leads, specTr]);
  const trendOverlayData = useMemo(() => {
    if (trendOverlay === "off" || trend.length === 0) return undefined;
    const data = comparisonLineAlignedToDailySpec(leads, trend, specTr, trendOverlay);
    return {
      name: COMPARISON_MODE_META[trendOverlay].comparisonLegend,
      data,
    };
  }, [leads, trend, specTr, trendOverlay]);

  const optTrend = useMemo(
    () =>
      scalarTimeSeriesOption(
        trend.map((t) => ({ date: t.date, value: t.value })),
        `Histórico (~90 días) · ${titleTr}`,
        {
          viz: trendViz,
          yPercent: yTr,
          overlayLine: trendOverlayData,
        },
      ),
    [trend, titleTr, trendViz, yTr, trendOverlayData],
  );

  const weekly = useMemo(() => buildWeeklySeriesForSpec(leads, 20, specWk), [leads, specWk]);
  const weekPrev = useMemo(
    () => (weekCompare ? weeklyPreviousPeriodValues(weekly) : []),
    [weekCompare, weekly],
  );

  const weeklyChartTitle = useMemo(
    () =>
      `Semanal ISO · ${titleWk} · ventana global ${compareDays}d · ${COMPARISON_MODE_META[compareMode].label}`,
    [titleWk, compareDays, compareMode],
  );

  const optWeekly = useMemo(
    () =>
      weeklyScalarBarsOption(
        weekly.map((w) => ({ label: w.label, value: w.value })),
        weeklyChartTitle,
        {
          compareLine: weekCompare
            ? { name: "Semana ISO anterior (misma métrica)", data: weekPrev }
            : undefined,
          yPercent: yWk,
          viz: weeklyViz,
        },
      ),
    [weekly, weeklyChartTitle, yWk, weekCompare, weekPrev, weeklyViz],
  );

  const evCompareDay = useMemo(() => {
    if (!onFilterByDate) return undefined;
    const keys = comparisonAl.dateKeys;
    return {
      click: (params: { dataIndex?: number }) => {
        const i = params.dataIndex;
        if (typeof i !== "number" || i < 0 || i >= keys.length) return;
        onFilterByDate(keys[i]!);
      },
    };
  }, [onFilterByDate, comparisonAl.dateKeys]);

  const evWeekly = useMemo(() => {
    if (!onFilterByWeekRange) return undefined;
    return {
      click: (params: { dataIndex?: number }) => {
        const i = params.dataIndex;
        if (typeof i !== "number" || i < 0 || i >= weekly.length) return;
        const start = parseISO(weekly[i]!.weekStart);
        const end = endOfISOWeek(start, { weekStartsOn: 1 });
        onFilterByWeekRange(format(start, "yyyy-MM-dd"), format(end, "yyyy-MM-dd"));
      },
    };
  }, [onFilterByWeekRange, weekly]);

  const evTrendDay = useMemo(() => {
    if (!onFilterByDate) return undefined;
    return {
      click: (params: { dataIndex?: number }) => {
        const i = params.dataIndex;
        if (typeof i !== "number" || i < 0 || i >= trend.length) return;
        onFilterByDate(trend[i]!.date);
      },
    };
  }, [onFilterByDate, trend]);

  const evHistoricWindowDay = useMemo(() => {
    if (!onFilterByDate) return undefined;
    const keys = comparisonTrWindow.dateKeys;
    return {
      click: (params: { dataIndex?: number }) => {
        const i = params.dataIndex;
        if (typeof i !== "number" || i < 0 || i >= keys.length) return;
        onFilterByDate(keys[i]!);
      },
    };
  }, [onFilterByDate, comparisonTrWindow.dateKeys]);

  /* —— Explorador dinámico (un gráfico; elige columna + busca valor + métrica propia) —— */
  const [exFilterCol, setExFilterCol] = useState<keyof LeadRow>(COMPARATIVE_BREAKDOWN_GROUPS[0]!.column);
  const exGroupMeta = useMemo(
    () => COMPARATIVE_BREAKDOWN_GROUPS.find((g) => g.column === exFilterCol) ?? COMPARATIVE_BREAKDOWN_GROUPS[0]!,
    [exFilterCol],
  );
  const [exSearch, setExSearch] = useState("");
  const [exFilterTok, setExFilterTok] = useState<string>(LEADS_FILTER_EMPTY_TOKEN);
  const [exBase, setExBase] = useState<BaseKind>("leads");
  const [exDimId, setExDimId] = useState(COMPARATIVE_DIMENSION_SUBJECTS[0]!.id);
  const [exDimTok, setExDimTok] = useState(LEADS_FILTER_EMPTY_TOKEN);
  const [exViz, setExViz] = useState<ComparisonViz>("area");

  const exFilterOptions = useMemo(() => uniqueValuesForColumn(leads, exFilterCol, 400), [leads, exFilterCol]);
  const exFilteredPicklist = useMemo(() => {
    const q = exSearch.trim().toLowerCase();
    const base = q
      ? exFilterOptions.filter((t) => formatFilterChipValue(t).toLowerCase().includes(q))
      : exFilterOptions;
    return base.slice(0, 100);
  }, [exFilterOptions, exSearch]);

  useEffect(() => {
    if (exFilterOptions.length === 0) return;
    if (!exFilterOptions.includes(exFilterTok)) setExFilterTok(exFilterOptions[0]!);
  }, [exFilterCol, exFilterOptions, exFilterTok]);

  const exDimSubj = COMPARATIVE_DIMENSION_SUBJECTS.find((d) => d.id === exDimId)!;
  const exDimOptions = useMemo(
    () => uniqueValuesForColumn(leads, exDimSubj.column, 80),
    [leads, exDimSubj.column],
  );
  const exInnerSpec = useMemo(
    () => specFromMetricParts(exBase, exDimSubj, exDimTok),
    [exBase, exDimSubj, exDimTok],
  );
  useDimTokenSync(exBase, exDimOptions, exDimTok, setExDimTok);

  const exSlice = useMemo(
    () => leads.filter((r) => rowMatchesDimensionToken(r, exFilterCol, exFilterTok)),
    [leads, exFilterCol, exFilterTok],
  );

  const exComparison = useMemo(
    () => buildComparisonSeriesSpec(exSlice, compareDays, compareMode, exInnerSpec),
    [exSlice, compareDays, compareMode, exInnerSpec],
  );

  const exTitle = useMemo(
    () =>
      `${exGroupMeta.label}: ${formatFilterChipValue(exFilterTok)} · ${comparativeSpecTitle(exInnerSpec, exDimSubj.label)}`,
    [exGroupMeta.label, exFilterTok, exInnerSpec, exDimSubj.label],
  );

  const exYpct = exInnerSpec.kind === "efectividad";
  const optExplorer = useMemo(
    () =>
      comparisonDualSeriesOption(exComparison.points, `Corte · ${exTitle}`, {
        subtitle: exComparison.meta.subtitle,
        actualName: "Serie actual",
        comparisonName: exComparison.meta.comparisonLegend,
        yPercent: exYpct,
        viz: exViz,
      }),
    [exComparison, exTitle, exYpct, exViz],
  );

  const evExplorerDay = useMemo(() => {
    if (!onFilterByDate) return undefined;
    const keys = exComparison.dateKeys;
    return {
      click: (params: { dataIndex?: number }) => {
        const i = params.dataIndex;
        if (typeof i !== "number" || i < 0 || i >= keys.length) return;
        onFilterByDate(keys[i]!);
      },
    };
  }, [onFilterByDate, exComparison.dateKeys]);

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-display font-bold text-foreground tracking-tight">Comparativa</h2>
        <p className="text-sm text-muted-foreground mt-1 max-w-3xl">
          <strong>Modo de comparación</strong> y <strong>ventana</strong> son globales para esta sección. Cada gráfico
          elige por separado qué métrica analizar y el tipo de visualización.
        </p>
      </div>

      <Card className="p-4 md:p-5">
        <p className="text-[11px] text-muted-foreground mb-3">
          Estos dos controles aplican a <strong>todos</strong> los gráficos de comparativa (ventana alineada, histórico
          «ventana global», semanal y explorador).
        </p>
        <div className="flex flex-wrap gap-4 items-end">
          <div className="space-y-1">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Modo comparación</p>
            <Select value={compareMode} onValueChange={(v) => setCompareMode(v as ComparisonMode)}>
              <SelectTrigger className="h-9 min-w-[240px] max-w-[300px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(COMPARISON_MODE_META) as ComparisonMode[]).map((m) => (
                  <SelectItem key={m} value={m}>
                    {COMPARISON_MODE_META[m].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Ventana</p>
            <Select value={String(compareDays)} onValueChange={(v) => setCompareDays(Number(v) as 7 | 14 | 21 | 28)}>
              <SelectTrigger className="h-9 w-[120px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">7 días</SelectItem>
                <SelectItem value="14">14 días</SelectItem>
                <SelectItem value="21">21 días</SelectItem>
                <SelectItem value="28">28 días</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card className="p-4 space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <p className="text-xs font-semibold text-foreground">Ventana alineada</p>
            <div className="space-y-1">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Vista</p>
              <Select value={dailyViz} onValueChange={(v) => setDailyViz(v as ComparisonViz)}>
                <SelectTrigger className="h-8 w-[120px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="area">Área</SelectItem>
                  <SelectItem value="line">Líneas</SelectItem>
                  <SelectItem value="bar">Barras</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <MetricSelectors
            leads={leads}
            baseKind={alBase}
            setBaseKind={setAlBase}
            dimSubjectId={alDimId}
            setDimSubjectId={setAlDimId}
            dimToken={alDimTok}
            setDimToken={setAlDimTok}
            suffix="al"
          />
          <p className="text-[11px] text-muted-foreground">Clic en punto filtra por día</p>
          <ChartFrame>
            <ReactECharts
              key={`al-${compareMode}-${compareDays}-${dailyViz}-${titleAl}`}
              option={optAligned}
              style={{ height: 300, width: "100%" }}
              notMerge
              lazyUpdate
              onEvents={evCompareDay}
            />
          </ChartFrame>
        </Card>

        <Card className="p-4 space-y-3">
          <Tabs
            value={historicTab}
            onValueChange={(v) => setHistoricTab(v as "window" | "trend")}
            className="w-full space-y-3"
          >
            <div className="flex flex-wrap items-end justify-between gap-2">
              <p className="text-xs font-semibold text-foreground">Histórico</p>
              <div className="flex flex-wrap items-end gap-2">
                <div className="space-y-1">
                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Vista</p>
                  <Select value={trendViz} onValueChange={(v) => setTrendViz(v as typeof trendViz)}>
                    <SelectTrigger className="h-8 w-[120px] text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="line">Líneas</SelectItem>
                      <SelectItem value="area">Área</SelectItem>
                      <SelectItem value="bar">Barras</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <TabsList className="h-8">
                  <TabsTrigger value="window" className="text-xs px-2.5">
                    Ventana global
                  </TabsTrigger>
                  <TabsTrigger value="trend" className="text-xs px-2.5">
                    ~90 días
                  </TabsTrigger>
                </TabsList>
              </div>
            </div>
            <MetricSelectors
              leads={leads}
              baseKind={trBase}
              setBaseKind={setTrBase}
              dimSubjectId={trDimId}
              setDimSubjectId={setTrDimId}
              dimToken={trDimTok}
              setDimToken={setTrDimTok}
              suffix="tr"
            />
            <TabsContent value="window" className="mt-0 space-y-2">
              <p className="text-[11px] text-muted-foreground">
                Comparación dual con el <strong>modo</strong> y la <strong>ventana</strong> globales (igual que «Ventana
                alineada»), usando la métrica definida arriba en este bloque.
              </p>
              <ChartFrame>
                <ReactECharts
                  key={`tr-win-${compareMode}-${compareDays}-${trendViz}-${titleTr}`}
                  option={optHistoricWindow}
                  style={{ height: 300, width: "100%" }}
                  notMerge
                  lazyUpdate
                  onEvents={evHistoricWindowDay}
                />
              </ChartFrame>
            </TabsContent>
            <TabsContent value="trend" className="mt-0 space-y-2">
              <div className="flex flex-wrap gap-2 items-end justify-end">
                <div className="space-y-1">
                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Línea extra</p>
                  <Select value={trendOverlay} onValueChange={(v) => setTrendOverlay(v as typeof trendOverlay)}>
                    <SelectTrigger className="h-8 w-[180px] text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="off">Sin línea extra</SelectItem>
                      <SelectItem value="prev_calendar_day">vs día anterior</SelectItem>
                      <SelectItem value="same_weekday_prev_week">vs −7 días</SelectItem>
                      <SelectItem value="avg_weekday_historical">vs prom. weekday</SelectItem>
                      <SelectItem value="same_dom_prev_month">vs mismo día mes ant.</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground">Serie larga sin acotar a la ventana global · Clic filtra por día</p>
              <ChartFrame>
                <ReactECharts
                  key={`tr-trend-${compareMode}-${compareDays}-${trendViz}-${trendOverlay}-${titleTr}`}
                  option={optTrend}
                  style={{ height: 300, width: "100%" }}
                  notMerge
                  lazyUpdate
                  onEvents={evTrendDay}
                />
              </ChartFrame>
            </TabsContent>
          </Tabs>
        </Card>
      </div>

      <Card className="p-4 space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <p className="text-xs font-semibold text-foreground">Semanas ISO</p>
          <div className="flex flex-wrap gap-2 items-end">
            <div className="space-y-1">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Vista</p>
              <Select value={weeklyViz} onValueChange={(v) => setWeeklyViz(v as typeof weeklyViz)}>
                <SelectTrigger className="h-8 w-[120px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bar">Barras</SelectItem>
                  <SelectItem value="line">Líneas</SelectItem>
                  <SelectItem value="area">Área</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Comparar</p>
              <Select value={weekCompare ? "yes" : "no"} onValueChange={(v) => setWeekCompare(v === "yes")}>
                <SelectTrigger className="h-8 w-[150px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="yes">+ semana ant.</SelectItem>
                  <SelectItem value="no">Solo serie</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <MetricSelectors
          leads={leads}
          baseKind={wkBase}
          setBaseKind={setWkBase}
          dimSubjectId={wkDimId}
          setDimSubjectId={setWkDimId}
          dimToken={wkDimTok}
          setDimToken={setWkDimTok}
          suffix="wk"
        />
        <p className="text-[11px] text-muted-foreground">Clic filtra rango de semana</p>
        <ChartFrame>
          <ReactECharts
            key={`wk-${weeklyViz}-${weekCompare}-${compareMode}-${compareDays}-${titleWk}`}
            option={optWeekly}
            style={{ height: 320, width: "100%" }}
            notMerge
            lazyUpdate
            onEvents={evWeekly}
          />
        </ChartFrame>
      </Card>

      {leads.length > 0 && (
        <Card className="p-4 md:p-5 space-y-4">
          <div>
            <h3 className="text-base font-display font-semibold text-foreground">Explorador comparativo por dimensión</h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-3xl">
              Elige una columna (ciudad, campaña, canal, etc.), busca un valor y define qué métrica calcular dentro de ese
              corte. Usa la misma ventana y modo global de arriba.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 items-end">
            <div className="space-y-1">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Dimensión del corte</p>
              <Select
                value={String(exFilterCol)}
                onValueChange={(v) => setExFilterCol(v as keyof LeadRow)}
              >
                <SelectTrigger className="h-8 w-[200px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {COMPARATIVE_BREAKDOWN_GROUPS.map((g) => (
                    <SelectItem key={g.id} value={String(g.column)}>
                      {g.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1 min-w-[160px] flex-1 max-w-xs">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Buscar valor</p>
              <Input
                className="h-8 text-xs"
                placeholder="Filtrar lista…"
                value={exSearch}
                onChange={(e) => setExSearch(e.target.value)}
              />
            </div>
            <div className="space-y-1 min-w-[200px] max-w-[280px]">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Valor</p>
              <Select value={exFilterTok} onValueChange={setExFilterTok}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-64">
                  {exFilteredPicklist.length === 0 ? (
                    <SelectItem value="__none__" disabled className="text-muted-foreground">
                      Sin coincidencias
                    </SelectItem>
                  ) : (
                    exFilteredPicklist.map((t) => (
                      <SelectItem key={t} value={t}>
                        {formatFilterChipValue(t)}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Vista</p>
              <Select value={exViz} onValueChange={(v) => setExViz(v as ComparisonViz)}>
                <SelectTrigger className="h-8 w-[110px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="area">Área</SelectItem>
                  <SelectItem value="line">Líneas</SelectItem>
                  <SelectItem value="bar">Barras</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <MetricSelectors
            leads={leads}
            baseKind={exBase}
            setBaseKind={setExBase}
            dimSubjectId={exDimId}
            setDimSubjectId={setExDimId}
            dimToken={exDimTok}
            setDimToken={setExDimTok}
            suffix="ex"
          />
          <p className="text-[11px] text-muted-foreground">
            Registros en este corte: {exSlice.length.toLocaleString("es")} · Clic en punto filtra por día
          </p>
          <ChartFrame>
            <ReactECharts
              key={`ex-${exFilterCol}-${exFilterTok}-${exViz}-${compareMode}-${compareDays}-${exTitle}`}
              option={optExplorer}
              style={{ height: 320, width: "100%" }}
              notMerge
              lazyUpdate
              onEvents={evExplorerDay}
            />
          </ChartFrame>
        </Card>
      )}
    </section>
  );
}
