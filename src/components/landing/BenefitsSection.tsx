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
    <section id="beneficios" className="py-24 lg:py-32 relative overflow-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-white/5 blur-[150px]" />
      <div className="container relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16 space-y-4"
        >
          <span className="text-sm font-semibold uppercase tracking-widest text-primary">Beneficios</span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-display font-bold text-white">
            ¿Por qué elegir Converti-IA?
          </h2>
          <p className="text-white/50 text-lg max-w-2xl mx-auto">
            Tecnología de vanguardia al servicio de tu operación comercial.
          </p>
        </motion.div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {benefits.map((b, i) => (
            <motion.div
              key={b.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              className="p-6 rounded-xl glass-dark hover:border-primary/30 transition-colors"
            >
              <b.icon className="h-8 w-8 text-primary mb-4" />
              <h3 className="font-display font-semibold text-white mb-2 text-lg">{b.title}</h3>
              <p className="text-white/50 text-sm leading-relaxed">{b.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
