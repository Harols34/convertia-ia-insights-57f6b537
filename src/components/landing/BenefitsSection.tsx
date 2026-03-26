import { motion } from "framer-motion";
import { Shield, Zap, Globe, Lock, TrendingUp, Users } from "lucide-react";
import { RotatingHeadline } from "@/components/ui/rotating-headline";
import { benefitsCards, benefitsHeadlineVariants } from "@/lib/landing-copy";

const benefitIcons = [Zap, Shield, Globe, Lock, TrendingUp, Users] as const;

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
              <RotatingHeadline
                items={benefitsHeadlineVariants}
                intervalMs={8200}
                minHeightClass="min-h-[13rem] sm:min-h-[11.5rem] lg:min-h-[10.5rem]"
                titleClassName="font-display text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl"
                subtitleClassName="mx-auto max-w-2xl font-medium leading-relaxed text-emerald-100/85"
              />
            </motion.div>

            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {benefitsCards.map((b, i) => {
                const Icon = benefitIcons[i];
                return (
                <motion.div
                  key={b.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.08 }}
                  className="rounded-xl border border-emerald-500/15 bg-white/[0.04] p-6 backdrop-blur-sm transition-all duration-300 hover:border-accent/50 hover:bg-emerald-500/[0.06] hover:shadow-lg hover:shadow-accent/10"
                >
                  <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-accent text-white shadow-md shadow-accent/20">
                    <Icon className="h-5 w-5" strokeWidth={2} />
                  </div>
                  <h3 className="mb-2 font-display text-lg font-semibold text-white">{b.title}</h3>
                  <p className="text-sm leading-relaxed text-emerald-100/65 break-normal hyphens-none [overflow-wrap:normal] [word-break:normal]">
                    {b.desc}
                  </p>
                </motion.div>
              );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
