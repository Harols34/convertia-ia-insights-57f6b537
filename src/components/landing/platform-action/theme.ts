/**
 * Mock “Plataforma en Acción”.
 * Modo oscuro: mismos tonos que gradient-hero / tarjetas Servicios (hsl 220, cristal blanco ~4–8%).
 * Modo claro: slate/blanco.
 */
export const pa = {
  /** Contenedor tipo ventana: recortar hijos al radio (evita esquinas cuadradas) */
  shell:
    "overflow-hidden rounded-2xl border border-slate-200/90 bg-white/95 text-slate-900 shadow-2xl shadow-slate-300/25 backdrop-blur-xl dark:border-white/10 dark:bg-[hsl(220_25%_7%)] dark:text-emerald-50 dark:shadow-black/50 sm:rounded-3xl",

  chrome:
    "border-b border-slate-200 bg-slate-100/95 dark:border-white/10 dark:bg-[hsl(220_22%_9%)]",

  card:
    "rounded-xl border border-slate-200/90 bg-white shadow-sm shadow-slate-200/50 dark:border-white/10 dark:bg-white/[0.05] dark:shadow-none",

  cardHover:
    "transition-all duration-300 hover:border-primary/35 hover:bg-slate-50/90 dark:hover:border-white/18 dark:hover:bg-white/[0.08]",

  badge:
    "rounded-md border border-primary/25 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-300",

  tooltip:
    "max-w-xs border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 shadow-lg dark:border-white/15 dark:bg-[hsl(220_23%_8%)] dark:text-emerald-50 dark:shadow-xl dark:shadow-black/60",

  urlBar:
    "truncate rounded-md border border-slate-200 bg-slate-100/90 px-3 py-1 font-mono text-[10px] text-slate-700 dark:border-white/10 dark:bg-white/[0.06] dark:text-emerald-100/90 sm:text-[11px]",

  livePill:
    "hidden shrink-0 text-[9px] font-semibold uppercase tracking-wide text-primary/70 dark:text-emerald-400/80 sm:block",

  /** Área bajo la barra de título (mismo tono base que el shell) */
  dashBody: "bg-white dark:bg-[hsl(220_25%_7%)]",

  tSectionMeta: "text-slate-500 dark:text-emerald-100/40",
  tTitle: "text-slate-800 dark:text-emerald-100/80",
  tSubtitle: "text-slate-600 dark:text-emerald-100/70",
  tBody: "text-slate-600 dark:text-emerald-100/60",
  tStrong: "text-slate-900 dark:text-emerald-50",
  tMono: "text-slate-700 dark:text-emerald-100/85",
  tMuted: "text-slate-500 dark:text-emerald-100/45",
  tHint: "text-slate-400 dark:text-emerald-100/35",
  tAccent: "text-primary dark:text-emerald-400",
  tPositive: "text-emerald-700 dark:text-emerald-400",
  tValue: "text-primary dark:text-emerald-300",
  kpiLabel: "text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-emerald-100/45",
  kpiValue: "font-display text-xl font-bold tracking-tight text-slate-900 sm:text-2xl dark:text-emerald-50",
  kpiIcon: "text-primary dark:text-emerald-400/80",
  kpiBadge:
    "absolute right-2 top-2 rounded bg-primary/15 px-1.5 py-0.5 text-[9px] font-bold text-primary dark:bg-emerald-500/15 dark:text-emerald-300",
  kpiSub: "mt-1 text-[11px] text-slate-600 dark:text-emerald-100/60",

  borderSubtle: "border-slate-200 dark:border-white/10",
  borderSoft: "border-slate-100 dark:border-white/[0.06]",
  panelHeader: "border-slate-200 bg-slate-100/90 dark:border-white/10 dark:bg-white/[0.04]",
  insetDark: "bg-slate-100/90 dark:border-white/10 dark:bg-[hsl(220_24%_6%)]",
  barTrack: "bg-slate-200 dark:bg-white/[0.08]",
  barFill:
    "bg-gradient-to-t from-slate-400/80 to-primary/75 ring-1 ring-primary/25 dark:from-emerald-900/70 dark:to-emerald-500/75 dark:ring-emerald-400/25",
  miniBar: "bg-gradient-to-r from-primary/70 to-emerald-500/85 dark:from-emerald-700 dark:to-emerald-400",
  tableHead: "text-slate-500 dark:text-emerald-100/45",
  tableRow: "border-t border-slate-100 hover:bg-slate-50 dark:border-white/[0.06] dark:hover:bg-white/[0.04]",
  donutLegend: "text-slate-600 dark:text-emerald-100/55",

  aiHero:
    "border border-primary/20 bg-gradient-to-r from-primary/10 via-slate-50 to-primary/5 dark:border-emerald-500/20 dark:from-[hsl(220_24%_8%)] dark:via-[hsl(220_23%_9%)] dark:to-[hsl(220_24%_7%)]",
  aiGlow: "pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-primary/10 blur-2xl dark:bg-emerald-500/12",
  aiIconBox:
    "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary dark:bg-emerald-500/15 dark:text-emerald-300",
  chip: "rounded border border-primary/20 bg-primary/10 px-2 py-0.5 text-[9px] font-semibold text-primary dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-300",
  chipMuted: "rounded border border-slate-200 px-2 py-0.5 text-[9px] text-slate-500 dark:border-white/12 dark:text-emerald-100/60",
  progressTrack: "h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-white/[0.08]",
  progressFill: "h-full rounded-full bg-gradient-to-r from-primary to-emerald-500 dark:from-emerald-600 dark:to-emerald-400",

  pivotFieldActive:
    "border-slate-200 bg-slate-100 text-slate-400 dark:border-white/10 dark:bg-white/[0.03] dark:text-emerald-100/35",
  pivotFieldIdle:
    "border-slate-200 bg-white text-slate-800 dark:border-white/10 dark:bg-white/[0.06] dark:text-emerald-100/85",
  pivotZoneEmpty: "border-slate-200 dark:border-white/10",
  pivotZoneFilled: "border-primary/35 bg-primary/10 dark:border-emerald-500/35 dark:bg-emerald-500/10",
  pivotRingHighlight:
    "ring-2 ring-primary/40 ring-offset-2 ring-offset-white dark:ring-emerald-400/45 dark:ring-offset-[hsl(220_25%_7%)]",
  pivotMini: "border-slate-200 bg-slate-100/90 dark:border-white/10 dark:bg-white/[0.04]",
} as const;
