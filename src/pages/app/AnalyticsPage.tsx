import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Database, Plus, Pencil, Trash2, LayoutDashboard, Filter, PanelRight, Wand2 } from "lucide-react";
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
import { DataSourcePivotPanel } from "@/components/integraciones/DataSourcePivotPanel";
import { AnalyticsBoardCanvas, isPivotWidgetPersistedConfig } from "@/components/analytics/AnalyticsBoardCanvas";
import type { BoardWidgetRow } from "@/components/analytics/AnalyticsBoardCanvas";
import { BoardCrossFilterProvider } from "@/contexts/BoardCrossFilterContext";
import { ClearBoardCrossFiltersButton } from "@/components/analytics/ClearBoardCrossFiltersButton";
import { parseHiddenColumnsFromRestrictions } from "@/lib/tenant-data-source-utils";
import { isDateLikeType } from "@/lib/pivot-dates";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import type { Json } from "@/integrations/supabase/types";
import type { BoardFilterWidgetConfig, BoardWidgetLayout, PivotWidgetPersistedConfig } from "@/types/analytics-pivot";
import { isBoardFilterWidgetConfig } from "@/types/analytics-pivot";
import { toast } from "sonner";

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

  const { data: tenantId } = useQuery({
    queryKey: ["user-tenant-id", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_user_tenant", { _user_id: user!.id });
      if (error) throw error;
      return data as string | null;
    },
  });

  const { data: boards = [], isLoading: boardsLoading } = useQuery({
    queryKey: ["analytics-boards", tenantId, user?.id],
    enabled: !!tenantId && !!user?.id,
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
      const { data, error } = await supabase
        .from("analytics_user_boards")
        .insert({
          tenant_id: tenantId!,
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
      queryClient.invalidateQueries({ queryKey: ["analytics-boards", tenantId, user?.id] });
      setSelectedBoardId(id);
      toast.success("Tablero creado");
    },
    onError: () => {
      toast.error("No se pudo crear el tablero. Usa «Nuevo» para intentar de nuevo.");
    },
  });

  useEffect(() => {
    if (!tenantId || !user?.id || boardsLoading) return;
    if (boards.length > 0 || seedAttempted.current) return;
    seedAttempted.current = true;
    createBoard.mutate("Mi tablero");
  }, [tenantId, user?.id, boards, boardsLoading, createBoard]);

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
    mutationFn: async (cfg: PivotWidgetPersistedConfig) => {
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
        widget_type: "pivot",
        title: cfg.chrome?.title?.trim() || cfg.displayName,
        config: cfg as unknown as Json,
        layout: { x: 0, y, w: 6, h: 10, minW: 2, minH: 2 },
        sort_order: existing?.length ?? 0,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["analytics-board-widgets", selectedBoardId] });
      setConstructorSheetOpen(false);
      toast.success("Vista guardada en el tablero");
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
        const l = w.layout as BoardWidgetLayout;
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
      queryClient.invalidateQueries({ queryKey: ["analytics-boards", tenantId, user?.id] });
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
      queryClient.invalidateQueries({ queryKey: ["analytics-boards", tenantId, user?.id] });
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
      addWidget.mutate(cfg);
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
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center">
              <LayoutDashboard className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-display font-bold tracking-tight">Dashboard Dinámicos</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Lienzo amplio y widgets redimensionables. Usa <strong>Crear widget</strong> o el botón flotante para configurar en un panel; opcionalmente fija el <strong>Panel lateral</strong>. En tablas y filtros puedes elegir varios valores; el resto se atenúa.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <Label className="text-xs text-muted-foreground sr-only sm:not-sr-only sm:inline">Tablero activo</Label>
          <Select
            value={selectedBoardId ?? ""}
            onValueChange={(v) => setSelectedBoardId(v)}
            disabled={boardsLoading || !boards.length}
          >
            <SelectTrigger className="h-9 w-[min(100%,220px)] text-xs">
              <SelectValue placeholder={boardsLoading ? "Cargando…" : "Elige tablero"} />
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
            variant="outline"
            className="h-9 gap-1"
            onClick={() => {
              setNewBoardName("Nuevo tablero");
              setNewBoardOpen(true);
            }}
          >
            <Plus className="h-3.5 w-3.5" />
            Nuevo
          </Button>
          <Button size="sm" variant="outline" className="h-9 gap-1" onClick={openRename} disabled={!selectedBoardId}>
            <Pencil className="h-3.5 w-3.5" />
            Renombrar
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-9 gap-1 text-destructive border-destructive/30 hover:bg-destructive/10"
            onClick={() => {
              if (selectedBoardId && confirm("¿Eliminar este tablero y todas sus vistas guardadas?")) {
                deleteBoard.mutate(selectedBoardId);
              }
            }}
            disabled={!selectedBoardId}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Eliminar
          </Button>
          <ClearBoardCrossFiltersButton />
          <Button
            type="button"
            size="sm"
            variant="default"
            className="h-9 gap-1"
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
          <Button
            type="button"
            size="sm"
            variant={constructorDocked ? "secondary" : "outline"}
            className="h-9 gap-1"
            disabled={!selectedPivotSource}
            onClick={() => {
              setConstructorDocked((d) => !d);
              setConstructorSheetOpen(false);
            }}
          >
            <PanelRight className="h-3.5 w-3.5" />
            Panel lateral
          </Button>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="h-9 gap-1"
            disabled={!selectedBoardId || !selectedPivotSource}
            onClick={() => setFilterAddOpen(true)}
          >
            <Filter className="h-3.5 w-3.5" />
            Filtro del tablero
          </Button>
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
            displayName={editBoardWidget?.config.displayName ?? selectedPivotSource.display_name}
            hiddenDataColumns={parseHiddenColumnsFromRestrictions(
              (selectedPivotSource as { restrictions?: unknown }).restrictions,
            )}
            initialConfig={editBoardWidget?.config ?? null}
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
        <SheetContent side="right" className="w-full sm:max-w-2xl p-0 flex flex-col gap-0 overflow-hidden">
          <SheetHeader className="px-4 py-3 border-b border-border shrink-0 space-y-1 text-left">
            <SheetTitle>{editBoardWidget ? "Editar widget" : "Crear widget"}</SheetTitle>
            <SheetDescription>
              Configura y pulsa <strong>Añadir al tablero</strong> o <strong>Guardar cambios</strong>. El panel se cierra al guardar correctamente.
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
                  displayName={editBoardWidget?.config.displayName ?? selectedPivotSource.display_name}
                  hiddenDataColumns={parseHiddenColumnsFromRestrictions(
                    (selectedPivotSource as { restrictions?: unknown }).restrictions,
                  )}
                  initialConfig={editBoardWidget?.config ?? null}
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
    </BoardCrossFilterProvider>
  );
}
