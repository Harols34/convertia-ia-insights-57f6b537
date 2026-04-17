import { useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Download, Image as ImageIcon, FileSpreadsheet } from "lucide-react";
import { toPng } from "html-to-image";
import * as XLSX from "xlsx";
import type { DashboardData } from "@/types/dashdinamics";

interface DashboardExportBarProps {
  containerRef: React.RefObject<HTMLDivElement>;
  dashboard: DashboardData;
}

export function DashboardExportBar({ containerRef, dashboard }: DashboardExportBarProps) {
  const exportPng = useCallback(async () => {
    if (!containerRef.current) return;
    try {
      const dataUrl = await toPng(containerRef.current, {
        backgroundColor: "#0f1729",
        pixelRatio: 2,
        filter: (node) => {
          // Skip export bar itself
          if ((node as HTMLElement)?.dataset?.exportBar === "true") return false;
          return true;
        },
      });
      const link = document.createElement("a");
      link.download = `${(dashboard.title || "dashboard").replace(/\s+/g, "_")}.png`;
      link.href = dataUrl;
      link.click();
    } catch (e) {
      console.error("Export PNG failed:", e);
    }
  }, [containerRef, dashboard]);

  const exportExcel = useCallback(() => {
    const wb = XLSX.utils.book_new();

    // KPIs sheet
    if (dashboard.kpis?.length) {
      const kpiData = dashboard.kpis.map((k) => ({
        Indicador: k.label,
        Valor: k.value,
        Variación: k.change ?? "",
        Tendencia: k.trend ?? "",
      }));
      const ws = XLSX.utils.json_to_sheet(kpiData);
      XLSX.utils.book_append_sheet(wb, ws, "KPIs");
    }

    // Tables
    if (dashboard.tables?.length) {
      dashboard.tables.forEach((t, i) => {
        const headers = Array.isArray(t.headers) ? t.headers : [];
        const rows = Array.isArray(t.rows) ? t.rows : [];
        const sheetData = [headers, ...rows];
        const ws = XLSX.utils.aoa_to_sheet(sheetData);
        XLSX.utils.book_append_sheet(wb, ws, (t.title || `Tabla_${i + 1}`).slice(0, 31));
      });
    }

    // Charts data as tables
    if (dashboard.charts?.length) {
      dashboard.charts.forEach((c, i) => {
        const cfg = c.config as any;
        const series = cfg?.series;
        if (!series || !Array.isArray(series)) return;
        const xData = cfg?.xAxis?.data;
        if (Array.isArray(xData) && series[0]?.data) {
          const sheetRows = [
            ["Categoría", ...series.map((s: any) => s.name || `Serie ${i}`)],
            ...xData.map((x: string, j: number) => [
              x,
              ...series.map((s: any) => s.data?.[j] ?? ""),
            ]),
          ];
          const ws = XLSX.utils.aoa_to_sheet(sheetRows);
          XLSX.utils.book_append_sheet(wb, ws, (c.title || `Chart_${i + 1}`).slice(0, 31));
        }
      });
    }

    // Insights
    if (dashboard.insights?.length) {
      const insightData = dashboard.insights.map((ins, i) => ({
        "#": i + 1,
        Tipo: ins.type,
        Título: ins.title,
        Descripción: ins.description,
      }));
      const ws = XLSX.utils.json_to_sheet(insightData);
      XLSX.utils.book_append_sheet(wb, ws, "Insights");
    }

    if (wb.SheetNames.length === 0) {
      const ws = XLSX.utils.aoa_to_sheet([["Sin datos para exportar"]]);
      XLSX.utils.book_append_sheet(wb, ws, "Info");
    }

    XLSX.writeFile(wb, `${(dashboard.title || "dashboard").replace(/\s+/g, "_")}.xlsx`);
  }, [dashboard]);

  return (
    <div className="flex items-center gap-2" data-export-bar="true">
      <Button
        variant="outline"
        size="sm"
        className="gap-1.5 text-xs"
        onClick={exportPng}
        title="Exportar como imagen PNG"
      >
        <ImageIcon className="h-3.5 w-3.5" /> PNG
      </Button>
      <Button
        variant="outline"
        size="sm"
        className="gap-1.5 text-xs"
        onClick={exportExcel}
        title="Exportar datos a Excel"
      >
        <FileSpreadsheet className="h-3.5 w-3.5" /> Excel
      </Button>
    </div>
  );
}
