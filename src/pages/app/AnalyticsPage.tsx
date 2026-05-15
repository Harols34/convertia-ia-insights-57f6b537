import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Database, Plus, Pencil, Trash2, LayoutDashboard, Filter, PanelRight, Wand2, Info, Settings, MoreHorizontal, ChevronDown, Share2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DataSourcePivotPanel } from "@/components/integraciones/DataSourcePivotPanel";
import { AnalyticsBoardCanvas, isPivotWidgetPersistedConfig } from "@/components/analytics/AnalyticsBoardCanvas";
import type { BoardWidgetRow } from "@/components/analytics/AnalyticsBoardCanvas";
import { BoardCrossFilterProvider } from "@/contexts/BoardCrossFilterContext";
import { ClearBoardCrossFiltersButton } from "@/components/analytics/ClearBoardCrossFiltersButton";
import { AIConstructorDialog } from "@/components/analytics/AIConstructorDialog";
import { parseHiddenColumnsFromRestrictions } from "@/lib/tenant-data-source-utils";
import { fetchCachedIntegrationRows } from "@/lib/integration-rows-cache";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import type { Json } from "@/integrations/supabase/types";
import type { BoardFilterWidgetConfig, BoardWidgetLayout, PivotWidgetPersistedConfig } from "@/types/analytics-pivot";
import { ANALYTICS_PRESETS } from "@/lib/analytics-presets";
import { isBoardFilterWidgetConfig } from "@/types/analytics-pivot";
import { toast } from "sonner";
import { resolveWritableTenantId } from "@/lib/accessible-tenant";

type BoardRow = {
  id: string;
  name: string;
  sort_order: number;
  created_at: string;
};

