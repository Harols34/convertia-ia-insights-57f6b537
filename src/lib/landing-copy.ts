/** Copy premium landing — variantes para rotación y textos estáticos */

export type HeroCopyVariant = {
  /** Clave estable para animación */
  title: string;
  titleCycle: readonly [string, string, string];
  subtitle: string;
};

export const heroCopyVariants: HeroCopyVariant[] = [
  {
    title: "hero-analitica",
    titleCycle: ["Analítica que acelera", "decisiones", "sin fricción"],
    subtitle:
      "Una plataforma integral que combina analítica avanzada inteligencia artificial y automatización para potenciar la toma de decisiones",
  },
  {
    title: "hero-crecimiento",
    titleCycle: ["Convierte datos en", "crecimiento", "medible"],
    subtitle: "Dashboards listos para ejecutar con señal clara y sin depender de colas eternas de desarrollo",
  },
  {
    title: "hero-listos",
    titleCycle: ["Tus datos", "listos", "para accionar"],
    subtitle: "De la pregunta al tablero útil en minutos con el mismo stack para BI IA y automatización",
  },
  {
    title: "hero-capa",
    titleCycle: ["La capa inteligente", "de tu", "operación"],
    subtitle: "Visibilidad de punta a punta con gobierno del dato permisos finos y una experiencia premium unificada",
  },
  {
    title: "hero-stack",
    titleCycle: ["IA", "BI y automatización", "en un solo stack"],
    subtitle: "Menos fricción más claridad ejecutiva y trazabilidad del insight desde el primer día",
  },
];

export const heroPillVariants = [
  "IA · Analítica · Automatización",
  "Dashboards listos para ejecutar",
  "Insights en lenguaje natural",
  "BI enterprise sin fricción",
  "Un stack, visibilidad total",
];

export type TitleSubtitle = {
  title: string;
  subtitle: string;
  /** Tres fragmentos para `GradientCycleTitle` / `TextColorHeadline` */
  titleCycle?: readonly [string, string, string];
};

export const platformHeadlineVariants: TitleSubtitle[] = [
  {
    title: "plataforma-dash-vida",
    titleCycle: ["Dashboards que", "cobran vida", "en tiempo real"],
    subtitle:
      "KPIs gráficos y alertas en una sola experiencia fluida con cuatro formas de construir analítica sin saltar entre herramientas",
  },
  {
    title: "plataforma-bi-vivo",
    titleCycle: ["BI en vivo", "sin fricción", "enterprise"],
    subtitle:
      "Enterprise IA lenguaje natural y constructor visual reunidos para que tu equipo pase del dato a la decisión sin perder contexto",
  },
  {
    title: "plataforma-crea",
    titleCycle: ["Crea", "analiza", "y decide"],
    subtitle:
      "Demo viva de tableros insights con IA y análisis tipo pivote para que veas el producto como lo usarías en operación real",
  },
  {
    title: "plataforma-insights",
    titleCycle: ["Insights que", "se entienden", "al instante"],
    subtitle:
      "Claridad ejecutiva en cada vista con narrativa visual pensada para dirección y equipos de datos por igual",
  },
  {
    title: "plataforma-equipos",
    titleCycle: ["Analítica visual", "para equipos", "modernos"],
    subtitle:
      "Una experiencia premium alineada a cómo trabajan hoy squads de producto revenue y operaciones",
  },
];

