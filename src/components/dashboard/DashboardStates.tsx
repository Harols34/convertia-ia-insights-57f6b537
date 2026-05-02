import React from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { GlassCard } from "./GlassCard";
import { SearchX, AlertCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function KpiSkeleton() {
  return (
    <GlassCard className="flex flex-col gap-3 h-32">
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-8 w-8 rounded-xl" />
      </div>
      <Skeleton className="h-10 w-32" />
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-8 w-24" />
      </div>
    </GlassCard>
  );
}

export function ChartSkeleton({ height = 300 }: { height?: number }) {
  return (
    <GlassCard className="w-full flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-xl" />
          <div className="space-y-1">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
        <Skeleton className="h-8 w-32" />
      </div>
      <Skeleton className={cn("w-full rounded-xl", `h-[${height}px]`)} style={{ height }} />
    </GlassCard>
  );
}

export function EmptyState({ title, message, icon: Icon = SearchX }: { title: string; message: string; icon?: any }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-6 text-center animate-fade-up">
      <div className="bg-muted/30 p-6 rounded-full mb-6">
        <Icon className="h-12 w-12 text-muted-foreground opacity-50" />
      </div>
      <h3 className="text-xl font-display font-bold text-foreground mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground max-w-sm leading-relaxed">{message}</p>
    </div>
  );
}

export function ErrorState({ title, message, onRetry }: { title: string; message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
      <div className="bg-destructive/10 p-6 rounded-full mb-6">
        <AlertCircle className="h-12 w-12 text-destructive opacity-80" />
      </div>
      <h3 className="text-xl font-display font-bold text-foreground mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground max-w-sm mb-6">{message}</p>
      {onRetry && (
        <button 
          onClick={onRetry}
          className="bg-primary text-white px-6 py-2 rounded-lg font-bold shadow-lg hover:scale-105 transition-transform"
        >
          Reintentar
        </button>
      )}
    </div>
  );
}

export function LoadingOverlay({ message = "Cargando datos estratégicos..." }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4">
      <div className="relative">
        <div className="h-12 w-12 rounded-full border-4 border-primary/20" />
        <Loader2 className="h-12 w-12 text-primary animate-spin absolute inset-0" />
      </div>
      <p className="text-sm font-medium text-muted-foreground animate-pulse">{message}</p>
    </div>
  );
}
