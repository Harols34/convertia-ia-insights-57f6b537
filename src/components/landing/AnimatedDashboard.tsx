import { motion, useInView } from "framer-motion";
import { useRef } from "react";

const barHeights = [65, 45, 80, 55, 90, 70, 50, 85, 60, 75, 95, 40];
const linePoints = [
  { x: 0, y: 70 }, { x: 30, y: 55 }, { x: 60, y: 65 }, { x: 90, y: 40 },
  { x: 120, y: 50 }, { x: 150, y: 30 }, { x: 180, y: 45 }, { x: 210, y: 20 },
  { x: 240, y: 35 }, { x: 270, y: 15 }, { x: 300, y: 25 }, { x: 330, y: 10 },
];
const pathD = linePoints.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");

function KpiCard({ label, value, change, delay }: { label: string; value: string; change: string; delay: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className="rounded-lg p-3 bg-white/[0.04] border border-white/[0.06]"
    >
      <p className="text-[10px] text-white/40 uppercase tracking-wider">{label}</p>
      <p className="text-lg font-display font-bold text-white mt-0.5">{value}</p>
      <p className="text-[10px] text-emerald-400 font-medium mt-0.5">{change}</p>
    </motion.div>
  );
}

export function AnimatedDashboard() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section className="relative py-16 sm:py-20 lg:py-24">
      <div className="container">
        <div className="relative overflow-hidden rounded-3xl border border-white/10 gradient-hero px-5 py-10 shadow-2xl shadow-black/35 sm:px-8 sm:py-12 lg:px-10 lg:py-14">
          <div
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,hsl(187_80%_42%/0.12),transparent_68%)]"
            aria-hidden
          />

          <div className="relative z-10">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="mb-10 space-y-4 text-center sm:mb-12 lg:mb-14"
            >
              <span className="text-sm font-semibold uppercase tracking-widest text-primary">
                Plataforma en Acción
              </span>
              <h2 className="font-display text-3xl font-bold text-white sm:text-4xl lg:text-5xl">
                Analítica que se ve <span className="text-gradient">increíble</span>
              </h2>
              <p className="mx-auto max-w-2xl text-lg text-white/70">
                Dashboards inteligentes que transforman tus datos en decisiones estratégicas en tiempo real.
              </p>
            </motion.div>

            <motion.div
              ref={ref}
              initial={{ opacity: 0, y: 40, scale: 0.98 }}
              whileInView={{ opacity: 1, y: 0, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
              className="relative w-full"
            >
              {/* Glow behind */}
              <div className="absolute -inset-3 rounded-3xl bg-primary/10 blur-[56px] opacity-60 sm:-inset-4" />

              {/* Dashboard frame — ancho completo del bloque, mismo radio que Servicios/Beneficios */}
              <div className="relative overflow-hidden rounded-2xl border border-white/[0.12] bg-card/90 shadow-2xl shadow-black/40 backdrop-blur-xl sm:rounded-3xl">
                {/* Top bar */}
                <div className="flex items-center gap-2 border-b border-border/50 bg-muted/30 px-4 py-3 sm:px-5 sm:py-3.5">
                  <div className="flex gap-1.5">
                    <span className="h-3 w-3 rounded-full bg-destructive/60" />
                    <span className="h-3 w-3 rounded-full bg-yellow-500/60" />
                    <span className="h-3 w-3 rounded-full bg-emerald-500/60" />
                  </div>
                  <div className="flex flex-1 justify-center">
                    <div className="rounded-md bg-muted px-4 py-1 font-mono text-[11px] text-muted-foreground">
                      converti-ia.app/dashboards
                    </div>
                  </div>
                </div>

                <div className="space-y-6 p-5 sm:p-7 lg:p-9">
                  {/* KPI row */}
                  {isInView && (
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:gap-4">
                      <KpiCard label="Conversiones" value="12,847" change="▲ 23.5%" delay={0.2} />
                      <KpiCard label="Revenue" value="$1.4M" change="▲ 18.2%" delay={0.35} />
                      <KpiCard label="Retención" value="94.7%" change="▲ 3.1%" delay={0.5} />
                      <KpiCard label="NPS Score" value="78" change="▲ 12 pts" delay={0.65} />
                    </div>
                  )}

                  <div className="grid gap-4 sm:grid-cols-2 lg:gap-6">
                    {/* Bar chart */}
                    <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-4 sm:p-5">
                      <p className="mb-4 text-xs font-medium text-muted-foreground">Ventas Mensuales</p>
                      <div className="flex h-28 items-end gap-1.5 sm:h-32 lg:h-36">
                        {barHeights.map((h, i) => (
                          <motion.div
                            key={i}
                            initial={{ height: 0 }}
                            animate={isInView ? { height: `${h}%` } : {}}
                            transition={{ delay: 0.3 + i * 0.06, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                            className="flex-1 cursor-pointer rounded-sm gradient-primary opacity-80 transition-opacity hover:opacity-100"
                          />
                        ))}
                      </div>
                      <div className="mt-2 flex justify-between">
                        <span className="text-[9px] text-muted-foreground">Ene</span>
                        <span className="text-[9px] text-muted-foreground">Dic</span>
                      </div>
                    </div>

                    {/* Line chart */}
                    <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-4 sm:p-5">
                      <p className="mb-4 text-xs font-medium text-muted-foreground">Tendencia de Crecimiento</p>
                      <svg viewBox="0 0 330 80" className="h-28 w-full sm:h-32 lg:h-36" preserveAspectRatio="none">
                        <defs>
                          <linearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
                            <stop offset="0%" stopColor="hsl(187, 80%, 48%)" />
                            <stop offset="100%" stopColor="hsl(170, 60%, 50%)" />
                          </linearGradient>
                          <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="hsl(187, 80%, 48%)" stopOpacity="0.2" />
                            <stop offset="100%" stopColor="hsl(187, 80%, 48%)" stopOpacity="0" />
                          </linearGradient>
                        </defs>
                        {isInView && (
                          <>
                            <motion.path
                              d={`${pathD} L330,80 L0,80 Z`}
                              fill="url(#areaGrad)"
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              transition={{ delay: 0.6, duration: 1 }}
                            />
                            <motion.path
                              d={pathD}
                              fill="none"
                              stroke="url(#lineGrad)"
                              strokeWidth="2.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              initial={{ pathLength: 0, opacity: 0 }}
                              animate={{ pathLength: 1, opacity: 1 }}
                              transition={{ delay: 0.5, duration: 1.5, ease: "easeOut" }}
                            />
                            {linePoints.filter((_, i) => i % 3 === 0).map((p, i) => (
                              <motion.circle
                                key={i}
                                cx={p.x}
                                cy={p.y}
                                r="3"
                                fill="hsl(187, 80%, 48%)"
                                initial={{ scale: 0, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                transition={{ delay: 0.8 + i * 0.15, duration: 0.4 }}
                              />
                            ))}
                          </>
                        )}
                      </svg>
                    </div>
                  </div>

                  {/* Activity feed */}
                  <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-4 sm:p-5">
                    <p className="mb-3 text-xs font-medium text-muted-foreground">Actividad en Tiempo Real</p>
                    <div className="space-y-2">
                      {[
                        { text: "Dashboard 'Ventas Q1' generado con IA", time: "Hace 2 min", dot: "bg-primary" },
                        { text: "Reporte exportado a PDF por Ana García", time: "Hace 5 min", dot: "bg-emerald-500" },
                        { text: "Alerta KPI: Conversión > 95% detectada", time: "Hace 8 min", dot: "bg-yellow-500" },
                      ].map((item, i) => (
                        <motion.div
                          key={i}
                          initial={{ opacity: 0, x: -20 }}
                          animate={isInView ? { opacity: 1, x: 0 } : {}}
                          transition={{ delay: 1 + i * 0.15, duration: 0.5 }}
                          className="flex items-center gap-3 text-xs"
                        >
                          <span className={`h-2 w-2 animate-pulse rounded-full ${item.dot}`} />
                          <span className="flex-1 text-foreground/80">{item.text}</span>
                          <span className="text-muted-foreground">{item.time}</span>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Floating elements */}
              <motion.div
                animate={{ y: [0, -8, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                className="absolute -right-2 -top-2 h-20 w-20 rounded-xl gradient-primary opacity-20 blur-sm sm:-right-4 sm:-top-4"
              />
              <motion.div
                animate={{ y: [0, 10, 0] }}
                transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 1 }}
                className="absolute -bottom-2 -left-2 h-16 w-16 rounded-full bg-accent/20 blur-sm sm:-bottom-4 sm:-left-4"
              />
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}
