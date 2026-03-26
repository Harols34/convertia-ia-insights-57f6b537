import { useCallback, useEffect, useMemo, useRef, type CSSProperties } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import GridLayout, { type Layout, type LayoutItem, WidthProvider } from "react-grid-layout/legacy";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { PivotBoardWidget } from "./PivotBoardWidget";
import { BoardFilterWidget } from "./BoardFilterWidget";
import type { BoardWidgetLayout, PivotWidgetPersistedConfig, WidgetAppearance } from "@/types/analytics-pivot";
import { isBoardFilterWidgetConfig } from "@/types/analytics-pivot";
import { cn } from "@/lib/utils";
import { parseHiddenColumnsFromRestrictions } from "@/lib/tenant-data-source-utils";
import { boardWidgetChromeShowsHeader, coalesceWidgetChrome, sanitizeWidgetAppearance } from "@/lib/widget-appearance-utils";

const Grid = WidthProvider(GridLayout);

export interface BoardWidgetRow {
  id: string;
  board_id: string;
  widget_type: string;
  title: string | null;
  config: unknown;
  layout: unknown;
}

export function isPivotWidgetPersistedConfig(c: unknown): c is PivotWidgetPersistedConfig {
  return (
    typeof c === "object" &&
    c !== null &&
    (c as PivotWidgetPersistedConfig).version === 1 &&
    "viz" in c
  );
}

function widgetHeaderMeta(w: BoardWidgetRow): { show: boolean; title: string } {
  const cfg = w.config;
  const fallback = (w.title ?? "").trim();
  /** Cabecera: no depender solo del type guard (configs antiguos o campos mínimos). */
  if (w.widget_type === "pivot" && cfg && typeof cfg === "object") {
    const o = cfg as Record<string, unknown>;
    const displayName = typeof o.displayName === "string" ? o.displayName.trim() : "";
    const chrome = coalesceWidgetChrome(o.chrome);
    return {
      show: boardWidgetChromeShowsHeader(o.chrome),
      title: chrome?.title?.trim() || fallback || displayName || "Vista",
    };
  }
  if (w.widget_type === "board_filter" && cfg && typeof cfg === "object") {
    const o = cfg as Record<string, unknown>;
    if (o.kind === "board_filter") {
      const displayName = typeof o.displayName === "string" ? o.displayName.trim() : "";
      const chrome = coalesceWidgetChrome(o.chrome);
      return {
        show: boardWidgetChromeShowsHeader(o.chrome),
        title: chrome?.title?.trim() || fallback || displayName || "Filtro",
      };
    }
  }
  return { show: true, title: fallback || "Widget" };
}

function pivotCardSurface(appearance: WidgetAppearance | undefined | null): CSSProperties {
  const a = sanitizeWidgetAppearance(appearance);
  if (!a) return {};
  return {
    ...(a.backgroundColor ? { backgroundColor: a.backgroundColor } : {}),
    ...(a.borderRadiusPx != null ? { borderRadius: a.borderRadiusPx } : {}),
  };
}

function toLayout(l: unknown, id: string): LayoutItem {
  const o = (l && typeof l === "object" ? l : {}) as BoardWidgetLayout;
  return {
    i: id,
    x: typeof o.x === "number" ? o.x : 0,
    y: typeof o.y === "number" ? o.y : 0,
    w: typeof o.w === "number" ? o.w : 6,
    h: typeof o.h === "number" ? o.h : 10,
    minW: typeof o.minW === "number" ? o.minW : 2,
    minH: typeof o.minH === "number" ? o.minH : 2,
  };
}

interface AnalyticsBoardCanvasProps {
  boardId: string | null;
  className?: string;
  /** Abre el constructor lateral con la configuración de este widget */
  onEditWidget?: (row: BoardWidgetRow) => void;
}

