import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import ReactECharts from "echarts-for-react";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PivotTableView } from "@/components/integraciones/PivotTableView";
import {
  buildPivotChartOption,
  firstCellValue,
  grandTotalMeasure,
  isCustomCardViz,
} from "@/lib/pivot-chart";
import {
  buildPivotGrid,
  parsePivotRowKeyParts,
  type DateGranularity,
  type PivotFilter,
  uniquePivotDimensionValues,
} from "@/lib/pivot-engine";
import type { PivotWidgetPersistedConfig } from "@/types/analytics-pivot";
import { sanitizeWidgetAppearance } from "@/lib/widget-appearance-utils";
import { useBoardCrossFilter } from "@/contexts/BoardCrossFilterContext";
import { crossSlicesForTable } from "@/lib/board-cross-filter";
import { mergeHiddenDataColumns } from "@/lib/tenant-data-source-utils";
import { isDateLikeType } from "@/lib/pivot-dates";
import { fetchCachedIntegrationRows } from "@/lib/integration-rows-cache";

interface PivotBoardWidgetProps {
  config: PivotWidgetPersistedConfig;
  /** Ocultas definidas en la fuente (`tenant_data_sources.restrictions`); se aplican aunque el widget se guardó antes. */
  sourceHiddenColumns?: string[];
}

