import React, { useState, useMemo } from "react";
import ReactECharts from "echarts-for-react";
import { GlassCard } from "./GlassCard";
import { BarChart3, LineChart, AreaChart, LayoutGrid, Maximize2, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export type ChartType = "line" | "bar" | "area" | "combo";

interface DynamicChartProps {
  title: string;
  subtitle?: string;
  data: any[];
  optionBuilder?: (data: any[], type: ChartType) => any;
  staticOption?: any;
  height?: number;
  className?: string;
  headerActions?: React.ReactNode;
}

export function DynamicChart({ 
  title, 
  subtitle, 
  data, 
  optionBuilder, 
  staticOption,
  height = 350,
  className,
  headerActions
}: DynamicChartProps) {
  const [type, setType] = useState<ChartType>("line");
  const [isExpanded, setIsExpanded] = useState(false);

  const option = useMemo(() => staticOption || (optionBuilder ? optionBuilder(data, type) : {}), [data, type, optionBuilder, staticOption]);

  return (
    <GlassCard className={cn(
      "p-6 transition-all duration-300", 
      isExpanded ? "fixed inset-4 z-50 overflow-auto bg-white/95 backdrop-blur-xl" : "h-full",
      className
    )}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h3 className="text-sm font-black text-foreground uppercase tracking-tight">{title}</h3>
          {subtitle && <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">{subtitle}</p>}
        </div>

        {headerActions && (
          <div className="flex-1 flex justify-center max-w-md mx-4">
            {headerActions}
          </div>
        )}

        <div className="flex items-center gap-1 p-1 bg-slate-100/50 rounded-lg self-end sm:self-auto">
          {!staticOption && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className={cn("h-8 w-8", type === "line" && "bg-white shadow-sm text-primary")}
                    onClick={() => setType("line")}
                  >
                    <LineChart className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Líneas</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className={cn("h-8 w-8", type === "bar" && "bg-white shadow-sm text-primary")}
                    onClick={() => setType("bar")}
                  >
                    <BarChart3 className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Barras</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className={cn("h-8 w-8", type === "area" && "bg-white shadow-sm text-primary")}
                    onClick={() => setType("area")}
                  >
                    <AreaChart className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Área</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className={cn("h-8 w-8", type === "combo" && "bg-white shadow-sm text-primary")}
                    onClick={() => setType("combo")}
                  >
                    <LayoutGrid className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Combinado</TooltipContent>
              </Tooltip>

              <div className="w-px h-4 bg-slate-200 mx-1" />
            </TooltipProvider>
          )}

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8"
                  onClick={() => setIsExpanded(!isExpanded)}
                >
                  <Maximize2 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{isExpanded ? "Contraer" : "Expandir"}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      <div style={{ height: isExpanded ? "calc(100vh - 200px)" : height }}>
        <ReactECharts 
          option={option} 
          style={{ height: "100%", width: "100%" }} 
          notMerge={true}
          lazyUpdate={true}
        />
      </div>
    </GlassCard>
  );
}