export const servicesHeadlineVariants: TitleSubtitle[] = [
  {
    title: "servicios-escala",
    titleCycle: ["Plataforma integral", "analítica e IA", "en un solo lugar"],
    subtitle:
      "Una plataforma integral que combina analítica avanzada inteligencia artificial y automatización para potenciar la toma de decisiones con menos fricción operativa",
  },
  {
    title: "servicios-multicap",
    titleCycle: ["Una sola plataforma", "múltiples capacidades", "cero dispersión"],
    subtitle:
      "Centraliza lo esencial para decidir sin repartir cuellos de botella entre cinco herramientas distintas",
  },
  {
    title: "servicios-datos",
    titleCycle: ["De datos dispersos", "a decisiones", "claras y accionables"],
    subtitle: "Una sola capa para BI IA y automatización con gobierno del dato desde el primer día",
  },
  {
    title: "servicios-auto",
    titleCycle: ["Automatiza el análisis", "acelera la ejecución", "sin cuellos de botella"],
    subtitle:
      "Activa alertas reportes y agentes donde la operación necesita respuesta sin esperar otro ciclo de desarrollo",
  },
  {
    title: "servicios-complejidad",
    titleCycle: ["Analítica avanzada", "en la práctica", "sin complejidad innecesaria"],
    subtitle:
      "Diseñada para equipos que priorizan velocidad claridad y control sin sacrificar profundidad analítica",
  },
];

export const benefitsHeadlineVariants: TitleSubtitle[] = [
  {
    title: "benef-velocidad",
    titleCycle: ["Velocidad", "claridad", "y control"],
    subtitle:
      "Lo esencial para un equipo que vive del dato con señales accionables gobierno y una experiencia ejecutiva limpia",
  },
  {
    title: "benef-ia",
    titleCycle: ["IA aplicada", "a resultados", "reales"],
    subtitle: "Menos ruido operativo y más impacto medible en KPIs con modelos integrados al flujo de trabajo",
  },
  {
    title: "benef-friccion",
    titleCycle: ["Menos fricción", "más visibilidad", "operativa"],
    subtitle: "Un stack que escala con tu operación y mantiene trazabilidad desde el insight hasta la acción",
  },
  {
    title: "benef-tech",
    titleCycle: ["Tecnología", "lista para", "escalar"],
    subtitle: "Seguridad permisos multicanal y arquitectura SaaS pensada para crecer contigo desde el día uno",
  },
  {
    title: "benef-operar",
    titleCycle: ["Diseñado", "para operar", "mejor"],
    subtitle: "Ejecutivo directo y sin sobrecarga visual para que dirección y equipos tácticos compartan la misma verdad",
  },
];

export const ctaCopyVariants: TitleSubtitle[] = [
  {
    title: "cta-datos",
    titleCycle: ["Haz que tus datos", "trabajen", "para ti"],
    subtitle: "Agenda una demo con foco en tus casos reales sin diapositivas genéricas ni promesas vacías",
  },
  {
    title: "cta-decidir",
    titleCycle: ["Empieza a decidir", "con ventaja", "medible"],
    subtitle: "El camino más corto al primer dashboard útil con acompañamiento de especialistas en menos de veinticuatro horas",
  },
  {
    title: "cta-operacion",
    titleCycle: ["Lleva tu operación", "a otro nivel", "de analítica"],
    subtitle: "Un producto que se ve se entiende y se usa en el día a día sin depender de un solo analista héroe",
  },
  {
    title: "cta-dashboard",
    titleCycle: ["Tu próximo dashboard", "empieza", "aquí"],
    subtitle: "Te mostramos el flujo completo desde la fuente hasta el insight con una conversación directa y sin presión",
  },
  {
    title: "cta-accion",
    titleCycle: ["Convierte información", "en acción", "continua"],
    subtitle: "Menos informes estáticos y más decisiones con contexto listo para ejecutar en tu operación",
  },
];

export const contactCopyVariants: TitleSubtitle[] = [
  {
    title: "contacto-analitico",
    titleCycle: ["Hablemos de tu", "próximo", "sistema analítico"],
    subtitle: "Cuéntanos tu contexto en pocas líneas y te respondemos en menos de veinticuatro horas con un plan claro",
  },
  {
    title: "contacto-auto",
    titleCycle: ["Cuéntanos qué", "quieres", "automatizar"],
    subtitle: "Priorizamos tu mensaje y te devolvemos el siguiente paso sin vueltas ni burocracia innecesaria",
  },
  {
    title: "contacto-capa",
    titleCycle: ["Diseñemos", "tu capa", "de inteligencia"],
    subtitle: "Una conversación corta orientada a valor para alinear expectativas alcance y quick wins",
  },
  {
    title: "contacto-demo",
    titleCycle: ["Empieza tu demo", "personalizada", "hoy"],
    subtitle: "Nombre empresa y reto con eso arrancamos y preparamos una sesión útil con tus propios casos",
  },
  {
    title: "contacto-datos",
    titleCycle: ["Construyamos", "algo útil", "con tus datos"],
    subtitle: "Experiencia premium directa y sin formularios eternos porque tu tiempo también es un activo",
  },
];

