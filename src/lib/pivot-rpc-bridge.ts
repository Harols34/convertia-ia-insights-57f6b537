import { PivotFilter, PivotGridResult, PivotMeasureSpec } from "@/lib/pivot-engine";
import { PivotVizType, PivotWidgetPersistedConfig } from "@/types/analytics-pivot";

export interface AggregateQuery {
  groupBy: string[];
  measures: {
    agg: string;
    field: string;
    alias: string;
  }[];
  filters: {
    field: string;
    op: string;
    values: any[];
  }[];
  dateGranularity?: Record<string, string>;
  orderBy?: string;
  orderDir?: "asc" | "desc";
  limit?: number;
}

/**
 * Translates the old 'Pivot' configuration into parameters for the high-performance RPC.
 */
export function translatePivotConfigToRpc(config: PivotWidgetPersistedConfig): AggregateQuery {
  const groupBy = [...config.rowFields, ...config.colFields];
  
  const measures = config.measures.map(m => {
    if (m.kind === 'field') {
      return {
        agg: m.aggregation === 'countDistinct' ? 'count_distinct' : m.aggregation,
        field: m.field,
        alias: m.id // We use the ID as alias to match back easily
      };
    }
    // For calculated measures, we'll need to fetch the dependencies
    // Simplification: the RPC doesn't do calculations yet, we do them client-side on the aggregated result
    return null;
  }).filter(Boolean) as any[];

  const filters = Object.entries(config.filterSelections ?? {}).map(([field, values]) => ({
    field,
    op: 'in',
    values
  }));

  return {
    groupBy,
    measures,
    filters,
    dateGranularity: config.fieldDateGranularity as any,
    limit: 1000
  };
}

const PIVOT_KEY_SEP = "\u0001";

/**
 * Reconstructs a 'PivotGridResult' object (the one expected by the old UI) 
 * from the flat result of the server-side aggregation.
 */
export function buildGridFromAggregatedData(
  data: any[], 
  config: PivotWidgetPersistedConfig
): PivotGridResult {
  const { rowFields, colFields, measures } = config;
  
  const rowKeysSet = new Set<string>();
  const colKeysSet = new Set<string>();
  
  const cells = new Map<string, Map<string, Map<string, number>>>();
  const rowLabels = new Map<string, string[]>();
  const colLabels = new Map<string, string[]>();

  data.forEach(row => {
    const rParts = rowFields.map(f => String(row[f] ?? '(vacío)'));
    const cParts = colFields.map(f => String(row[f] ?? '(vacío)'));
    
    const rowKey = rParts.join(PIVOT_KEY_SEP);
    const colKey = cParts.join(PIVOT_KEY_SEP) || 'Total';
    
    rowKeysSet.add(rowKey);
    colKeysSet.add(colKey);
    
    rowLabels.set(rowKey, rParts);
    colLabels.set(colKey, cParts.length ? cParts : ['Total']);

    if (!cells.has(rowKey)) cells.set(rowKey, new Map());
    const colMap = cells.get(rowKey)!;
    
    if (!colMap.has(colKey)) colMap.set(colKey, new Map());
    const measureMap = colMap.get(colKey)!;
    
    // Extract measure values
    measures.forEach(m => {
      measureMap.set(m.id, Number(row[m.id] ?? 0));
    });
  });

  return {
    rowKeys: Array.from(rowKeysSet).sort(),
    colKeys: Array.from(colKeysSet).sort(),
    cells,
    rowLabels,
    colLabels
  };
}
