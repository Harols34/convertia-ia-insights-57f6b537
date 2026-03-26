import { motion } from "framer-motion";
import {
  BarChart3, Brain, MessageSquare, Bot, Mic, Workflow,
  FileBarChart, Download, Activity, Plug
} from "lucide-react";

const services = [
  { icon: BarChart3, title: "Dashboards Inteligentes", desc: "Tableros de control ejecutivos con KPIs en tiempo real, filtros avanzados y personalización total." },
  { icon: Brain, title: "IA Generativa para BI", desc: "Genera dashboards y reportes con lenguaje natural. Pregunta y obtén visualizaciones al instante." },
  { icon: MessageSquare, title: "Analytics Conversacional", desc: "Analiza conversaciones de todos tus canales para extraer insights, sentimientos y tendencias." },
  { icon: Bot, title: "Chatbots & AI Agents", desc: "Agentes inteligentes para web, WhatsApp y Telegram con configuración personalizada por tenant." },
  { icon: Mic, title: "Speech Analytics", desc: "Análisis de voz con transcripción automática, detección de emociones y métricas de calidad." },
  { icon: Workflow, title: "Automatización", desc: "Flujos automatizados para alertas, reportes programados y acciones inteligentes basadas en datos." },
  { icon: FileBarChart, title: "Reportes Ejecutivos", desc: "Genera reportes profesionales con branding corporativo listos para presentar a dirección." },
  { icon: Download, title: "Exportaciones Avanzadas", desc: "Exporta a PDF, PPTX, Excel y CSV con trazabilidad completa y historial por usuario." },
  { icon: Activity, title: "Monitoreo de KPIs", desc: "Alertas inteligentes cuando tus indicadores superan umbrales críticos definidos por ti." },
  { icon: Plug, title: "Integraciones", desc: "Conecta APIs, Google Sheets, bases de datos y fuentes empresariales con sincronización automática." },
];

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
};
const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] } },
};

export function ServicesSection() {
  return (
    <section id="servicios" className="py-16 sm:py-20 lg:py-24">
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
              className="mb-10 space-y-5 text-center sm:mb-12 lg:mb-14"
            >
              <span className="text-sm font-semibold uppercase tracking-widest text-primary">
                Servicios
              </span>
              <h2 className="font-display text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl">
                Todo lo que necesitas para{" "}
                <span className="text-gradient">crecer con datos</span>
              </h2>
              <p className="mx-auto max-w-2xl text-lg font-medium leading-relaxed text-white/75">
                Una plataforma integral que combina analítica avanzada, inteligencia artificial y
                automatización para potenciar la toma de decisiones.
              </p>
            </motion.div>

            <motion.div
              variants={container}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true }}
              className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5"
            >
              {services.map((s) => (
                <motion.div
                  key={s.title}
                  variants={item}
                  className="group relative rounded-xl border border-white/[0.08] bg-white/[0.04] p-6 backdrop-blur-sm transition-all duration-300 hover:border-primary/45 hover:bg-white/[0.06] hover:shadow-lg hover:shadow-primary/10"
                >
                  <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg gradient-primary transition-shadow group-hover:glow-sm">
                    <s.icon className="h-5 w-5 text-white" />
                  </div>
                  <h3 className="mb-2 font-display font-semibold text-white">{s.title}</h3>
                  <p className="text-sm leading-relaxed text-white/60">{s.desc}</p>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}
