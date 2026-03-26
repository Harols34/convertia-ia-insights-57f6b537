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
    <section id="servicios" className="py-24 lg:py-32">
      <div className="container">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16 space-y-4"
        >
          <span className="text-sm font-semibold uppercase tracking-widest text-primary">Servicios</span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-display font-bold text-foreground">
            Todo lo que necesitas para{" "}
            <span className="text-gradient">crecer con datos</span>
          </h2>
          <p className="text-foreground/70 text-lg max-w-2xl mx-auto">
            Una plataforma integral que combina analítica avanzada, inteligencia artificial y automatización para potenciar la toma de decisiones.
          </p>
        </motion.div>

        <motion.div
          variants={container}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true }}
          className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4"
        >
          {services.map((s) => (
            <motion.div
              key={s.title}
              variants={item}
              className="group relative p-6 rounded-xl border border-border bg-card/80 backdrop-blur-sm hover:border-primary/40 transition-all duration-300 hover:shadow-lg hover:shadow-primary/5"
            >
              <div className="w-10 h-10 rounded-lg gradient-primary flex items-center justify-center mb-4 group-hover:glow-sm transition-shadow">
                <s.icon className="h-5 w-5 text-white" />
              </div>
              <h3 className="font-display font-semibold text-foreground mb-2">{s.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{s.desc}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
