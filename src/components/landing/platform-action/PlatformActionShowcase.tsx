import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useInView } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { VariantTraditional } from "./VariantTraditional";
import { VariantAI } from "./VariantAI";
import { VariantText } from "./VariantText";
import { VariantPivot } from "./VariantPivot";
import { TooltipProvider } from "@/components/ui/tooltip";
import { pa } from "./theme";

const SLIDE_MS = 10_000;

const slides = [
  {
    id: "bi",
    tab: "BI Enterprise",
    url: "converti-ia.app/dashboards/executive",
  },
  {
    id: "ai",
    tab: "IA generativa",
    url: "converti-ia.app/dashboards/ai-insights",
  },
  {
    id: "nl",
    tab: "Lenguaje natural",
    url: "converti-ia.app/dashboards/natural-language",
  },
  {
    id: "pivot",
    tab: "Constructor visual",
    url: "converti-ia.app/dashboards/pivot-builder",
  },
] as const;

export function PlatformActionShowcase() {
  const rootRef = useRef(null);
  const isInView = useInView(rootRef, { once: false, margin: "-10% 0px -10% 0px" });
  const [index, setIndex] = useState(0);
  const [manualEpoch, setManualEpoch] = useState(0);

  const go = useCallback((i: number) => {
    setIndex(((i % slides.length) + slides.length) % slides.length);
    setManualEpoch((e) => e + 1);
  }, []);

  useEffect(() => {
    if (!isInView) return;
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % slides.length);
    }, SLIDE_MS);
    return () => clearInterval(id);
  }, [isInView, manualEpoch]);

  const active = isInView;

  return (
    <section className="relative py-16 sm:py-20 lg:py-24">
      <div className="container">
        <div className="relative overflow-hidden rounded-3xl border border-white/10 gradient-hero px-5 py-10 shadow-2xl shadow-black/35 sm:px-8 sm:py-12 lg:px-10 lg:py-14">
          <div
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,hsl(187_80%_42%/0.12),transparent_68%)]"
            aria-hidden
          />

          <div ref={rootRef} className="relative z-10">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="mb-8 space-y-4 text-center sm:mb-10"
            >
              <span className="text-sm font-semibold uppercase tracking-widest text-primary">
                Plataforma en Acción
              </span>
              <h2 className="font-display text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl">
                Analítica que se ve <span className="text-gradient">increíble</span>
              </h2>
              <p className="mx-auto max-w-2xl text-lg text-white/70">
                Dashboards BI, insights con IA, creación por texto y análisis tipo tabla dinámica todo en una
                experiencia en vivo.
              </p>
            </motion.div>

            {/* Tabs + manual nav */}
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap justify-center gap-1.5 sm:justify-start">
                {slides.map((s, i) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => go(i)}
                    className={`rounded-lg px-3 py-1.5 text-[11px] font-semibold transition-colors sm:text-xs ${
                      i === index
                        ? "bg-white/15 text-white ring-1 ring-white/25"
                        : "text-white/55 hover:bg-white/10 hover:text-white/90"
                    }`}
                  >
                    {s.tab}
                  </button>
                ))}
              </div>
              <div className="flex items-center justify-center gap-1 sm:justify-end">
                <button
                  type="button"
                  aria-label="Vista anterior"
                  onClick={() => go(index - 1)}
                  className="rounded-lg border border-white/20 p-2 text-white/90 transition-colors hover:bg-white/10"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <div className="flex gap-1.5 px-2">
                  {slides.map((_, i) => (
                    <button
                      key={i}
                      type="button"
                      aria-label={`Ir a vista ${i + 1}`}
                      onClick={() => go(i)}
                      className={`h-2 w-2 rounded-full transition-all ${
                        i === index ? "w-6 bg-primary" : "bg-white/25 hover:bg-white/40"
                      }`}
                    />
                  ))}
                </div>
                <button
                  type="button"
                  aria-label="Vista siguiente"
                  onClick={() => go(index + 1)}
                  className="rounded-lg border border-white/20 p-2 text-white/90 transition-colors hover:bg-white/10"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>

            <TooltipProvider delayDuration={100}>
              <motion.div
                className={pa.shell}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5 }}
              >
                <div className={`flex items-center gap-2 px-4 py-3 sm:px-5 ${pa.chrome}`}>
                  <div className="flex gap-1.5">
                    <span className="h-3 w-3 rounded-full bg-red-500/50" />
                    <span className="h-3 w-3 rounded-full bg-amber-400/50" />
                    <span className="h-3 w-3 rounded-full bg-emerald-500/50" />
                  </div>
                  <div className="flex flex-1 justify-center px-2">
                    <motion.div
                      key={slides[index].url}
                      initial={{ opacity: 0.5 }}
                      animate={{ opacity: 1 }}
                      className={pa.urlBar}
                    >
                      {slides[index].url}
                    </motion.div>
                  </div>
                  <span className={pa.livePill}>live</span>
                </div>

                <div className={`p-4 sm:p-5 lg:p-7 ${pa.dashBody}`}>
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.div
                      key={slides[index].id}
                      role="tabpanel"
                      aria-label={slides[index].tab}
                      initial={{ opacity: 0, x: 28, filter: "blur(6px)" }}
                      animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
                      exit={{ opacity: 0, x: -24, filter: "blur(4px)" }}
                      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                    >
                      {index === 0 ? <VariantTraditional active={active} /> : null}
                      {index === 1 ? <VariantAI active={active} /> : null}
                      {index === 2 ? <VariantText active={active} /> : null}
                      {index === 3 ? <VariantPivot active={active} /> : null}
                    </motion.div>
                  </AnimatePresence>
                </div>
              </motion.div>
            </TooltipProvider>

            <p className="mt-4 text-center text-[10px] text-white/40">
              Vista demo con datos ficticios · rotación automática cada 10s (también puedes usar pestañas o flechas)
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
