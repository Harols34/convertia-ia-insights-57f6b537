import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Wand2, Sparkles, CheckCircle2, ChevronRight, Layout } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { PivotWidgetPersistedConfig, PivotVizType } from "@/types/analytics-pivot";
import { toast } from "sonner";

interface AIConstructorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGenerate: (dashboard: { name: string; widgets: PivotWidgetPersistedConfig[] }) => void;
  tableName: string;
  availableColumns: string[];
}

export function AIConstructorDialog({
  open,
  onOpenChange,
  onGenerate,
  tableName,
  availableColumns,
}: AIConstructorDialogProps) {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [proposal, setProposal] = useState<{
    name: string;
    description: string;
    widgets: any[];
  } | null>(null);

  const handleSuggest = async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    
    // Simulación de "IA" basada en heurísticas y palabras clave
    setTimeout(() => {
      const p = prompt.toLowerCase();
      let name = "Dashboard Analítico";
      let description = "Generado según tu solicitud";
      const widgets: any[] = [];

      const col = (name: string) => availableColumns.includes(name) ? name : availableColumns[0];

      if (p.includes("venta") || p.includes("comercial") || p.includes("negocio")) {
        name = "Dashboard de Ventas y Negocios";
        description = "Análisis enfocado en cierre de ventas y rendimiento comercial.";
        widgets.push(
          { type: "card", label: "Total Ventas", field: col("es_venta"), agg: "sum", w: 3, h: 2 },
          { type: "card", label: "Tasa Conversión", field: col("es_venta"), agg: "avg", w: 3, h: 2 },
          { type: "bar_horizontal", label: "Ventas por Campaña", field: col("campana_mkt"), measure: col("es_venta"), agg: "sum", w: 6, h: 4 },
          { type: "ranking_vertical", label: "Top Agentes", field: col("agente_negocio"), measure: col("es_venta"), agg: "sum", w: 6, h: 4 },
          { type: "line", label: "Evolución Ventas", field: col("fch_creacion"), measure: col("es_venta"), agg: "sum", w: 12, h: 4 }
        );
      } else if (p.includes("marketing") || p.includes("campaña") || p.includes("lead")) {
        name = "Dashboard de Marketing y Leads";
        description = "Seguimiento de campañas y generación de leads.";
        widgets.push(
          { type: "card", label: "Total Leads", field: col("id_lead"), agg: "count", w: 3, h: 2 },
          { type: "donut", label: "Leads por Campaña", field: col("campana_mkt"), measure: col("id_lead"), agg: "count", w: 5, h: 4 },
          { type: "treemap", label: "Origen (Keywords)", field: col("keyword"), measure: col("id_lead"), agg: "count", w: 7, h: 4 },
          { type: "area", label: "Tendencia Leads", field: col("fch_creacion"), measure: col("id_lead"), agg: "count", w: 12, h: 4 }
        );
      } else if (p.includes("agente") || p.includes("operativo") || p.includes("gestión")) {
        name = "Dashboard Operativo de Agentes";
        description = "Rendimiento diario y gestiones operativas.";
        widgets.push(
          { type: "card", label: "Gestiones Totales", field: col("id_lead"), agg: "count", w: 4, h: 2 },
          { type: "bar", label: "Gestión por Agente", field: col("agente_ultim_gestion"), measure: col("id_lead"), agg: "count", w: 8, h: 4 },
          { type: "funnel", label: "Embudo de Gestión", field: col("result_ultim_gestion"), measure: col("id_lead"), agg: "count", w: 6, h: 4 },
          { type: "ranking_horizontal", label: "Ranking Agentes", field: col("agente_prim_gestion"), measure: col("id_lead"), agg: "count", w: 6, h: 4 }
        );
      } else {
        name = "Dashboard de Exploración";
        description = "Vista general de los datos disponibles.";
        widgets.push(
          { type: "card", label: "Muestra de Datos", field: col("id_lead"), agg: "count", w: 4, h: 2 },
          { type: "bar", label: "Distribución por Ciudad", field: col("ciudad"), measure: col("id_lead"), agg: "count", w: 8, h: 4 },
          { type: "line", label: "Registros en el Tiempo", field: col("fch_creacion"), measure: col("id_lead"), agg: "count", w: 12, h: 4 }
        );
      }

      setProposal({ name, description, widgets });
      setLoading(false);
    }, 1500);
  };

  const executeGeneration = () => {
    if (!proposal) return;
    
    const formattedWidgets: PivotWidgetPersistedConfig[] = proposal.widgets.map((w, i) => ({
      version: 1,
      tableName,
      displayName: w.label,
      viz: w.type as PivotVizType,
      rowFields: w.field ? [w.field] : [],
      colFields: [],
      filterFields: [],
      filterSelections: {},
      fieldDateGranularity: {},
      measures: [
        {
          id: `m-${i}`,
          kind: "field",
          field: w.measure || w.field,
          aggregation: w.agg,
          label: w.label,
          showAs: "none"
        }
      ],
      chartMeasureId: `m-${i}`,
      layout: { i: `ai-${i}`, x: (i % 2) * 6, y: Math.floor(i / 2) * 4, w: w.w, h: w.h },
      appearance: { primaryColor: "#5470c6", borderRadiusPx: 12, showLegend: true, showGridLines: true }
    }));

    onGenerate({ name: proposal.name, widgets: formattedWidgets });
    onOpenChange(false);
    setProposal(null);
    setPrompt("");
    toast.success("¡Dashboard generado con éxito!");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] bg-card border-border shadow-2xl">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <div className="p-1.5 rounded-md bg-primary/10 text-primary">
              <Wand2 className="h-5 w-5" />
            </div>
            <DialogTitle className="text-xl">Constructor IA</DialogTitle>
          </div>
          <DialogDescription>
            Describe el tablero que necesitas y la IA propondrá una estructura optimizada basada en tus campos disponibles.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {!proposal ? (
            <div className="space-y-3">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">¿Qué quieres analizar hoy?</Label>
              <Textarea
                placeholder="Ej: Quiero un dashboard ejecutivo de ventas por campaña y agente..."
                className="min-h-[120px] text-sm resize-none focus-visible:ring-primary/30"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
              />
              <div className="flex flex-wrap gap-2">
                {["Dashboard de Ventas", "Análisis de Marketing", "Rendimiento de Agentes"].map((s) => (
                  <Badge
                    key={s}
                    variant="secondary"
                    className="cursor-pointer hover:bg-muted py-1"
                    onClick={() => setPrompt(`Genera un ${s.toLowerCase()}`)}
                  >
                    {s}
                  </Badge>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.02] space-y-2">
                <div className="flex items-center gap-2 text-emerald-600 font-bold">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Propuesta Generada</span>
                </div>
                <h3 className="text-lg font-bold">{proposal.name}</h3>
                <p className="text-xs text-muted-foreground">{proposal.description}</p>
                
                <div className="grid grid-cols-2 gap-2 mt-4">
                  {proposal.widgets.map((w, i) => (
                    <div key={i} className="flex items-center gap-2 p-2 rounded-md bg-background border border-border/50 text-[10px]">
                      <Layout className="h-3 w-3 text-muted-foreground" />
                      <span className="font-medium truncate">{w.label}</span>
                      <Badge variant="outline" className="ml-auto text-[8px] h-3.5 px-1 uppercase">{w.type.split('_')[0]}</Badge>
                    </div>
                  ))}
                </div>
              </div>
              <Button variant="ghost" size="sm" className="text-xs text-muted-foreground" onClick={() => setProposal(null)}>
                ← Cambiar solicitud
              </Button>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          {!proposal ? (
            <Button onClick={handleSuggest} disabled={loading || !prompt.trim()} className="gap-2 shadow-lg shadow-primary/20">
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Analizando campos...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Proponer Tablero
                </>
              )}
            </Button>
          ) : (
            <Button onClick={executeGeneration} className="gap-2 shadow-lg shadow-emerald-500/20 bg-emerald-600 hover:bg-emerald-700">
              <ChevronRight className="h-4 w-4" />
              Crear Dashboard
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