export type ServiceCardCopy = { title: string; tagline: string; desc: string };

/** Títulos + leyendas premium; descripciones largas originales de la landing */
export const servicesCards: ServiceCardCopy[] = [
  {
    title: "Dashboards inteligentes",
    tagline: "Ejecuta y filtra KPIs con tableros listos para dirección",
    desc: "Tableros de control ejecutivos con KPIs en tiempo real, filtros avanzados y personalización total.",
  },
  {
    title: "IA generativa para BI",
    tagline: "Pregunta en lenguaje natural y obtén visualizaciones al instante",
    desc: "Genera dashboards y reportes con lenguaje natural. Pregunta y obtén visualizaciones al instante.",
  },
  {
    title: "Analytics conversacional",
    tagline: "Unifica sentimiento temas y desempeño de todos los canales",
    desc: "Analiza conversaciones de todos tus canales para extraer insights, sentimientos y tendencias.",
  },
  {
    title: "Chatbots y AI Agents",
    tagline: "Despliega agentes donde ya conversan tus clientes",
    desc: "Agentes inteligentes para web, WhatsApp y Telegram con configuración personalizada por tenant.",
  },
  {
    title: "Speech analytics",
    tagline: "Transcribe mide calidad y detecta emociones en cada llamada",
    desc: "Análisis de voz con transcripción automática, detección de emociones y métricas de calidad.",
  },
  {
    title: "Automatización",
    tagline: "Programa alertas reportes y acciones cuando el dato lo exija",
    desc: "Flujos automatizados para alertas, reportes programados y acciones inteligentes basadas en datos.",
  },
  {
    title: "Reportes ejecutivos",
    tagline: "Narrativa corporativa lista para comités y board",
    desc: "Genera reportes profesionales con branding corporativo listos para presentar a dirección.",
  },
  {
    title: "Exportaciones avanzadas",
    tagline: "Salidas trazables a PDF PPTX Excel y CSV por usuario",
    desc: "Exporta a PDF, PPTX, Excel y CSV con trazabilidad completa y historial por usuario.",
  },
  {
    title: "Monitoreo de KPIs",
    tagline: "Avisos cuando un indicador sale del rango que definiste",
    desc: "Alertas inteligentes cuando tus indicadores superan umbrales críticos definidos por ti.",
  },
  {
    title: "Integraciones",
    tagline: "Conecta APIs hojas y bases con sincronización ordenada",
    desc: "Conecta APIs, Google Sheets, bases de datos y fuentes empresariales con sincronización automática.",
  },
];

export type BenefitCardCopy = { title: string; desc: string };

export const benefitsCards: BenefitCardCopy[] = [
  { title: "Velocidad real", desc: "De la pregunta al insight en minutos, sin depender de IT para cada cambio." },
  { title: "Seguridad enterprise", desc: "Multi-tenant, roles finos y auditoría para operar con tranquilidad." },
  { title: "Todo canal, una vista", desc: "Web, WhatsApp, Telegram y voz convergen en la misma analítica." },
  { title: "Control granular", desc: "Permisos por módulo, cuenta y acción: cada usuario ve lo que debe." },
  { title: "Escala sin drama", desc: "Arquitectura SaaS pensada para crecer contigo, de equipo a corporativo." },
  { title: "Equipos alineados", desc: "Misma plataforma, vistas personalizadas: menos reuniones, más contexto." },
];
