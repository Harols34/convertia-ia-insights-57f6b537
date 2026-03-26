import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GradientCycleTitle } from "@/components/ui/gradient-cycle-title";
import { RevealLegend } from "@/components/ui/reveal-legend";
import heroImg from "@/assets/hero-dashboard.jpg";
import logoImg from "@/assets/logo.ico";
import { heroCopyVariants, heroPillVariants } from "@/lib/landing-copy";

/** Alineado al ciclo de título (8s) para que cambie la variante con la frase ya completa */
const HERO_ROTATE_MS = 8200;
const PILL_ROTATE_MS = 7000;

export function HeroSection() {
  const reduceMotion = useReducedMotion();
  const [heroIndex, setHeroIndex] = useState(0);
  const [pillIndex, setPillIndex] = useState(0);

  const variant = heroCopyVariants[reduceMotion ? 0 : heroIndex];
  const pillText = heroPillVariants[reduceMotion ? 0 : pillIndex];

  useEffect(() => {
    if (reduceMotion || heroCopyVariants.length <= 1) return;
    const id = window.setInterval(() => {
      setHeroIndex((i) => (i + 1) % heroCopyVariants.length);
    }, HERO_ROTATE_MS);
    return () => clearInterval(id);
  }, [reduceMotion]);

  useEffect(() => {
    if (reduceMotion || heroPillVariants.length <= 1) return;
    const id = window.setInterval(() => {
      setPillIndex((i) => (i + 1) % heroPillVariants.length);
    }, PILL_ROTATE_MS);
    return () => clearInterval(id);
  }, [reduceMotion]);

  const heroMotionKey = reduceMotion ? "static-h" : `${heroIndex}-${variant.title}`;

  return (
    <section className="relative min-h-screen flex items-center overflow-hidden">
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />

      <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] rounded-full bg-primary/10 blur-[120px]" />
      <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] rounded-full bg-accent/10 blur-[100px]" />

      <div className="container relative z-10 py-20 lg:py-32">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="space-y-8"
          >
            <div className="flex items-center gap-3 mb-4">
              <img src={logoImg} alt="Converti-IA" className="h-10 w-10" />
              <span className="text-xl font-display font-bold text-white tracking-tight">
                Converti-IA Analytics
              </span>
            </div>

            <div
              className="inline-flex min-h-[2.25rem] max-w-full items-center overflow-hidden rounded-full border border-primary/30 bg-primary/5 px-4 py-1.5 text-sm text-primary break-normal text-pretty"
              aria-live={reduceMotion ? undefined : "polite"}
            >
              <Sparkles className="mr-2 h-3.5 w-3.5 shrink-0" aria-hidden />
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={reduceMotion ? "static-pill" : pillText}
                  initial={reduceMotion ? false : { opacity: 0, y: 6, filter: "blur(4px)" }}
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  exit={reduceMotion ? undefined : { opacity: 0, y: -4, filter: "blur(3px)" }}
                  transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                  className="font-medium"
                >
                  {pillText}
                </motion.span>
              </AnimatePresence>
            </div>

            <div className="min-h-[8.5rem] sm:min-h-[7.5rem] lg:min-h-[8rem] max-w-full">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={heroMotionKey}
                  initial={reduceMotion ? false : { opacity: 0, y: 12, filter: "blur(8px)" }}
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  exit={reduceMotion ? undefined : { opacity: 0, y: -10, filter: "blur(5px)" }}
                  transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                >
                  <GradientCycleTitle
                    as="h1"
                    segments={variant.titleCycle}
                    className="text-left text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-display font-bold leading-[1.08] tracking-tight justify-start"
                  />
                </motion.div>
              </AnimatePresence>
            </div>

            <div className="min-h-[5.5rem] max-w-xl">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={heroMotionKey}
                  initial={reduceMotion ? false : { opacity: 0, y: 8, filter: "blur(5px)" }}
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  exit={reduceMotion ? undefined : { opacity: 0, y: -6, filter: "blur(3px)" }}
                  transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
                >
                  <RevealLegend
                    text={variant.subtitle}
                    animationKey={heroMotionKey}
                    className="text-lg lg:text-xl text-white/60 leading-relaxed"
                    sweepClassName="text-primary"
                    layout="start"
                  />
                </motion.div>
              </AnimatePresence>
            </div>

            <div className="flex flex-wrap gap-4 pt-2">
              <Button
                size="lg"
                className="gradient-primary text-white font-semibold px-8 h-12 text-base glow-sm hover:opacity-90 transition-opacity"
                asChild
              >
                <a href="#contacto">
                  Solicitar demo
                  <ArrowRight className="ml-2 h-4 w-4" />
                </a>
              </Button>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="relative hidden lg:block"
          >
            <div className="relative rounded-xl overflow-hidden glow-primary">
              <img
                src={heroImg}
                alt="Dashboard de analítica avanzada"
                className="w-full rounded-xl"
                loading="eager"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[hsl(220,25%,7%)] via-transparent to-transparent opacity-60" />
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