export function PivotBoardWidget({ config, sourceHiddenColumns }: PivotBoardWidgetProps) {
  const { slices, togglePivotRowSlice } = useBoardCrossFilter();
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const stripCols = useMemo(
    () => mergeHiddenDataColumns(config.hiddenDataColumns, sourceHiddenColumns),
    [config.hiddenDataColumns, sourceHiddenColumns],
  );
  const dateMeta = config.dateFields ?? [];
  const gran = config.fieldDateGranularity ?? {};
  const selectColumns = useMemo(() => {
    const cols = new Set<string>([
      ...config.rowFields,
      ...config.colFields,
      ...config.filterFields,
      ...(config.dateFields ?? []),
    ]);
    if (config.tableName === "leads") cols.add("fch_creacion");
    for (const measure of config.measures) {
      if (measure.kind === "field") cols.add(measure.field);
    }
    return [...cols];
  }, [config.tableName, config.rowFields, config.colFields, config.filterFields, config.dateFields, config.measures]);
  const appearance = useMemo(
    () => sanitizeWidgetAppearance(config.appearance),
    [JSON.stringify(config.appearance ?? null)],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchCachedIntegrationRows(
          supabase,
          config.tableName,
          stripCols.length ? stripCols : undefined,
          config.tableName === "leads" ? selectColumns : undefined,
          undefined,
        );
        if (!cancelled) setRows(data);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Error al cargar datos");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [config.tableName, stripCols.join("\0"), selectColumns]);

  const crossForTable = useMemo(() => crossSlicesForTable(slices, config.tableName), [slices, config.tableName]);

  const { data: colMeta } = useQuery({
    queryKey: ["integration-columns", config.tableName],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("list_integration_table_columns", {
        p_table_name: config.tableName,
      });
      if (error) throw error;
      return (data ?? []) as { column_name: string; data_type: string; udt_name: string }[];
    },
  });

  const dateColNamesSet = useMemo(() => {
    if (!colMeta?.length) return new Set<string>();
    return new Set(
      colMeta.filter((c) => isDateLikeType(c.data_type, c.udt_name)).map((c) => c.column_name),
    );
  }, [colMeta]);

  const grid = useMemo(() => {
    if (!rows.length || !config.measures.length) return null;
    try {
      const cross = crossForTable;
      const fieldSet = new Set([...config.filterFields, ...Object.keys(cross)]);

      const dateFieldsEffectiveSet = new Set(config.dateFields ?? []);
      for (const f of fieldSet) {
        if (dateColNamesSet.has(f)) dateFieldsEffectiveSet.add(f);
      }
      const dateMetaEffective = [...dateFieldsEffectiveSet];
      const granEffective: Record<string, DateGranularity> = { ...gran };
      for (const f of fieldSet) {
        if (dateColNamesSet.has(f) && granEffective[f] === undefined) {
          granEffective[f] = "month";
        }
      }

      const filters: PivotFilter[] = [];
      for (const field of fieldSet) {
        const all = uniquePivotDimensionValues(rows, field, dateMetaEffective, granEffective);
        const fromCross = cross[field];
        const fromWidget = config.filterSelections[field];
        const sel =
          fromCross !== undefined && fromCross.length > 0 ? fromCross : fromWidget;
        if (sel === undefined) continue;
        if (sel.length === 0) {
          filters.push({ field, values: ["__sin_coincidencias__"] });
          continue;
        }
        if (all.length > 0 && sel.length >= all.length) continue;
        filters.push({ field, values: sel });
      }
      return buildPivotGrid(rows, {
        rowFields: config.rowFields,
        colFields: config.colFields,
        filters,
        measures: config.measures,
        dateFields: dateMetaEffective,
        fieldDateGranularity: granEffective,
      });
    } catch {
      return null;
    }
  }, [rows, config, dateMeta, gran, crossForTable, dateColNamesSet]);

  const chartOption = useMemo(() => {
    if (!grid || config.viz === "table" || !config.chartMeasureId || isCustomCardViz(config.viz)) return null;
    return buildPivotChartOption(config.viz, config.chartMeasureId, grid, appearance);
  }, [grid, config.viz, config.chartMeasureId, appearance]);

  const chartEvents = useMemo(
    () => ({
      click: (params: { dataIndex?: number }) => {
        if (!grid || !config.rowFields.length) return;
        if (typeof params.dataIndex !== "number") return;
        const rk = grid.rowKeys[params.dataIndex];
        if (rk) togglePivotRowSlice(config.tableName, config.rowFields, rk);
      },
    }),
    [grid, config.tableName, config.rowFields, togglePivotRowSlice],
  );

  const measureLabel = config.measures.find((m) => m.id === config.chartMeasureId);

  const crossDimSingle = config.rowFields.length === 1 ? config.rowFields[0] : null;
  const crossValsForDim = crossDimSingle ? crossForTable[crossDimSingle] : undefined;
  const tableRowOpacity =
    crossDimSingle && crossValsForDim && crossValsForDim.length > 0
      ? (rowKey: string) => {
          const v = parsePivotRowKeyParts(rowKey)[0];
          if (v === undefined) return 1;
          return crossValsForDim.includes(v) ? 1 : 0.38;
        }
      : undefined;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[80px] text-muted-foreground gap-2 text-xs flex-1">
        <Loader2 className="h-4 w-4 animate-spin" />
        Cargando datos…
      </div>
    );
  }

  if (error) {
    return <p className="text-xs text-destructive p-2">{error}</p>;
  }

  if (!grid || !config.measures.length) {
    return <p className="text-xs text-muted-foreground p-2">Sin datos para esta configuración.</p>;
  }

  if (config.viz === "table") {
    return (
      <div className="min-h-0 flex-1 overflow-auto w-full">
        <PivotTableView
          grid={grid}
          measures={config.measures}
          rowOpacity={tableRowOpacity}
          onRowClick={
            config.rowFields.length
              ? (rk) => togglePivotRowSlice(config.tableName, config.rowFields, rk)
              : undefined
          }
        />
      </div>
    );
  }

  if (isCustomCardViz(config.viz) && config.chartMeasureId) {
    const gtot = grandTotalMeasure(grid, config.chartMeasureId);
    const lbl = measureLabel?.kind === "field" ? measureLabel.field : measureLabel?.label ?? "Medida";
    const primary = appearance?.primaryColor ?? undefined;
    const track = appearance?.secondaryColor ?? undefined;

    const cardAreaBg = appearance?.backgroundColor;
    return (
      <div
        className="flex flex-col items-center justify-center p-2 min-h-[100px] flex-1 gap-2 w-full"
        style={cardAreaBg ? { backgroundColor: cardAreaBg } : undefined}
      >
        {config.viz === "card" ? (
          <p
            className="text-2xl font-bold tabular-nums"
            style={primary ? { color: primary } : undefined}
          >
            {gtot.toLocaleString("es", { maximumFractionDigits: 2 })}
          </p>
        ) : (
          (() => {
            const first = firstCellValue(grid, config.chartMeasureId);
            const pct = gtot > 0 ? Math.min(100, Math.round((first / gtot) * 100)) : 0;
            const fill = primary ?? "hsl(var(--primary))";
            const base = track ?? "hsl(var(--muted))";
            const innerBg = cardAreaBg ?? "hsl(var(--card))";
            return (
              <div
                className="relative flex h-28 w-28 items-center justify-center rounded-full"
                style={{
                  background: `conic-gradient(${fill} ${pct * 3.6}deg, ${base} 0deg)`,
                }}
              >
                <div
                  className="absolute inset-2 flex flex-col items-center justify-center rounded-full text-center"
                  style={{ backgroundColor: innerBg }}
                >
                  <span className="text-sm font-bold tabular-nums">{gtot.toLocaleString("es", { maximumFractionDigits: 1 })}</span>
                  <span className="text-[9px] text-muted-foreground leading-tight">1ª fila / total {pct}%</span>
                </div>
              </div>
            );
          })()
        )}
        <span className="text-[10px] text-muted-foreground">{lbl}</span>
      </div>
    );
  }

  if (!chartOption) {
    return <p className="text-xs text-muted-foreground p-2">No se pudo generar el gráfico.</p>;
  }

  return (
    <div className="min-h-[120px] h-full min-h-0 flex-1 min-w-0 w-full flex flex-col">
      <ReactECharts
        option={chartOption}
        style={{ height: "100%", minHeight: 120, width: "100%", flex: 1 }}
        notMerge
        lazyUpdate
        onEvents={chartEvents}
      />
    </div>
  );
}
