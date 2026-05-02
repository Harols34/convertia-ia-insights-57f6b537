import React, { useMemo } from "react";
import { LucideIcon, ArrowUpRight, ArrowDownRight, Minus, Info, TrendingUp, TrendingDown } from "lucide-react";
import { GlassCard } from "./GlassCard";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import ReactECharts from "echarts-for-react";
import { sparklineOption } from "./dashboard-chart-options";
import { EXEC } from "./dashboard-chart-theme";

export type KpiCardProps = {
  title: string;
  value: number;
  format?: "number" | "percentage" | "currency" | "decimal";
  icon?: LucideIcon;
  deltaPct?: number | null;
  deltaLabel?: string;
  subtitle?: string;
  isLoading?: boolean;
  isError?: boolean;
  tooltipInfo?: string;
  onClick?: () => void;
  className?: string;
  children?: React.ReactNode;
  sparklineData?: number[];
  variant?: "default" | "success" | "purple" | "amber" | "indigo" | "warning";
  compact?: boolean;
};

function formatValue(val: number | null | undefined, format: KpiCardProps["format"]): string {
  const n = val ?? 0;
  if (format === "percentage") {
    return `${n.toFixed(1)}%`;
  }
  if (format === "decimal") {
    return n.toFixed(1);
  }
  if (format === "currency") {
    return new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP" }).format(n);
  }
  return new Intl.NumberFormat("es-CL").format(Math.round(n));
}

export function KpiCard({
  title,
  value,
  format = "number",
  icon: Icon,
  deltaPct,
  deltaLabel,
  subtitle,
  isLoading,
  isError,
  tooltipInfo,
  onClick,
  className,
  children,
  sparklineData,
  variant = "default",
  compact = false,
}: KpiCardProps) {
  const isPositive = deltaPct !== undefined && deltaPct !== null && deltaPct > 0;
  const isNegative = deltaPct !== undefined && deltaPct !== null && deltaPct < 0;
  const isNeutral = deltaPct === 0;

  const sparklineOpt = useMemo(() => {
    if (!sparklineData || sparklineData.length < 2) return null;
    let color = EXEC.teal;
    if (variant === "success") color = EXEC.green;
    if (variant === "purple") color = EXEC.purple;
    if (variant === "amber") color = EXEC.amber;
    if (variant === "warning") color = "#F59E0B";
    if (variant === "indigo") color = "#6366F1";
    return sparklineOption(sparklineData, color);
  }, [sparklineData, variant]);

  return (
    <GlassCard 
      className={cn(
        "flex flex-col gap-1 relative overflow-hidden transition-all duration-500 group", 
        "border-white/10 hover:border-white/20",
        compact ? "p-4" : "p-6",
        onClick && "cursor-pointer hover:shadow-2xl hover:-translate-y-1 active:scale-95", 
        variant === "success" && "glow-success",
        variant === "purple" && "glow-purple",
        variant === "amber" && "glow-amber",
        className
      )}
    >
      <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
        {Icon && <Icon className={cn(compact ? "h-12 w-12" : "h-20 w-20", "rotate-12")} />}
      </div>

      <div className="flex items-start justify-between z-10">
        <div className="flex items-center gap-1.5">
          <span className={cn(
            "font-bold tracking-widest text-muted-foreground uppercase opacity-80",
            compact ? "text-[9px]" : "text-[11px]"
          )}>{title}</span>
          {tooltipInfo && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button type="button" className="text-muted-foreground/60 hover:text-foreground">
                  <Info className="h-3.5 w-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs text-xs bg-slate-900 text-white border-none shadow-xl">
                {tooltipInfo}
              </TooltipContent>
            </Tooltip>
          )}
        </div>
        {Icon && (
          <div className={cn(
            "rounded-xl p-2 shadow-sm transition-transform group-hover:scale-110 duration-300",
            variant === "default" && "bg-primary/10 text-primary",
            variant === "success" && "bg-success/10 text-success",
            variant === "purple" && "bg-purple-500/10 text-purple-500",
            variant === "amber" && "bg-amber-500/10 text-amber-500",
            variant === "warning" && "bg-orange-500/10 text-orange-500",
            variant === "indigo" && "bg-indigo-500/10 text-indigo-500",
          )}>
            <Icon className={cn(compact ? "h-3.5 w-3.5" : "h-4.5 w-4.5")} />
          </div>
        )}
      </div>

      <div className="mt-0.5 flex flex-col z-10">
        {isLoading ? (
          <div className="h-10 w-32 animate-pulse rounded-lg bg-muted/40" />
        ) : isError ? (
          <span className="text-2xl font-bold font-mono text-destructive">Error</span>
        ) : (
          <div className="flex items-baseline gap-2">
            <span className={cn(
              "font-black font-mono tracking-tighter text-foreground drop-shadow-sm",
              compact ? "text-xl" : "text-3xl"
            )}>
              {formatValue(value, format)}
            </span>
            {deltaPct !== undefined && deltaPct !== null && !isLoading && !isError && (
              <div className={cn(
                "flex items-center gap-0.5 font-bold px-1.5 py-0.5 rounded-md",
                compact ? "text-[10px]" : "text-xs",
                isPositive && "text-emerald-500 bg-emerald-500/10",
                isNegative && "text-rose-500 bg-rose-500/10",
                isNeutral && "text-slate-400 bg-slate-100"
              )}>
                {isPositive ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
                {deltaPct !== null ? Math.abs(deltaPct).toFixed(1) : "0"}%
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between mt-1 z-10">
        <div className="flex flex-col">
          {(subtitle || deltaLabel) && (
            <span className={cn(
              "font-medium text-muted-foreground/70 uppercase tracking-tight truncate",
              compact ? "text-[8px] max-w-[80px]" : "text-[10px] max-w-[120px]"
            )}>
              {subtitle || deltaLabel}
            </span>
          )}
        </div>
        
        {sparklineOpt && (
          <div className={cn(compact ? "h-6 w-16" : "h-10 w-24", "-mr-2")}>
            <ReactECharts 
              option={sparklineOpt} 
              style={{ height: "100%", width: "100%" }} 
              notMerge 
              lazyUpdate 
            />
          </div>
        )}
      </div>

      {children && <div className="mt-2 z-10">{children}</div>}
      <div className="absolute bottom-0 left-0 h-1 w-0 bg-gradient-to-r from-primary to-accent group-hover:w-full transition-all duration-700" />
    </GlassCard>
  );
}