export default function AnalyticsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const seedAttempted = useRef(false);

  const [selectedBoardId, setSelectedBoardId] = useState<string | null>(null);
  const [newBoardOpen, setNewBoardOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [newBoardName, setNewBoardName] = useState("Nuevo tablero");
  const [renameValue, setRenameValue] = useState("");
  const [pivotTableName, setPivotTableName] = useState<string>("");
  /** Vista del tablero abierta en el constructor para editar */
  const [editBoardWidget, setEditBoardWidget] = useState<{
    id: string;
    config: PivotWidgetPersistedConfig;
  } | null>(null);
  const [editFilterWidget, setEditFilterWidget] = useState<{
    id: string;
    config: BoardFilterWidgetConfig;
  } | null>(null);
  const [filterAddOpen, setFilterAddOpen] = useState(false);
  const [filterFieldDraft, setFilterFieldDraft] = useState<string>("");
  /** Constructor en panel lateral fijo */
  const [constructorDocked, setConstructorDocked] = useState(false);
  /** Constructor en hoja lateral (modal) */
  const [constructorSheetOpen, setConstructorSheetOpen] = useState(false);
  const [aiConstructorOpen, setAiConstructorOpen] = useState(false);

  const { data: boards = [], isLoading: boardsLoading } = useQuery({
    queryKey: ["analytics-boards", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("analytics_user_boards")
        .select("id, name, sort_order, created_at")
        .order("sort_order", { ascending: false })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as BoardRow[];
    },
  });

  const createBoard = useMutation({
    mutationFn: async (name: string) => {
      const tenantId = await resolveWritableTenantId(user!.id);
      if (!tenantId) throw new Error("No se encontró una cuenta accesible");
      const { data, error } = await supabase
        .from("analytics_user_boards")
        .insert({
          tenant_id: tenantId,
          user_id: user!.id,
          name: name.trim() || "Mi tablero",
          sort_order: 0,
        })
        .select("id")
        .single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: (id) => {
      queryClient.invalidateQueries({ queryKey: ["analytics-boards", user?.id] });
      setSelectedBoardId(id);
      toast.success("Tablero creado");
    },
    onError: () => {
      toast.error("No se pudo crear el tablero. Usa «Nuevo» para intentar de nuevo.");
    },
  });

  useEffect(() => {
    if (!user?.id || boardsLoading) return;
    if (boards.length > 0 || seedAttempted.current) return;
    seedAttempted.current = true;
    
    (async () => {
      try {
        for (const preset of ANALYTICS_PRESETS) {
          const boardId = await createBoard.mutateAsync(preset.name);
          if (!boardId) continue;
          for (const w of preset.widgets) {
            const cfg: PivotWidgetPersistedConfig = {
              tableName: "leads",
              displayName: w.displayName || "Vista",
              viz: w.viz as any,
              rowFields: w.rowFields || [],
              colFields: w.colFields || [],
              measures: w.measures as any,
              chartMeasureId: w.chartMeasureId,
              filters: [],
              layout: w.layout as any,
              appearance: { primaryColor: "#5470c6" }
            };
            await addWidget.mutateAsync({ cfg, boardId });
          }
        }
      } catch (e) {
        console.error("Error seeding dashboards:", e);
      }
    })();
  }, [user?.id, boards, boardsLoading, createBoard]);

  useEffect(() => {
    if (!boards.length) {
      setSelectedBoardId(null);
      return;
    }
    if (!selectedBoardId || !boards.some((b) => b.id === selectedBoardId)) {
      setSelectedBoardId(boards[0].id);
    }
  }, [boards, selectedBoardId]);

  useEffect(() => {
    setEditBoardWidget(null);
    setEditFilterWidget(null);
    setFilterAddOpen(false);
  }, [selectedBoardId]);



  const { data: dashboardSources } = useQuery({
    queryKey: ["data-sources-dashboards"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenant_data_sources")
        .select("id, table_name, display_name, restrictions")
        .eq("is_active", true)
        .eq("allow_dashboards", true)
        .order("priority", { ascending: false });
      if (error) throw error;
      const list = data ?? [];
      if (list.length > 0) return list;
      return [
        {
          id: "00000000-0000-0000-0000-000000000001",
          table_name: "leads",
          display_name: "Leads",
          restrictions: null,
        },
      ];
    },
  });

  // Precarga proactiva en segundo plano
  useEffect(() => {
    if (dashboardSources?.length && user?.id) {
      // Priorizar la fuente seleccionada actualmente
      if (pivotTableName) {
        fetchCachedIntegrationRows(supabase, pivotTableName).catch(() => {});
      }
      // Precarga proactiva en segundo plano de las otras fuentes principales
      dashboardSources.slice(0, 5).forEach((src) => {
        if (src.table_name !== pivotTableName) {
          fetchCachedIntegrationRows(supabase, src.table_name).catch(() => {});
        }
      });
    }
  }, [dashboardSources, user?.id, pivotTableName]);

  const selectedPivotSource = useMemo(() => {
    if (!dashboardSources?.length) return null;
    const found = dashboardSources.find((s) => s.table_name === pivotTableName);
    return found ?? dashboardSources[0];
  }, [dashboardSources, pivotTableName]);

  const filterColsEnabled = (filterAddOpen || !!editFilterWidget) && !!pivotTableName;
  const { data: filterColumnOptions = [] } = useQuery({
    queryKey: ["analytics-filter-columns", pivotTableName],
    enabled: filterColsEnabled,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("list_integration_table_columns", { p_table_name: pivotTableName });
      if (error) throw error;
      return (data ?? []) as { column_name: string; data_type: string; udt_name: string }[];
    },
  });

  const hiddenForBoardFilterUi = useMemo(
    () => parseHiddenColumnsFromRestrictions(selectedPivotSource?.restrictions),
    [selectedPivotSource],
  );

  const filterColumnOptionsVisible = useMemo(
    () => filterColumnOptions.filter((c) => !hiddenForBoardFilterUi.includes(c.column_name)),
    [filterColumnOptions, hiddenForBoardFilterUi],
  );

  useEffect(() => {
    if (editFilterWidget) setFilterFieldDraft(editFilterWidget.config.field);
  }, [editFilterWidget]);

  useEffect(() => {
    if (!filterAddOpen || !filterColumnOptionsVisible.length) return;
    if (!filterFieldDraft || !filterColumnOptionsVisible.some((c) => c.column_name === filterFieldDraft)) {
      setFilterFieldDraft(filterColumnOptionsVisible[0].column_name);
    }
  }, [filterAddOpen, filterColumnOptionsVisible, filterFieldDraft]);

  useEffect(() => {
    if (dashboardSources?.length && !pivotTableName) {
      setPivotTableName(dashboardSources[0].table_name);
    }
  }, [dashboardSources, pivotTableName]);

  const addWidget = useMutation({
    mutationFn: async ({ cfg, boardId }: { cfg: PivotWidgetPersistedConfig; boardId?: string }) => {
      const targetBoardId = boardId || selectedBoardId;
      if (!targetBoardId) throw new Error("Sin tablero");
      
      const { data: existing, error: e1 } = await supabase
        .from("analytics_board_widgets")
        .select("id, layout")
        .eq("board_id", targetBoardId);
      if (e1) throw e1;
      
      let y = 0;
      for (const w of existing ?? []) {
        const l = w.layout as unknown as BoardWidgetLayout;
        y = Math.max(y, (l?.y ?? 0) + (l?.h ?? 0));
      }
      
      const { error } = await supabase.from("analytics_board_widgets").insert({
        board_id: targetBoardId,
        widget_type: "pivot",
        title: cfg.chrome?.title?.trim() || cfg.displayName,
        config: cfg as unknown as Json,
        layout: cfg.layout || { x: 0, y, w: 6, h: 10, minW: 2, minH: 2 },
        sort_order: existing?.length ?? 0,
      });
      if (error) throw error;
    },
    onSuccess: (_, { boardId }) => {
      const targetId = boardId || selectedBoardId;
      queryClient.invalidateQueries({ queryKey: ["analytics-board-widgets", targetId] });
      setConstructorSheetOpen(false);
      if (!boardId) toast.success("Vista guardada en el tablero");
    },
    onError: (e: Error) => toast.error(e.message || "No se pudo guardar el widget"),
  });

  const updateBoardWidget = useMutation({
    mutationFn: async ({
      widgetId,
      config,
    }: {
      widgetId: string;
      config: PivotWidgetPersistedConfig;
    }) => {
      const { error } = await supabase
        .from("analytics_board_widgets")
        .update({
          config: config as unknown as Json,
          title: config.chrome?.title?.trim() || config.displayName.trim() || "Vista dinámica",
          updated_at: new Date().toISOString(),
        })
        .eq("id", widgetId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["analytics-board-widgets", selectedBoardId] });
      setEditBoardWidget(null);
      setConstructorSheetOpen(false);
      toast.success("Vista actualizada en el tablero");
    },
    onError: (e: Error) => toast.error(e.message || "No se pudo actualizar la vista"),
  });

  const addBoardFilterWidget = useMutation({
    mutationFn: async (cfg: BoardFilterWidgetConfig) => {
      if (!selectedBoardId) throw new Error("Sin tablero");
      const { data: existing, error: e1 } = await supabase
        .from("analytics_board_widgets")
        .select("id, layout")
        .eq("board_id", selectedBoardId);
      if (e1) throw e1;
      let y = 0;
      for (const w of existing ?? []) {
        const l = w.layout as unknown as BoardWidgetLayout;
        y = Math.max(y, (l?.y ?? 0) + (l?.h ?? 0));
      }
      const { error } = await supabase.from("analytics_board_widgets").insert({
        board_id: selectedBoardId,
        widget_type: "board_filter",
        title: `Filtro: ${cfg.field}`,
        config: cfg as unknown as Json,
        layout: { x: 0, y, w: 4, h: 5, minW: 2, minH: 2 },
        sort_order: existing?.length ?? 0,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["analytics-board-widgets", selectedBoardId] });
      toast.success("Filtro añadido al tablero");
      setFilterAddOpen(false);
      setFilterFieldDraft("");
    },
    onError: (e: Error) => toast.error(e.message || "No se pudo añadir el filtro"),
  });

  const updateBoardFilterWidget = useMutation({
    mutationFn: async ({ widgetId, cfg }: { widgetId: string; cfg: BoardFilterWidgetConfig }) => {
      const { error } = await supabase
        .from("analytics_board_widgets")
        .update({
          config: cfg as unknown as Json,
          title: `Filtro: ${cfg.field}`,
          updated_at: new Date().toISOString(),
        })
        .eq("id", widgetId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["analytics-board-widgets", selectedBoardId] });
      setEditFilterWidget(null);
      toast.success("Filtro actualizado");
    },
    onError: (e: Error) => toast.error(e.message || "No se pudo guardar"),
  });

  const renameBoard = useMutation({
    mutationFn: async () => {
      if (!selectedBoardId) return;
      const { error } = await supabase
        .from("analytics_user_boards")
        .update({ name: renameValue.trim() || "Sin nombre", updated_at: new Date().toISOString() })
        .eq("id", selectedBoardId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["analytics-boards", user?.id] });
      setRenameOpen(false);
      toast.success("Tablero actualizado");
    },
    onError: () => toast.error("No se pudo renombrar"),
  });

  const deleteBoard = useMutation({
    mutationFn: async (boardId: string) => {
      const { error } = await supabase.from("analytics_user_boards").delete().eq("id", boardId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["analytics-boards", user?.id] });
      setSelectedBoardId(null);
      toast.success("Tablero eliminado");
    },
    onError: () => toast.error("No se pudo eliminar"),
  });

  const handleAddToBoard = useCallback(
    (cfg: PivotWidgetPersistedConfig) => {
      if (!selectedBoardId) {
        toast.error("Selecciona o crea un tablero primero");
        return;
      }
      addWidget.mutate({ cfg });
    },
    [selectedBoardId, addWidget],
  );

  const handleEditWidget = useCallback((row: BoardWidgetRow) => {
    if (row.widget_type === "board_filter" && isBoardFilterWidgetConfig(row.config)) {
      setEditFilterWidget({ id: row.id, config: row.config });
      setEditBoardWidget(null);
      setPivotTableName(row.config.tableName);
      return;
    }
    if (row.widget_type === "pivot" && isPivotWidgetPersistedConfig(row.config)) {
      setEditBoardWidget({ id: row.id, config: row.config });
      setEditFilterWidget(null);
      setPivotTableName(row.config.tableName);
      setConstructorDocked(false);
      setConstructorSheetOpen(true);
    }
  }, []);

  const selectedBoard = boards.find((b) => b.id === selectedBoardId);

  const openRename = () => {
    if (!selectedBoard) return;
    setRenameValue(selectedBoard.name);
    setRenameOpen(true);
  };

  const buildBoardFilterConfig = (): BoardFilterWidgetConfig | null => {
    if (!selectedPivotSource || !filterFieldDraft.trim()) return null;
    const hidden = parseHiddenColumnsFromRestrictions(
      (selectedPivotSource as { restrictions?: unknown }).restrictions,
    );
    const field = filterFieldDraft.trim();
    const col = filterColumnOptions.find((c) => c.column_name === field);
    const isDateCol = col ? isDateLikeType(col.data_type, col.udt_name) : false;
    return {
      version: 1,
      kind: "board_filter",
      tableName: selectedPivotSource.table_name,
      displayName: selectedPivotSource.display_name,
      field,
      ...(isDateCol ? { fieldDateGranularity: "month" as const } : {}),
      hiddenDataColumns: hidden.length ? hidden : undefined,
    };
  };

  return (
    <BoardCrossFilterProvider>
    <div className="flex flex-col lg:flex-row gap-0 items-stretch min-h-[calc(100vh-6rem)]">
      <div className="flex-1 min-w-0 min-h-0 flex flex-col gap-3 lg:pr-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0 bg-background/60 backdrop-blur-md sticky top-0 z-30 py-2 -mx-1 px-1">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl gradient-primary flex items-center justify-center shadow-lg shadow-primary/20">
              <LayoutDashboard className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-display font-bold tracking-tight">Analytics Insights</h1>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-6 w-6 rounded-full text-muted-foreground hover:text-primary">
                      <Info className="h-4 w-4" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80 text-xs space-y-2 p-4">
                    <p className="font-bold text-primary">¿Cómo funciona?</p>
                    <p>Usa <strong>Crear widget</strong> para configurar visualizaciones dinámicas arrastrando campos.</p>
                    <p>Los filtros del tablero (slicers) afectan a todos los widgets de la misma tabla.</p>
                    <p>Puedes redimensionar y mover los widgets libremente en el lienzo.</p>
                  </PopoverContent>
                </Popover>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">Lienzo dinámico para Business Intelligence personalizado.</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              className="h-9 gap-1.5 gradient-primary shadow-sm hover:shadow-md transition-all font-semibold"
              onClick={() => setAiConstructorOpen(true)}
            >
              <Wand2 className="h-3.5 w-3.5" />
              Constructor IA
            </Button>
            <Button
              type="button"
              size="sm"
              variant="default"
              className="h-9 gap-1.5 bg-foreground text-background hover:bg-foreground/90 shadow-sm"
              disabled={!selectedBoardId || !selectedPivotSource}
              onClick={() => {
                setEditBoardWidget(null);
                setConstructorDocked(false);
                setConstructorSheetOpen(true);
              }}
            >
              <Plus className="h-3.5 w-3.5" />
              Crear widget
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0 py-1 border-y border-border/40">
          <div className="flex items-center gap-2">
            <Select
              value={selectedBoardId ?? ""}
              onValueChange={(v) => setSelectedBoardId(v)}
              disabled={boardsLoading || !boards.length}
            >
              <SelectTrigger className="h-8 w-[180px] text-[11px] bg-muted/30 border-none shadow-none focus:ring-0">
                <SelectValue placeholder={boardsLoading ? "Cargando…" : "Tablero..."} />
              </SelectTrigger>
              <SelectContent>
                {boards.map((b) => (
                  <SelectItem key={b.id} value={b.id} className="text-xs">
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Button
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0 rounded-full text-muted-foreground hover:text-primary"
              onClick={() => {
                setNewBoardName("Nuevo tablero");
                setNewBoardOpen(true);
              }}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          <div className="h-4 w-[1px] bg-border mx-1" />

          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-8 gap-1.5 text-[11px] font-medium"
            disabled={!selectedBoardId || !selectedPivotSource}
            onClick={() => setFilterAddOpen(true)}
          >
            <Filter className="h-3.5 w-3.5 text-muted-foreground" />
            Filtro de Board
          </Button>

          <div className="flex-1" />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 gap-1.5 text-[11px] border-border/60">
                <Settings className="h-3.5 w-3.5" />
                Acciones
                <ChevronDown className="h-3 w-3 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={openRename} disabled={!selectedBoardId}>
                <Pencil className="mr-2 h-4 w-4" />
                Renombrar
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => {
                  setConstructorDocked((d) => !d);
                  setConstructorSheetOpen(false);
                }}
                disabled={!selectedPivotSource}
              >
                <PanelRight className="mr-2 h-4 w-4" />
                {constructorDocked ? "Ocultar panel lateral" : "Mostrar panel lateral"}
              </DropdownMenuItem>
              <DropdownMenuItem className="text-primary">
                <Share2 className="mr-2 h-4 w-4" />
                Compartir tablero
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:bg-destructive/10"
                onClick={() => {
                  if (selectedBoardId && confirm("¿Eliminar este tablero y todas sus vistas guardadas?")) {
                    deleteBoard.mutate(selectedBoardId);
                  }
                }}
                disabled={!selectedBoardId}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Eliminar tablero
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex items-center justify-between gap-4 px-1 shrink-0">
          <div className="flex-1 overflow-hidden">
            <div className="flex flex-wrap items-center gap-1.5">
              <ClearBoardCrossFiltersButton />
            </div>
          </div>
        </div>

        <AnalyticsBoardCanvas boardId={selectedBoardId} className="flex-1" onEditWidget={handleEditWidget} />

        {!constructorDocked && (
          <Button
            type="button"
            size="lg"
            className="fixed bottom-5 right-5 z-40 h-12 rounded-full shadow-lg gap-2 px-5 font-medium"
            disabled={!selectedBoardId || !selectedPivotSource}
            onClick={() => {
              setEditBoardWidget(null);
              setConstructorSheetOpen(true);
            }}
          >
            <Wand2 className="h-4 w-4" />
            Constructor
          </Button>
        )}
      </div>

      {constructorDocked && selectedPivotSource ? (
        <div className="shrink-0 w-full lg:w-auto lg:max-w-[min(440px,100%)] flex flex-col border-t lg:border-t-0 lg:border-l border-border bg-card/40 min-h-[50vh] lg:min-h-0">
          <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-border">
            <div className="flex items-center gap-2 text-xs text-muted-foreground min-w-0">
              <Database className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">Constructor fijo</span>
            </div>
            <Button type="button" variant="ghost" size="sm" className="h-8 text-xs shrink-0" onClick={() => setConstructorDocked(false)}>
              Ocultar
            </Button>
          </div>
          <div className="px-3 pt-2 pb-2 border-b border-border space-y-1">
            <Label className="text-[11px] text-muted-foreground">Tabla</Label>
            <Select
              value={selectedPivotSource.table_name}
              onValueChange={(v) => {
                setPivotTableName(v);
                setEditBoardWidget(null);
                setEditFilterWidget(null);
              }}
            >
              <SelectTrigger className="h-9 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {dashboardSources?.map((s) => (
                  <SelectItem key={s.id} value={s.table_name} className="text-xs">
                    {s.display_name}{" "}
                    <span className="text-muted-foreground font-mono">({s.table_name})</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DataSourcePivotPanel
            key={`${selectedPivotSource.table_name}-${editBoardWidget?.id ?? "new"}-dock`}
            tableName={selectedPivotSource.table_name}
            displayName={(editBoardWidget?.config as any)?.displayName ?? selectedPivotSource.display_name}
            hiddenDataColumns={parseHiddenColumnsFromRestrictions(
              (selectedPivotSource as { restrictions?: unknown }).restrictions,
            )}
            initialConfig={editBoardWidget?.config as any ?? null}
            boardWidgetId={editBoardWidget?.id ?? null}
            onUpdateBoardWidget={(widgetId, cfg) => updateBoardWidget.mutate({ widgetId, config: cfg })}
            onCancelBoardEdit={() => setEditBoardWidget(null)}
            boardSavePending={updateBoardWidget.isPending}
            onClose={() => {}}
            showCloseButton={false}
            onAddToBoard={handleAddToBoard}
            layoutVariant="sidebar"
          />
        </div>
      ) : null}

      <Sheet
        open={constructorSheetOpen}
        onOpenChange={(open) => {
          setConstructorSheetOpen(open);
          if (!open) setEditBoardWidget(null);
        }}
      >
        <SheetContent side="right" className="w-full sm:max-w-5xl p-0 flex flex-col gap-0 overflow-hidden border-l border-border/50 shadow-2xl">
          <SheetHeader className="px-6 py-4 border-b border-border bg-muted/20 shrink-0 space-y-1 text-left">
            <SheetTitle className="text-xl font-bold">{editBoardWidget ? "Personalizar Widget" : "Constructor de Visualizaciones"}</SheetTitle>
            <SheetDescription className="text-xs">
              Arrastra los campos a las zonas de configuración para crear tu vista. Los cambios se reflejarán instantáneamente.
            </SheetDescription>
          </SheetHeader>
          {selectedPivotSource ? (
            <>
              <div className="px-4 py-2 border-b border-border space-y-1 shrink-0">
                <Label className="text-[11px] text-muted-foreground">Tabla de datos</Label>
                <Select
                  value={selectedPivotSource.table_name}
                  onValueChange={(v) => {
                    setPivotTableName(v);
                    setEditBoardWidget(null);
                    setEditFilterWidget(null);
                  }}
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {dashboardSources?.map((s) => (
                      <SelectItem key={s.id} value={s.table_name} className="text-xs">
                        {s.display_name}{" "}
                        <span className="text-muted-foreground font-mono">({s.table_name})</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
                <DataSourcePivotPanel
                  key={`${selectedPivotSource.table_name}-${editBoardWidget?.id ?? "new"}-sheet`}
                  tableName={selectedPivotSource.table_name}
                  displayName={(editBoardWidget?.config as any)?.displayName ?? selectedPivotSource.display_name}
                  hiddenDataColumns={parseHiddenColumnsFromRestrictions(
                    (selectedPivotSource as { restrictions?: unknown }).restrictions,
                  )}
                  initialConfig={editBoardWidget?.config as any ?? null}
                  boardWidgetId={editBoardWidget?.id ?? null}
                  onUpdateBoardWidget={(widgetId, cfg) => updateBoardWidget.mutate({ widgetId, config: cfg })}
                  onCancelBoardEdit={() => {
                    setEditBoardWidget(null);
                    setConstructorSheetOpen(false);
                  }}
                  boardSavePending={updateBoardWidget.isPending}
                  showCloseButton={false}
                  onClose={() => {
                    setEditBoardWidget(null);
                    setConstructorSheetOpen(false);
                  }}
                  onAddToBoard={handleAddToBoard}
                  layoutVariant="sheet"
                />
              </div>
            </>
          ) : (
            <p className="p-4 text-sm text-muted-foreground">No hay fuentes con dashboards activos.</p>
          )}
        </SheetContent>
      </Sheet>

      <Dialog open={newBoardOpen} onOpenChange={setNewBoardOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Nuevo tablero</DialogTitle>
            <DialogDescription>Cada tablero es solo tuyo; empieza vacío y añade vistas con el constructor.</DialogDescription>
          </DialogHeader>
          <Input value={newBoardName} onChange={(e) => setNewBoardName(e.target.value)} placeholder="Nombre" className="h-9" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewBoardOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => {
                createBoard.mutate(newBoardName);
                setNewBoardOpen(false);
              }}
            >
              Crear
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Renombrar tablero</DialogTitle>
          </DialogHeader>
          <Input value={renameValue} onChange={(e) => setRenameValue(e.target.value)} className="h-9" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => renameBoard.mutate()}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={filterAddOpen} onOpenChange={setFilterAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Añadir filtro al tablero</DialogTitle>
            <DialogDescription>
              Los valores que elijas aquí aplican a todas las vistas de la tabla <strong>{selectedPivotSource?.display_name}</strong> en este
              tablero (filtros cruzados).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label className="text-xs">Campo</Label>
            <Select value={filterFieldDraft} onValueChange={setFilterFieldDraft}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Elegir columna" />
              </SelectTrigger>
              <SelectContent>
                {filterColumnOptionsVisible.map((c) => (
                  <SelectItem key={c.column_name} value={c.column_name} className="text-xs font-mono">
                    {c.column_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFilterAddOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => {
                const cfg = buildBoardFilterConfig();
                if (!cfg) {
                  toast.error("Elige un campo");
                  return;
                }
                addBoardFilterWidget.mutate(cfg);
              }}
              disabled={addBoardFilterWidget.isPending}
            >
              Añadir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editFilterWidget} onOpenChange={(o) => !o && setEditFilterWidget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar filtro del tablero</DialogTitle>
            <DialogDescription>Cambia el campo usado como control de filtro.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label className="text-xs">Campo</Label>
            <Select value={filterFieldDraft} onValueChange={setFilterFieldDraft}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Elegir columna" />
              </SelectTrigger>
              <SelectContent>
                {filterColumnOptionsVisible.map((c) => (
                  <SelectItem key={c.column_name} value={c.column_name} className="text-xs font-mono">
                    {c.column_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditFilterWidget(null)}>
              Cancelar
            </Button>
            <Button
              onClick={() => {
                if (!editFilterWidget) return;
                const cfg = buildBoardFilterConfig();
                if (!cfg) {
                  toast.error("Elige un campo");
                  return;
                }
                updateBoardFilterWidget.mutate({ widgetId: editFilterWidget.id, cfg });
              }}
              disabled={updateBoardFilterWidget.isPending}
            >
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
      <AIConstructorDialog
        open={aiConstructorOpen}
        onOpenChange={setAiConstructorOpen}
        onGenerate={async (proposal) => {
          try {
            const boardId = await createBoard.mutateAsync(proposal.name);
            if (!boardId) return;
            for (const w of proposal.widgets) {
              await addWidget.mutateAsync({ cfg: w, boardId });
            }
          } catch (e) {
            console.error(e);
          }
        }}
        tableName={pivotTableName}
        availableColumns={filterColumnOptionsVisible.map(c => c.column_name)}
      />
    </BoardCrossFilterProvider>
  );
}
