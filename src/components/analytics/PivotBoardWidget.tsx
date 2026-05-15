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
import { translatePivotConfigToRpc, buildGridFromAggregatedData } from "@/lib/pivot-rpc-bridge";

interface PivotBoardWidgetProps {
  config: PivotWidgetPersistedConfig;
  /** Ocultas definidas en la fuente (`tenant_data_sources.restrictions`); se aplican aunque el widget se guardó antes. */
  sourceHiddenColumns?: string[];
}

export function PivotBoardWidget({ config, sourceHiddenColumns }: PivotBoardWidgetProps) {
  const { slices, togglePivotRowSlice } = useBoardCrossFilter();
  const crossForTable = useMemo(() => crossSlicesForTable(slices, config.tableName), [slices, config.tableName]);

  const [gridData, setGridData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const bridge = useMemo(() => translatePivotConfigToRpc(config), [config]);
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
        // Combinamos filtros del config con los filtros interactivos del tablero
        const finalFilters = [...bridge.filters];
        Object.entries(crossForTable).forEach(([f, vals]) => {
          const existingIdx = finalFilters.findIndex(xf => xf.field === f);
          if (existingIdx >= 0) {
            // Si ya existe un filtro estático para este campo, lo sobreescribimos con el interactivo (comportamiento slice)
            finalFilters[existingIdx] = { ...finalFilters[existingIdx], values: vals };
          } else {
            finalFilters.push({ field: f, op: 'in', values: vals });
          }
        });

        console.log("RPC Pivot Aggregation Params (with Cross-Filter):", { ...bridge, filters: finalFilters });
        const { data, error } = await supabase.rpc("analytics_aggregate", {
          p_group_by: bridge.groupBy,
          p_measures: bridge.measures,
          p_filters: finalFilters,
          p_date_granularity: bridge.dateGranularity,
          p_limit: bridge.limit
        });

        if (error) throw error;
        if (!cancelled) setGridData(data as any[]);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Error al cargar datos");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [bridge, crossForTable]); // Re-renderizar cuando cambian los filtros interactivos



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

  const grid = useMemo(() => {
    if (!gridData.length || !config.measures.length) return null;
    return buildGridFromAggregatedData(gridData, config);
  }, [gridData, config]);

  const chartOption = useMemo(() => {
    if (!grid || config.viz === "table" || !config.chartMeasureId || isCustomCardViz(config.viz)) return null;
    return buildPivotChartOption(config.viz, config.chartMeasureId, grid, appearance);
  }, [grid, config.viz, config.chartMeasureId, appearance]);

  const chartEvents = useMemo(
    () => ({
      click: (params: { dataIndex?: number; name?: string; componentType?: string }) => {
        if (!grid || !config.rowFields.length) return;
        
        // Intentar encontrar el rowKey basándose en el nombre de la categoría (más robusto para diversos tipos de gráficos)
        let rowKey: string | undefined;
        
        if (params.name && grid.rowKeys.includes(params.name)) {
          rowKey = params.name;
        } else if (typeof params.dataIndex === "number") {
          rowKey = grid.rowKeys[params.dataIndex];
        }

        if (rowKey) {
          togglePivotRowSlice(config.tableName, config.rowFields, rowKey);
        }
      },
    }),
    [grid, config.tableName, config.rowFields, togglePivotRowSlice],
  );

  const crossValsForDim = useMemo(() => {
    if (config.rowFields.length === 1) {
      return crossForTable[config.rowFields[0]];
    }
    return undefined;
  }, [crossForTable, config.rowFields]);

  const tableRowOpacity = useMemo(() => {
    if (config.rowFields.length === 1 && crossValsForDim && crossValsForDim.length > 0) {
      return (rowKey: string) => {
        const v = parsePivotRowKeyParts(rowKey)[0];
        if (v === undefined) return 1;
        return crossValsForDim.includes(v) ? 1 : 0.35; // Mayor contraste para los que no están seleccionados
      };
    }
    return undefined;
  }, [config.rowFields, crossValsForDim]);

  // Ya no retornamos prematuramente en loading para evitar parpadeo.
  // Solo si no hay datos previos y estamos cargando mostramos el loader central.

  if (error) {
    return <p className="text-xs text-destructive p-2">{error}</p>;
  }

  const renderContent = () => {
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
      const measureLabel = config.measures.find((m) => m.id === config.chartMeasureId);
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

    if (!chartOption || !chartOption.series || (Array.isArray(chartOption.series) && chartOption.series.length === 0)) {
      return <p className="text-xs text-muted-foreground p-2">No se pudo generar el gráfico o no hay series de datos.</p>;
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
  };

  return (
    <div className="min-h-[120px] h-full min-h-0 flex-1 min-w-0 w-full flex flex-col relative group/widget">
      {loading && (
        <div className={cn(
          "absolute z-50 transition-all duration-300",
          grid ? "top-2 right-2" : "inset-0 flex items-center justify-center bg-background/50"
        )}>
          <Loader2 className={cn("animate-spin text-primary", grid ? "h-3.5 w-3.5 opacity-40" : "h-5 w-5")} />
          {!grid && <span className="ml-2 text-[10px] font-medium text-muted-foreground">Cargando...</span>}
        </div>
      )}
      
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-destructive/5 z-40 p-4 text-center">
          <p className="text-[10px] text-destructive font-medium">{error}</p>
        </div>
      )}

      {renderContent()}
    </div>
  );
}

// Extraemos el renderizado para limpieza
function cn(...classes: any[]) {
  return classes.filter(Boolean).join(" ");
}
