import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ThemeToggle } from "@/components/ThemeToggle";
import { supabase } from "@/integrations/supabase/client";
import logoImg from "@/assets/logo.ico";

const RecoverPage = () => {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    setSent(true);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="absolute top-4 right-4"><ThemeToggle /></div>
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm space-y-6"
      >
        <div className="flex items-center gap-2">
          <img src={logoImg} alt="Converti-IA" className="h-8 w-8" />
          <span className="font-display font-bold text-lg">Converti-IA</span>
        </div>

        {sent ? (
          <div className="space-y-4 text-center p-8 rounded-xl border border-primary/30 bg-primary/5">
            <Mail className="h-10 w-10 text-primary mx-auto" />
            <h2 className="text-xl font-display font-bold">Revisa tu correo</h2>
            <p className="text-sm text-muted-foreground">
              Si la cuenta existe, recibirás un enlace para restablecer tu contraseña.
            </p>
            <Button variant="outline" size="sm" asChild>
              <Link to="/login"><ArrowLeft className="h-4 w-4 mr-1" /> Volver al login</Link>
            </Button>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <h1 className="text-2xl font-display font-bold">Recuperar contraseña</h1>
              <p className="text-sm text-muted-foreground">
                Ingresa tu correo electrónico y te enviaremos un enlace para restablecer tu contraseña.
              </p>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Correo electrónico</label>
                <Input
                  type="email"
                  placeholder="correo@empresa.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-11"
                  required
                />
              </div>
              <Button type="submit" disabled={loading} className="w-full h-11 gradient-primary text-white font-semibold">
                {loading ? "Enviando..." : "Enviar enlace"}
              </Button>
            </form>
            <Button variant="ghost" size="sm" className="w-full" asChild>
              <Link to="/login"><ArrowLeft className="h-4 w-4 mr-1" /> Volver al login</Link>
            </Button>
          </>
        )}
      </motion.div>
    </div>
  );
};

export default RecoverPage;
