import React from "react";
import { LucideIcon, ArrowUpRight, ArrowDownRight, Minus, Info } from "lucide-react";
import { GlassCard } from "./GlassCard";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export type KpiCardProps = {
  title: string;
  value: number;
  format?: "number" | "percentage" | "currency";
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
};

function formatValue(val: number, format: KpiCardProps["format"]): string {
  if (format === "percentage") {
    return `${val.toFixed(1)}%`;
  }
  if (format === "currency") {
    return new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP" }).format(val);
  }
  return new Intl.NumberFormat("es-CL").format(Math.round(val));
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
}: KpiCardProps) {
  const isPositive = deltaPct !== undefined && deltaPct !== null && deltaPct > 0;
  const isNegative = deltaPct !== undefined && deltaPct !== null && deltaPct < 0;
  const isNeutral = deltaPct === 0;

  return (
    <GlassCard 
      className={cn(
        "flex flex-col gap-2 relative overflow-hidden transition-all duration-300", 
        onClick && "cursor-pointer hover:border-primary/40 hover:shadow-lg", 
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-semibold tracking-wide text-slate-600 uppercase">{title}</span>
          {tooltipInfo && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button type="button" className="text-muted-foreground hover:text-foreground">
                  <Info className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs text-xs">{tooltipInfo}</TooltipContent>
            </Tooltip>
          )}
        </div>
        {Icon && (
          <div className="rounded-xl bg-primary/10 p-2 text-primary">
            <Icon className="h-5 w-5" />
          </div>
        )}
      </div>

      <div className="mt-1 flex items-baseline gap-2">
        {isLoading ? (
          <div className="h-9 w-24 animate-pulse rounded bg-muted/60" />
        ) : isError ? (
          <span className="text-2xl font-bold font-mono text-destructive">Error</span>
        ) : (
          <span className="text-3xl font-black font-mono tracking-tight text-slate-900">
            {formatValue(value, format)}
          </span>
        )}
      </div>

      {(deltaPct !== undefined && deltaPct !== null || subtitle) && (
        <div className="mt-1 flex items-center gap-2 text-xs font-medium">
          {deltaPct !== undefined && deltaPct !== null && !isLoading && !isError && (
             <span
               className={cn(
                 "flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-semibold",
                 isPositive && "bg-success/15 text-success",
                 isNegative && "bg-destructive/15 text-destructive",
                 isNeutral && "bg-slate-100 text-slate-500"
               )}
             >
               {isPositive && <ArrowUpRight className="h-3 w-3" />}
               {isNegative && <ArrowDownRight className="h-3 w-3" />}
               {isNeutral && <Minus className="h-3 w-3" />}
               {Math.abs(deltaPct).toFixed(1)}%
             </span>
          )}
          {(subtitle || deltaLabel) && (
            <span className="text-muted-foreground truncate">
              {subtitle || deltaLabel}
            </span>
          )}
        </div>
      )}
      {children}
    </GlassCard>
  );
}
