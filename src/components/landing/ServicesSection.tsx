import { motion } from "framer-motion";
import {
  BarChart3, Brain, MessageSquare, Bot, Mic, Workflow,
  FileBarChart, Download, Activity, Plug
} from "lucide-react";
import { RotatingHeadline } from "@/components/ui/rotating-headline";
import { servicesCards, servicesHeadlineVariants } from "@/lib/landing-copy";

const serviceIcons = [
  BarChart3, Brain, MessageSquare, Bot, Mic, Workflow,
  FileBarChart, Download, Activity, Plug,
] as const;

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
              <RotatingHeadline
                items={servicesHeadlineVariants}
                intervalMs={8200}
                minHeightClass="min-h-[15rem] sm:min-h-[13.5rem] lg:min-h-[12.5rem]"
                titleClassName="font-display text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl"
                subtitleClassName="mx-auto max-w-2xl font-medium leading-relaxed text-white/75"
              />
            </motion.div>

            <motion.div
              variants={container}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true }}
              className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5"
            >
              {servicesCards.map((s, i) => {
                const Icon = serviceIcons[i];
                return (
                <motion.div
                  key={s.title}
                  variants={item}
                  className="group relative rounded-xl border border-white/[0.08] bg-white/[0.04] p-6 backdrop-blur-sm transition-all duration-300 hover:border-primary/45 hover:bg-white/[0.06] hover:shadow-lg hover:shadow-primary/10"
                >
                  <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg gradient-primary transition-shadow group-hover:glow-sm">
                    <Icon className="h-5 w-5 text-white" />
                  </div>
                  <h3 className="mb-1 font-display font-semibold text-white">{s.title}</h3>
                  <p className="mb-2 text-sm font-medium leading-snug text-primary/90 break-normal hyphens-none [overflow-wrap:normal] [word-break:normal]">
                    {s.tagline}
                  </p>
                  <p className="text-sm leading-relaxed text-white/60 break-normal hyphens-none [overflow-wrap:normal] [word-break:normal]">
                    {s.desc}
                  </p>
                </motion.div>
              );
              })}
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}
