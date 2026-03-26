import { motion } from "framer-motion";
import { Shield, Zap, Globe, Lock, TrendingUp, Users } from "lucide-react";

const benefits = [
  { icon: Zap, title: "Resultados en Minutos", desc: "Genera dashboards con lenguaje natural y obtén insights al instante sin programar." },
  { icon: Shield, title: "Seguridad Enterprise", desc: "Multi-tenant con aislamiento total de datos, roles granulares y auditoría completa." },
  { icon: Globe, title: "Multi-canal", desc: "Analiza datos de web, WhatsApp, Telegram, voz y cualquier fuente conectada." },
  { icon: Lock, title: "Control de Acceso", desc: "Permisos granulares por módulo, cuenta, proyecto y acción para cada usuario." },
  { icon: TrendingUp, title: "Escalabilidad SaaS", desc: "Arquitectura diseñada para crecer con tu empresa desde startup hasta enterprise." },
  { icon: Users, title: "Colaboración", desc: "Equipos completos trabajan en la misma plataforma con vistas personalizadas." },
];

export function BenefitsSection() {
  return (
    <section id="beneficios" className="relative py-16 sm:py-20 lg:py-24">
      <div className="container">
        <div className="relative overflow-hidden rounded-3xl border border-emerald-500/20 gradient-hero px-5 py-10 shadow-2xl shadow-black/35 sm:px-8 sm:py-12 lg:px-10 lg:py-14">
          {/* Resplandor verde (misma familia que el extremo accent de "crecer con datos") */}
          <div
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,hsl(var(--accent)_/_0.18),transparent_65%)]"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_0%,hsl(var(--primary)_/_0.08),transparent_55%)]"
            aria-hidden
          />

          <div className="relative z-10">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="mb-10 space-y-5 text-center sm:mb-12 lg:mb-14"
            >
              <span className="text-sm font-semibold uppercase tracking-widest text-accent">
                Beneficios
              </span>
              <h2 className="font-display text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl">
                ¿Por qué elegir{" "}
                <span className="text-gradient">Converti-IA</span>?
              </h2>
              <p className="mx-auto max-w-2xl text-lg font-medium leading-relaxed text-emerald-100/85">
                Tecnología de vanguardia al servicio de tu operación comercial.
              </p>
            </motion.div>

            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {benefits.map((b, i) => (
                <motion.div
                  key={b.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.08 }}
                  className="rounded-xl border border-emerald-500/15 bg-white/[0.04] p-6 backdrop-blur-sm transition-all duration-300 hover:border-accent/50 hover:bg-emerald-500/[0.06] hover:shadow-lg hover:shadow-accent/10"
                >
                  <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-accent text-white shadow-md shadow-accent/20">
                    <b.icon className="h-5 w-5" strokeWidth={2} />
                  </div>
                  <h3 className="mb-2 font-display text-lg font-semibold text-white">{b.title}</h3>
                  <p className="text-sm leading-relaxed text-emerald-100/65">{b.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
