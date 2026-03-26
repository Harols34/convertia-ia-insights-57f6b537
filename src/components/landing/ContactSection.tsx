import { motion } from "framer-motion";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { RotatingHeadline } from "@/components/ui/rotating-headline";
import { contactCopyVariants } from "@/lib/landing-copy";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Send } from "lucide-react";

/** Campos siempre claros en la landing, incluso con tema oscuro global */
const contactFieldClass =
  "bg-white text-slate-900 border-slate-300 shadow-sm placeholder:text-slate-500 " +
  "focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-white " +
  "dark:bg-white dark:text-slate-900 dark:border-slate-300 dark:placeholder:text-slate-500 " +
  "dark:focus-visible:ring-offset-white";

export function ContactSection() {
  const [submitted, setSubmitted] = useState(false);

  return (
    <section id="contacto" className="py-24 lg:py-32 relative overflow-hidden">
      <div className="container max-w-2xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12 space-y-4"
        >
          <span className="text-sm font-semibold uppercase tracking-widest text-primary">Contacto</span>
          <RotatingHeadline
            items={contactCopyVariants}
            intervalMs={8400}
            minHeightClass="min-h-[12.5rem] sm:min-h-[11rem]"
            titleClassName="text-3xl sm:text-4xl font-display font-bold"
            subtitleClassName="text-gray-600"
            subtitleSweepClassName="text-primary"
            titleSurface="light"
          />
        </motion.div>

        {submitted ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center p-12 rounded-xl border border-primary/30 bg-primary/5">
            <p className="text-lg font-display font-semibold text-primary">¡Gracias por tu interés!</p>
            <p className="text-gray-500 mt-2">Nos pondremos en contacto contigo pronto.</p>
          </motion.div>
        ) : (
          <motion.form
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            onSubmit={(e) => { e.preventDefault(); setSubmitted(true); }}
            className="space-y-5 p-8 rounded-xl border border-slate-200 bg-white shadow-lg backdrop-blur-xl dark:border-slate-200 dark:bg-white"
          >
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-800">Nombre completo</label>
                <Input className={contactFieldClass} placeholder="Tu nombre" required />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-800">Correo electrónico</label>
                <Input className={contactFieldClass} type="email" placeholder="correo@empresa.com" required />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-800">Empresa</label>
              <Input className={contactFieldClass} placeholder="Nombre de tu empresa" required />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-800">Mensaje</label>
              <Textarea className={contactFieldClass} placeholder="Cuéntanos qué necesitas..." rows={4} required />
            </div>
            <Button type="submit" className="w-full gradient-primary text-white font-semibold h-11 glow-sm">
              Enviar solicitud <Send className="ml-2 h-4 w-4" />
            </Button>
          </motion.form>
        )}
      </div>
    </section>
  );
}
