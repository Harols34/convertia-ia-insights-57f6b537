import { useMemo, useState } from "react";
import ReactECharts from "echarts-for-react";
import { Expand } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useNavigate } from "react-router-dom";
import {
  applyCartesianChartType,
  ensureDashboardTooltip,
  inferCartesianType,
  isVerticalCartesianForTypeSwitch,
  type CartesianChartType,
} from "@/lib/dashdinamics-echarts";

interface DynamicChartProps {
  config: Record<string, unknown>;
  allowExpand?: boolean;
  height?: number;
  showTypeSwitch?: boolean;
}

export function DynamicChart({
  config,
  allowExpand = true,
  height = 280,
  showTypeSwitch = false,
}: DynamicChartProps) {
  const navigate = useNavigate();
  const [overrideType, setOverrideType] = useState<CartesianChartType | null>(null);

  const canMorph = Boolean(config && typeof config === "object" && isVerticalCartesianForTypeSwitch(config));
  const inferred = canMorph ? inferCartesianType(config) : "bar";
  const activeType = overrideType ?? inferred;

  const patchedConfig = useMemo(() => {
    try {
      if (!config || typeof config !== "object") return null;
      if (canMorph) return applyCartesianChartType(config, activeType);
      return config;
    } catch {
      return config;
    }
  }, [config, canMorph, activeType]);

  const option = useMemo(() => {
    try {
      if (!patchedConfig) return null;
      const withGrid = {
        ...patchedConfig,
        backgroundColor: "transparent",
        grid: {
          left: "3%",
          right: "4%",
          bottom: "3%",
          containLabel: true,
          ...((patchedConfig.grid as object) || {}),
        },
      };
      return ensureDashboardTooltip(withGrid);
    } catch {
      return null;
    }
  }, [patchedConfig]);

  if (!config || typeof config !== "object" || !option) {
    return (
      <div className="flex flex-col items-center justify-center gap-1 text-xs text-muted-foreground h-20 px-2 text-center">
        <span>{!option ? "Configuración de gráfico inválida o incompleta." : "Sin datos de gráfico"}</span>
        {!option && (
          <span className="text-[10px] opacity-80">Prueba Regenerar o cambia el tipo de gráfico en la consulta.</span>
        )}
      </div>
    );
  }

  return (
    <div className="relative rounded-lg border border-border bg-card p-2 mt-2">
      {allowExpand && (
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-2 right-2 z-10 h-7 w-7"
          onClick={() =>
            navigate("/app/dashdinamics/detail", { state: { chartConfig: patchedConfig ?? config } })
          }
        >
          <Expand className="h-3.5 w-3.5" />
        </Button>
      )}
      {showTypeSwitch && canMorph && (
        <div className="mb-2 flex justify-end pr-10">
          <Select
            value={activeType}
            onValueChange={(v) => setOverrideType(v as CartesianChartType)}
          >
            <SelectTrigger className="h-8 w-[140px] text-xs">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="bar">Barras</SelectItem>
              <SelectItem value="line">Líneas</SelectItem>
              <SelectItem value="area">Área</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}
      <ReactECharts option={option} style={{ height, width: "100%" }} notMerge lazyUpdate />
    </div>
  );
}
