import { motion } from "framer-motion";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Send } from "lucide-react";

export function ContactSection() {
  const [submitted, setSubmitted] = useState(false);

  return (
    <section id="contacto" className="py-24 lg:py-32 gradient-hero relative overflow-hidden">
      <div className="container max-w-2xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12 space-y-4"
        >
          <span className="text-sm font-semibold uppercase tracking-widest text-primary">Contacto</span>
          <h2 className="text-3xl sm:text-4xl font-display font-bold">
            Hablemos de tu proyecto
          </h2>
          <p className="text-muted-foreground">
            Completa el formulario y un especialista te contactará en menos de 24 horas.
          </p>
        </motion.div>

        {submitted ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center p-12 rounded-xl border border-primary/30 bg-primary/5">
            <p className="text-lg font-display font-semibold text-primary">¡Gracias por tu interés!</p>
            <p className="text-muted-foreground mt-2">Nos pondremos en contacto contigo pronto.</p>
          </motion.div>
        ) : (
          <motion.form
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            onSubmit={(e) => { e.preventDefault(); setSubmitted(true); }}
            className="space-y-5 p-8 rounded-xl border border-border bg-card"
          >
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Nombre completo</label>
                <Input placeholder="Tu nombre" required />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Correo electrónico</label>
                <Input type="email" placeholder="correo@empresa.com" required />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Empresa</label>
              <Input placeholder="Nombre de tu empresa" required />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Mensaje</label>
              <Textarea placeholder="Cuéntanos qué necesitas..." rows={4} required />
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
