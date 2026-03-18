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
    <section className="py-24 lg:py-32 relative overflow-hidden">
      <div className="container">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16 space-y-4"
        >
          <span className="text-sm font-semibold uppercase tracking-widest text-primary">Plataforma en Acción</span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-display font-bold text-white">
            Analítica que se ve <span className="text-gradient">increíble</span>
          </h2>
          <p className="text-white/60 text-lg max-w-2xl mx-auto">
            Dashboards inteligentes que transforman tus datos en decisiones estratégicas en tiempo real.
          </p>
        </motion.div>

        <motion.div
          ref={ref}
          initial={{ opacity: 0, y: 40, scale: 0.95 }}
          whileInView={{ opacity: 1, y: 0, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
          className="relative max-w-5xl mx-auto"
        >
          {/* Glow behind */}
          <div className="absolute -inset-4 rounded-2xl bg-primary/10 blur-[60px] opacity-50" />

          {/* Dashboard frame */}
          <div className="relative rounded-xl border border-border/60 bg-card/90 backdrop-blur-xl overflow-hidden shadow-2xl shadow-primary/5">
            {/* Top bar */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border/50 bg-muted/30">
              <div className="flex gap-1.5">
                <span className="w-3 h-3 rounded-full bg-destructive/60" />
                <span className="w-3 h-3 rounded-full bg-yellow-500/60" />
                <span className="w-3 h-3 rounded-full bg-emerald-500/60" />
              </div>
              <div className="flex-1 flex justify-center">
                <div className="px-4 py-1 rounded-md bg-muted text-[11px] text-muted-foreground font-mono">
                  converti-ia.app/dashboards
                </div>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* KPI row */}
              {isInView && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <KpiCard label="Conversiones" value="12,847" change="▲ 23.5%" delay={0.2} />
                  <KpiCard label="Revenue" value="$1.4M" change="▲ 18.2%" delay={0.35} />
                  <KpiCard label="Retención" value="94.7%" change="▲ 3.1%" delay={0.5} />
                  <KpiCard label="NPS Score" value="78" change="▲ 12 pts" delay={0.65} />
                </div>
              )}

              <div className="grid sm:grid-cols-2 gap-4">
                {/* Bar chart */}
                <div className="rounded-lg p-4 bg-white/[0.03] border border-white/[0.06]">
                  <p className="text-xs text-muted-foreground font-medium mb-4">Ventas Mensuales</p>
                  <div className="flex items-end gap-1.5 h-24">
                    {barHeights.map((h, i) => (
                      <motion.div
                        key={i}
                        initial={{ height: 0 }}
                        animate={isInView ? { height: `${h}%` } : {}}
                        transition={{ delay: 0.3 + i * 0.06, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                        className="flex-1 rounded-sm gradient-primary opacity-80 hover:opacity-100 transition-opacity cursor-pointer"
                      />
                    ))}
                  </div>
                  <div className="flex justify-between mt-2">
                    <span className="text-[9px] text-muted-foreground">Ene</span>
                    <span className="text-[9px] text-muted-foreground">Dic</span>
                  </div>
                </div>

                {/* Line chart */}
                <div className="rounded-lg p-4 bg-white/[0.03] border border-white/[0.06]">
                  <p className="text-xs text-muted-foreground font-medium mb-4">Tendencia de Crecimiento</p>
                  <svg viewBox="0 0 330 80" className="w-full h-24" preserveAspectRatio="none">
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
              <div className="rounded-lg p-4 bg-white/[0.03] border border-white/[0.06]">
                <p className="text-xs text-muted-foreground font-medium mb-3">Actividad en Tiempo Real</p>
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
                      <span className={`w-2 h-2 rounded-full ${item.dot} animate-pulse`} />
                      <span className="text-foreground/80 flex-1">{item.text}</span>
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
            className="absolute -top-4 -right-4 w-20 h-20 rounded-xl gradient-primary opacity-20 blur-sm"
          />
          <motion.div
            animate={{ y: [0, 10, 0] }}
            transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 1 }}
            className="absolute -bottom-4 -left-4 w-16 h-16 rounded-full bg-accent/20 blur-sm"
          />
        </motion.div>
      </div>
    </section>
  );
}
