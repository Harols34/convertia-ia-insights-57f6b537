import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import heroImg from "@/assets/hero-dashboard.jpg";
import logoImg from "@/assets/logo.ico";

export function HeroSection() {
  return (
    <section className="relative min-h-screen flex items-center overflow-hidden gradient-hero">
      {/* Subtle grid */}
      <div className="absolute inset-0 opacity-[0.03]" style={{
        backgroundImage: "linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)",
        backgroundSize: "60px 60px"
      }} />

      {/* Glow orbs */}
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

            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-primary/30 bg-primary/5 text-sm text-primary">
              <Sparkles className="h-3.5 w-3.5" />
              <span>Impulsado por Inteligencia Artificial</span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-display font-bold text-white leading-[1.08] tracking-tight">
              Analítica avanzada para la era de la{" "}
              <span className="text-gradient">IA</span>
            </h1>

            <p className="text-lg lg:text-xl text-white/60 max-w-xl leading-relaxed">
              Transforma datos en decisiones estratégicas con dashboards inteligentes,
              AI Agents, speech analytics y automatización de última generación.
            </p>

            <div className="flex flex-wrap gap-4 pt-2">
              <Button
                size="lg"
                className="gradient-primary text-white font-semibold px-8 h-12 text-base glow-sm hover:opacity-90 transition-opacity"
                asChild
              >
                <a href="#contacto">
                  Solicitar Demo
                  <ArrowRight className="ml-2 h-4 w-4" />
                </a>
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="border-white/20 text-white hover:bg-white/10 h-12 px-8 text-base"
                asChild
              >
                <Link to="/login">Iniciar Sesión</Link>
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
