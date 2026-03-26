import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export function CTASection() {
  return (
    <section className="py-24 lg:py-32">
      <div className="container">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="relative rounded-2xl overflow-hidden gradient-hero p-12 lg:p-20 text-center"
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,hsl(187_80%_42%/0.08),transparent_70%)]" />
          <div className="relative z-10 max-w-2xl mx-auto space-y-6">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-display font-bold text-white">
              Comienza a transformar tus datos <span className="text-gradient">hoy</span>
            </h2>
            <p className="text-white/50 text-lg">
              Agenda una demo personalizada y descubre cómo Converti-IA Analytics puede potenciar tu operación.
            </p>
            <div className="flex flex-wrap justify-center gap-4 pt-4">
              <Button size="lg" className="gradient-primary text-white font-semibold px-8 h-12 glow-sm" asChild>
                <a href="#contacto">
                  Solicitar Demo <ArrowRight className="ml-2 h-4 w-4" />
                </a>
              </Button>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
