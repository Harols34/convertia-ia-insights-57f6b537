import { useLeadsData } from "@/contexts/LeadsDataContext";

/**
 * Indicador discreto mientras el primer lote de datos aún no está listo.
 * Sin referencias a base de datos ni conteos técnicos.
 */
export function ArtifactsLoadingBadge() {
  const { loading, allLeads } = useLeadsData();
  if (!loading || allLeads.length > 0) return null;

  return (
    <div
      className="pointer-events-none fixed bottom-5 right-5 z-[100] flex items-center gap-3 rounded-2xl border border-border/80 bg-card/95 px-4 py-3 shadow-lg backdrop-blur-md"
      role="status"
      aria-live="polite"
    >
      <div className="relative h-10 w-10 shrink-0">
        <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-teal-400/30 via-violet-400/20 to-transparent animate-pulse" />
        <div
          className="absolute inset-1 rounded-lg border-2 border-teal-500/60 border-t-transparent animate-spin"
          style={{ animationDuration: "1.1s" }}
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-[10px] font-bold font-display tracking-tighter text-teal-700">C·IA</span>
        </div>
      </div>
      <div className="min-w-0 text-left">
        <p className="text-xs font-semibold text-foreground tracking-tight">Artefactos</p>
        <p className="text-[10px] text-muted-foreground leading-snug">Preparando tu espacio de análisis…</p>
      </div>
    </div>
  );
}
