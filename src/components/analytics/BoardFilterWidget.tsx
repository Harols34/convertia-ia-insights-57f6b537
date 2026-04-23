import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Filter } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useBoardCrossFilter } from "@/contexts/BoardCrossFilterContext";
import { boardCrossFilterKey } from "@/lib/board-cross-filter";
import type { BoardFilterWidgetConfig } from "@/types/analytics-pivot";
import { uniquePivotDimensionValues } from "@/lib/pivot-engine";
import { mergeHiddenDataColumns } from "@/lib/tenant-data-source-utils";
import { formatDateBucketChipLabel, isDateLikeType } from "@/lib/pivot-dates";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { fetchCachedIntegrationRows } from "@/lib/integration-rows-cache";

export function BoardFilterWidget({
  config,
  sourceHiddenColumns,
}: {
  config: BoardFilterWidgetConfig;
  sourceHiddenColumns?: string[];
}) {
  const { slices, toggleSlicerMember, clearSlicerField } = useBoardCrossFilter();
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const stripCols = useMemo(
    () => mergeHiddenDataColumns(config.hiddenDataColumns, sourceHiddenColumns),
    [config.hiddenDataColumns, sourceHiddenColumns],
  );
  const selectColumns = useMemo(() => [config.field], [config.field]);
  const sliceKey = boardCrossFilterKey(config.tableName, config.field);
  const activeSet = useMemo(() => new Set(slices[sliceKey] ?? []), [slices, sliceKey]);
  const hasFilter = activeSet.size > 0;

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
        );
        if (!cancelled) setRows(data);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Error al cargar");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [config.tableName, stripCols.join("\0"), selectColumns]);

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

  const fieldMeta = colMeta?.find((c) => c.column_name === config.field);
  const isDateField = fieldMeta ? isDateLikeType(fieldMeta.data_type, fieldMeta.udt_name) : false;
  const dateGranularity = config.fieldDateGranularity ?? "month";
  const dateFieldsList = useMemo(
    () => (isDateField ? [config.field] : []),
    [isDateField, config.field],
  );
  const dateGranularityMap = useMemo(
    () => (isDateField ? { [config.field]: dateGranularity } : {}),
    [isDateField, config.field, dateGranularity],
  );

  const values = useMemo(() => {
    if (!rows.length) return [];
    return uniquePivotDimensionValues(rows, config.field, dateFieldsList, dateGranularityMap);
  }, [rows, config.field, dateFieldsList, dateGranularityMap]);

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground min-h-[100px]">
        <Loader2 className="h-4 w-4 animate-spin" />
        Cargando filtro…
      </div>
    );
  }

  if (error) {
    return <p className="text-xs text-destructive p-2">{error}</p>;
  }

  return (
    <div className="flex flex-col gap-2 min-h-0 p-1">
      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground uppercase tracking-wide">
        <Filter className="h-3 w-3" />
        <span className="font-mono truncate">{config.field}</span>
      </div>
      <ScrollArea className="max-h-[200px]">
        <div className="flex flex-wrap gap-1.5 pr-2">
          <Button
            type="button"
            variant={!hasFilter ? "secondary" : "outline"}
            size="sm"
            className="h-7 text-[10px]"
            onClick={() => clearSlicerField(config.tableName, config.field)}
          >
            Todos
          </Button>
          {values.map((v) => {
            const label =
              isDateField && v && v !== "(vacío)"
                ? formatDateBucketChipLabel(v, dateGranularity)
                : v || "(vacío)";
            const isOn = activeSet.has(v);
            return (
              <Badge
                key={v || "__empty__"}
                variant={isOn ? "default" : "outline"}
                className={`cursor-pointer font-normal text-[10px] px-2 py-0.5 transition-opacity ${
                  hasFilter && !isOn ? "opacity-45 hover:opacity-80" : "opacity-100"
                }`}
                onClick={() => toggleSlicerMember(config.tableName, config.field, v)}
              >
                {label}
              </Badge>
            );
          })}
        </div>
      </ScrollArea>
      <p className="text-[9px] text-muted-foreground leading-tight">
        Selecciona uno o varios valores (OR). Los no elegidos se atenúan. Afecta al resto de vistas de esta tabla.
      </p>
    </div>
  );
}