export function AnalyticsBoardCanvas({ boardId, className, onEditWidget }: AnalyticsBoardCanvasProps) {
  const queryClient = useQueryClient();
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: widgets = [], isLoading } = useQuery({
    queryKey: ["analytics-board-widgets", boardId],
    enabled: !!boardId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("analytics_board_widgets")
        .select("*")
        .eq("board_id", boardId!)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as BoardWidgetRow[];
    },
  });

  const { data: hiddenColumnsByTable = {} } = useQuery({
    queryKey: ["tenant-data-sources-hidden-by-table"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenant_data_sources")
        .select("table_name, restrictions")
        .eq("is_active", true);
      if (error) throw error;
      const out: Record<string, string[]> = {};
      for (const row of data ?? []) {
        if (typeof row.table_name === "string") {
          out[row.table_name] = parseHiddenColumnsFromRestrictions(row.restrictions);
        }
      }
      return out;
    },
  });

  const layout: LayoutItem[] = useMemo(() => widgets.map((w) => toLayout(w.layout, w.id)), [widgets]);

  const persistLayout = useMutation({
    mutationFn: async (items: LayoutItem[]) => {
      await Promise.all(
        items.map((l) =>
          supabase
            .from("analytics_board_widgets")
            .update({
              layout: {
                x: l.x,
                y: l.y,
                w: l.w,
                h: l.h,
                minW: l.minW ?? 2,
                minH: l.minH ?? 2,
              },
              updated_at: new Date().toISOString(),
            })
            .eq("id", l.i),
        ),
      );
    },
  });

  const onLayoutChange = useCallback(
    (next: LayoutItem[]) => {
      if (!boardId || !next.length) return;
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        persistLayout.mutate(next);
      }, 650);
    },
    [boardId, persistLayout],
  );

  const deleteWidget = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("analytics_board_widgets").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["analytics-board-widgets", boardId] });
    },
  });

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  if (!boardId) {
    return (
      <div
        className={cn(
          "flex-1 rounded-xl border border-dashed border-border bg-muted/10 flex items-center justify-center p-8 text-center text-sm text-muted-foreground",
          className,
        )}
      >
        Crea o elige un tablero para empezar. El lienzo quedará en blanco hasta que añadas vistas desde el panel derecho.
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className={cn("flex-1 rounded-xl border border-border bg-card/30 flex items-center justify-center min-h-[280px]", className)}>
        <span className="text-sm text-muted-foreground">Cargando tablero…</span>
      </div>
    );
  }

  if (widgets.length === 0) {
    return (
      <div
        className={cn(
          "flex-1 rounded-xl border border-dashed border-border bg-background flex items-center justify-center p-8 min-h-[320px]",
          className,
        )}
      >
        <div className="max-w-md text-center space-y-2">
          <p className="text-sm font-medium text-foreground">Tablero vacío</p>
          <p className="text-xs text-muted-foreground">
            Construye una vista en el panel derecho (elige el tipo de gráfico primero, luego los campos que aplican) y pulsa{" "}
            <strong>Añadir al tablero</strong>. Usa <strong>Filtro del tablero</strong> para controles globales y haz clic en filas o gráficos para
            filtrar el resto. Redimensiona cada bloque libremente; si lo reduces mucho, el contenido hará scroll.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex-1 min-h-0 min-w-0 rounded-xl border border-border bg-muted/5 p-2 overflow-auto", className)}>
      <Grid
          className="layout"
          layout={layout}
          cols={12}
          rowHeight={28}
          margin={[10, 10]}
          containerPadding={[0, 0]}
          onLayoutChange={onLayoutChange}
          draggableHandle=".drag-handle"
          compactType="vertical"
          preventCollision={false}
        >
          {widgets.map((w) => {
            const cfg = w.config;
            const canEdit =
              onEditWidget &&
              ((w.widget_type === "pivot" && isPivotWidgetPersistedConfig(w.config)) ||
                (w.widget_type === "board_filter" && isBoardFilterWidgetConfig(w.config)));
            const { show: showHead, title: headTitle } = widgetHeaderMeta(w);
            const pivotSurface =
              w.widget_type === "pivot" && cfg && typeof cfg === "object"
                ? pivotCardSurface((cfg as { appearance?: WidgetAppearance }).appearance)
                : {};
            const hasCustomRadius = pivotSurface.borderRadius !== undefined;
            const actionBtns = (
              <div className="flex items-center shrink-0 gap-0.5">
                {canEdit && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 cursor-pointer"
                    onClick={() => onEditWidget(w)}
                    aria-label="Editar widget"
                    title="Editar widget"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0 cursor-pointer"
                  onClick={() => deleteWidget.mutate(w.id)}
                  aria-label="Eliminar widget"
                >
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
              </div>
            );
            return (
              <div
                key={w.id}
                className={cn(
                  "relative border border-border shadow-sm flex flex-col overflow-hidden min-h-0",
                  !pivotSurface.backgroundColor && "bg-card",
                  !hasCustomRadius && "rounded-xl",
                )}
                style={pivotSurface}
              >
                {showHead ? (
                  <div className="flex items-center justify-between gap-2 px-2 py-1.5 border-b border-border/80 bg-muted/30 shrink-0">
                    <span className="drag-handle flex-1 min-w-0 text-xs font-semibold tracking-tight truncate cursor-grab active:cursor-grabbing py-0.5">
                      {headTitle}
                    </span>
                    {actionBtns}
                  </div>
                ) : (
                  <>
                    <div
                      className="drag-handle shrink-0 h-2.5 w-full cursor-grab active:cursor-grabbing bg-muted/50 hover:bg-muted/70 border-b border-border/40"
                      title="Arrastrar"
                    />
                    <div className="absolute top-1 right-1 z-20">{actionBtns}</div>
                  </>
                )}
                <div
                  className={cn(
                    "flex-1 min-h-[64px] min-w-0 flex flex-col overflow-hidden",
                    showHead ? "p-2" : "p-2 pt-1 relative",
                  )}
                  style={{ maxHeight: "100%" }}
                >
                  {w.widget_type === "pivot" && isPivotWidgetPersistedConfig(cfg) ? (
                    <div className="flex-1 min-h-0 min-w-0 flex flex-col">
                      <PivotBoardWidget
                        config={cfg}
                        sourceHiddenColumns={hiddenColumnsByTable[cfg.tableName]}
                      />
                    </div>
                  ) : w.widget_type === "board_filter" && isBoardFilterWidgetConfig(cfg) ? (
                    <BoardFilterWidget
                      config={cfg}
                      sourceHiddenColumns={hiddenColumnsByTable[cfg.tableName]}
                    />
                  ) : (
                    <p className="text-[10px] text-muted-foreground">Tipo de widget no soportado</p>
                  )}
                </div>
              </div>
            );
          })}
        </Grid>
    </div>
  );
}
