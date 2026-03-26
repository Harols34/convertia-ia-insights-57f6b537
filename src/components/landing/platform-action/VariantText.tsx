import { motion } from "framer-motion";
import { MessageSquareText, Wand2 } from "lucide-react";
import { ChartTooltip, CountUpSpan } from "./ui-bits";
import { pa } from "./theme";
import { cn } from "@/lib/utils";

const prompt =
  "Crea un dashboard de ventas por región con forecast trimestral y comparativo vs año anterior";

export function VariantText({ active }: { active: boolean }) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className={pa.badge}>Lenguaje natural</span>
        <span className={cn("text-[10px] font-medium", pa.tSectionMeta)}>Describe el análisis · la plataforma construye el tablero</span>
      </div>

      <div className="grid gap-4 lg:grid-cols-12 lg:items-stretch">
        <motion.div
          className={cn(pa.card, "flex flex-col p-4 lg:col-span-5")}
          initial={{ opacity: 0, x: -10 }}
          animate={active ? { opacity: 1, x: 0 } : {}}
          transition={{ duration: 0.45 }}
        >
          <div className={cn("mb-3 flex items-center gap-2", pa.tAccent)}>
            <MessageSquareText className="h-4 w-4" />
            <span className={cn("text-xs font-semibold", pa.tTitle)}>Tu instrucción</span>
          </div>
          <div
            className={cn(
              "min-h-[100px] rounded-lg border p-3 font-mono text-[11px] leading-relaxed sm:text-xs",
              pa.borderSubtle,
              pa.insetDark,
              pa.tMono,
            )}
          >
            <motion.span initial={{ opacity: 0 }} animate={active ? { opacity: 1 } : {}} transition={{ duration: 0.8 }}>
              {prompt}
            </motion.span>
            <motion.span
              className="ml-0.5 inline-block h-4 w-0.5 bg-primary align-middle dark:bg-emerald-400"
              animate={{ opacity: [1, 0, 1] }}
              transition={{ duration: 1, repeat: Infinity }}
            />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className={cn("flex items-center gap-1 rounded-md px-2 py-1 text-[9px] font-semibold", pa.chip)}>
              <Wand2 className="h-3 w-3" /> Generando layout…
            </span>
            <span className={cn("rounded-md border px-2 py-1 text-[9px]", pa.chipMuted)}>~2.1s</span>
          </div>
        </motion.div>

        <motion.div
          className={cn(pa.card, "overflow-hidden p-0 lg:col-span-7")}
          initial={{ opacity: 0, x: 10 }}
          animate={active ? { opacity: 1, x: 0 } : {}}
          transition={{ duration: 0.45, delay: 0.08 }}
        >
          <div className={cn("flex items-center justify-between border-b px-3 py-2", pa.panelHeader)}>
            <p className={cn("text-xs font-semibold", pa.tTitle)}>Vista generada</p>
            <span className={pa.badge}>auto-build</span>
          </div>
          <div className="grid gap-3 p-3 sm:grid-cols-2 sm:p-4">
            <ChartTooltip
              title="Ventas por región"
              lines={[
                { label: "Norte", value: "$89.2K" },
                { label: "Sur", value: "$62.4K" },
                { label: "Centro", value: "$71.8K" },
                { label: "Forecast Q2", value: "+14%" },
              ]}
            >
              <div className={cn(pa.card, "cursor-crosshair p-3")}>
                <p className={cn("mb-2 text-[10px] font-semibold uppercase tracking-wide", pa.tMuted)}>Por región</p>
                <div className="space-y-2">
                  {[
                    { r: "Norte", w: 88 },
                    { r: "Centro", w: 72 },
                    { r: "Sur", w: 64 },
                    { r: "Caribe", w: 54 },
                  ].map((row, i) => (
                    <div key={row.r} className="flex items-center gap-2 text-[10px]">
                      <span className={cn("w-14", pa.donutLegend)}>{row.r}</span>
                      <div className={cn("h-2 flex-1 overflow-hidden rounded-full", pa.barTrack)}>
                        <motion.div
                          className={cn("h-full rounded-full", pa.miniBar)}
                          initial={{ width: 0 }}
                          animate={active ? { width: `${row.w}%` } : {}}
                          transition={{ delay: 0.2 + i * 0.1, duration: 0.7, ease: "easeOut" }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </ChartTooltip>

            <div className="space-y-2">
              <div className={cn(pa.card, "p-3")}>
                <p className={cn("text-[10px] font-semibold", pa.tMuted)}>Forecast trimestral</p>
                <p className={cn("mt-1 font-display text-2xl font-bold", pa.tValue)}>
                  <CountUpSpan end={14} prefix="+" suffix="%" active={active} />
                </p>
                <p className={cn("text-[9px]", pa.tMuted)}>vs trimestre anterior</p>
              </div>
              <ChartTooltip
                title="Comparativo YoY"
                lines={[
                  { label: "Ingresos YoY", value: "+21%" },
                  { label: "Unidades", value: "+9%" },
                  { label: "Margen", value: "+1.4pp" },
                ]}
              >
                <div className={cn(pa.card, "h-24 cursor-crosshair p-2 sm:h-28")}>
                  <svg viewBox="0 0 120 60" className="h-full w-full">
                    <motion.path
                      d="M0,45 L30,40 L60,35 L90,22 L120,18"
                      fill="none"
                      stroke="hsl(158 72% 48%)"
                      strokeWidth="2"
                      initial={{ pathLength: 0 }}
                      animate={active ? { pathLength: 1 } : {}}
                      transition={{ duration: 1.2 }}
                    />
                    <motion.path
                      d="M0,48 L30,46 L60,44 L90,38 L120,36"
                      fill="none"
                      stroke="hsl(160 40% 35%)"
                      strokeWidth="1.5"
                      strokeDasharray="3 3"
                      initial={{ pathLength: 0 }}
                      animate={active ? { pathLength: 1 } : {}}
                      transition={{ duration: 1.2, delay: 0.2 }}
                    />
                  </svg>
                  <p className={cn("text-center text-[8px]", pa.tHint)}>Sólido: actual · punteado: año ant.</p>
                </div>
              </ChartTooltip>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
