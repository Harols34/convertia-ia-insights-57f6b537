import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { GripVertical, Layers } from "lucide-react";
import { ChartTooltip } from "./ui-bits";
import { pa } from "./theme";
import { cn } from "@/lib/utils";

type Zone = "rows" | "cols" | "values" | "filters";

const fields = [
  { id: "region", label: "Región", type: "Dimensión" },
  { id: "sales", label: "Ventas", type: "Métrica" },
  { id: "channel", label: "Canal", type: "Dimensión" },
  { id: "date", label: "Fecha", type: "Tiempo" },
];

const sequence: { zone: Zone; fieldId: string; atMs: number }[] = [
  { zone: "rows", fieldId: "region", atMs: 600 },
  { zone: "values", fieldId: "sales", atMs: 1400 },
  { zone: "filters", fieldId: "channel", atMs: 2200 },
];

const zoneLabels: Record<Zone, string> = {
  rows: "Filas",
  cols: "Columnas",
  values: "Valores",
  filters: "Filtros",
};

export function VariantPivot({ active }: { active: boolean }) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!active) {
      setStep(0);
      return;
    }
    const pending: number[] = [];
    const runCycle = () => {
      pending.forEach(clearTimeout);
      pending.length = 0;
      setStep(0);
      sequence.forEach((seq, i) => {
        pending.push(window.setTimeout(() => setStep(i + 1), seq.atMs));
      });
    };
    runCycle();
    const loop = window.setInterval(runCycle, 9000);
    return () => {
      pending.forEach(clearTimeout);
      clearInterval(loop);
    };
  }, [active]);

  const filled: Partial<Record<Zone, string>> = {};
  for (let i = 0; i < step; i++) {
    const s = sequence[i];
    if (s) {
      const f = fields.find((x) => x.id === s.fieldId);
      if (f) filled[s.zone] = f.label;
    }
  }

  const showPreview = step >= 2;
  const pulsingZone = step > 0 && step <= sequence.length ? sequence[step - 1]?.zone : undefined;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className={pa.badge}>Constructor visual</span>
        <span className={cn("text-[10px] font-medium", pa.tSectionMeta)}>Arrastra dimensiones y métricas · tabla dinámica</span>
      </div>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-stretch">
        {/* Campos disponibles */}
        <div className={cn(pa.card, "w-full shrink-0 p-3 lg:w-44")}>
          <div className={cn("mb-2 flex items-center gap-2", pa.tAccent)}>
            <Layers className="h-3.5 w-3.5" />
            <span className={cn("text-[10px] font-bold uppercase tracking-wide", pa.tBody)}>Campos</span>
          </div>
          <div className="space-y-2">
            {fields.map((f) => {
              const dragged = sequence.slice(0, step).some((s) => s.fieldId === f.id);
              return (
                <motion.div
                  key={f.id}
                  layout
                  className={cn(
                    "flex items-center gap-2 rounded-lg border px-2 py-2 text-[10px]",
                    dragged ? pa.pivotFieldActive : pa.pivotFieldIdle,
                  )}
                  animate={dragged ? { scale: 0.98 } : { scale: 1 }}
                >
                  <GripVertical className="h-3 w-3 shrink-0 text-slate-400 dark:text-emerald-500/40" />
                  <div>
                    <p className={cn("font-semibold", pa.tStrong)}>{f.label}</p>
                    <p className={cn("text-[9px]", pa.tSectionMeta)}>{f.type}</p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Zonas + preview */}
        <div className="min-w-0 flex-1 space-y-3">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {(Object.keys(zoneLabels) as Zone[]).map((zone) => {
              const label = filled[zone];
              const highlight = pulsingZone === zone;
              return (
                <motion.div
                  key={zone}
                  className={cn(
                    pa.card,
                    "min-h-[72px] border-dashed p-2 transition-colors",
                    label ? pa.pivotZoneFilled : pa.pivotZoneEmpty,
                    highlight && pa.pivotRingHighlight,
                  )}
                  animate={highlight ? { scale: [1, 1.02, 1] } : {}}
                  transition={{ duration: 0.4 }}
                >
                  <p className={cn("text-[9px] font-bold uppercase tracking-wide", pa.tMuted)}>{zoneLabels[zone]}</p>
                  <AnimatePresence mode="wait">
                    {label ? (
                      <motion.p
                        key={label}
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className={cn("mt-2 text-xs font-semibold", pa.tStrong)}
                      >
                        {label}
                      </motion.p>
                    ) : (
                      <p className={cn("mt-2 text-[9px]", pa.tHint)}>Soltar aquí</p>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </div>

          <ChartTooltip
            title="Vista dinámica"
            lines={[
              { label: "Región en filas", value: "4 valores" },
              { label: "Ventas en valores", value: "SUM" },
              { label: "Canal en filtros", value: "Todos" },
              { label: "Actualización", value: "live sync" },
            ]}
          >
            <div className={cn(pa.card, "cursor-crosshair overflow-hidden p-0")}>
              <div className={cn("flex items-center justify-between border-b px-3 py-2", pa.panelHeader)}>
                <p className={cn("text-xs font-semibold", pa.tTitle)}>Tabla dinámica · vista previa</p>
                <span className={pa.badge}>pivot</span>
              </div>
              <div className="p-3">
                <AnimatePresence mode="wait">
                  {showPreview ? (
                    <motion.div
                      key="tbl"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="overflow-x-auto"
                    >
                      <table className="w-full min-w-[260px] text-left text-[10px]">
                        <thead>
                          <tr className={pa.tableHead}>
                            <th className="py-2 pr-2">Región</th>
                            <th className="py-2">Ventas</th>
                            <th className="py-2 hidden sm:table-cell">% total</th>
                          </tr>
                        </thead>
                        <tbody className={pa.tMono}>
                          {[
                            ["Norte", "$89.2K", "32%"],
                            ["Centro", "$71.8K", "26%"],
                            ["Sur", "$62.4K", "22%"],
                            ["Caribe", "$54.1K", "20%"],
                          ].map((row, i) => (
                            <motion.tr
                              key={row[0]}
                              className={cn("border-t", pa.borderSubtle)}
                              initial={{ opacity: 0, x: -6 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: 0.08 * i }}
                            >
                              <td className={cn("py-2 pr-2 font-medium", pa.tStrong)}>{row[0]}</td>
                              <td className={cn("py-2 font-mono", pa.tValue)}>{row[1]}</td>
                              <td className={cn("py-2 hidden font-mono sm:table-cell", pa.donutLegend)}>{row[2]}</td>
                            </motion.tr>
                          ))}
                        </tbody>
                      </table>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="empty"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className={cn("flex h-28 items-center justify-center text-[11px]", pa.tHint)}
                    >
                      Arrastra campos a las zonas para generar la vista…
                    </motion.div>
                  )}
                </AnimatePresence>

                {showPreview ? (
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <div className={cn("h-20 rounded-lg border p-2", pa.pivotMini)}>
                      <p className={cn("text-[9px]", pa.tMuted)}>Mini gráfico · ventas</p>
                      <div className="mt-1 flex h-12 items-end gap-1">
                        {[40, 65, 52, 88, 72, 95].map((h, i) => (
                          <motion.div
                            key={i}
                            className={cn("flex-1 rounded-sm", pa.barFill)}
                            initial={{ height: 0 }}
                            animate={active ? { height: `${h}%` } : {}}
                            transition={{ delay: 0.15 + i * 0.06, duration: 0.5 }}
                          />
                        ))}
                      </div>
                    </div>
                    <div className={cn("flex flex-col justify-center rounded-lg border p-2", pa.pivotMini)}>
                      <p className={cn("text-[9px] font-semibold", pa.tMuted)}>KPI rápido</p>
                      <p className={cn("font-display text-lg font-bold", pa.tValue)}>$277.5K</p>
                      <p className={cn("text-[9px]", pa.tPositive)}>+12.4% vs período ant.</p>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </ChartTooltip>
        </div>
      </div>
    </div>
  );
}
