import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Eye, EyeOff, LogIn, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { ThemeToggle } from "@/components/ThemeToggle";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import logoImg from "@/assets/logo.ico";

const LoginPage = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!authLoading && user) {
      navigate("/app", { replace: true });
    }
  }, [user, authLoading, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!email || !password) {
      setError("Por favor completa todos los campos.");
      return;
    }
    setLoading(true);
    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setLoading(false);
    if (authError) {
      setError("Credenciales incorrectas. Verifica tu correo y contraseña.");
      return;
    }
    navigate("/app");
  };

  return (
    <div className="min-h-screen flex">
      {/* Left visual panel */}
      <div className="hidden lg:flex lg:w-1/2 gradient-hero relative overflow-hidden items-center justify-center p-12">
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: "linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)",
          backgroundSize: "40px 40px"
        }} />
        <div className="absolute top-1/3 left-1/3 w-[400px] h-[400px] rounded-full bg-primary/15 blur-[100px]" />
        <div className="absolute bottom-1/4 right-1/4 w-[300px] h-[300px] rounded-full bg-accent/10 blur-[80px]" />
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="relative z-10 text-center space-y-6"
        >
          <img src={logoImg} alt="Converti-IA" className="h-16 w-16 mx-auto" />
          <h2 className="text-3xl font-display font-bold text-white">Converti-IA Analytics</h2>
          <p className="text-white/50 max-w-sm mx-auto">
            Analítica avanzada, automatización e inteligencia artificial para transformar la operación de tu empresa.
          </p>
        </motion.div>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex flex-col bg-background">
        <div className="flex items-center justify-between p-4">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/"><ArrowLeft className="h-4 w-4 mr-1" /> Volver</Link>
          </Button>
          <ThemeToggle />
        </div>

        <div className="flex-1 flex items-center justify-center p-6">
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="w-full max-w-sm space-y-8"
          >
            <div className="lg:hidden flex items-center gap-2 mb-4">
              <img src={logoImg} alt="Converti-IA" className="h-8 w-8" />
              <span className="font-display font-bold text-lg">Converti-IA</span>
            </div>

            <div className="space-y-2">
              <h1 className="text-2xl font-display font-bold">Iniciar sesión</h1>
              <p className="text-muted-foreground text-sm">
                Ingresa tus credenciales para acceder a la plataforma.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <div className="p-3 rounded-lg border border-destructive/30 bg-destructive/5 text-sm text-destructive">
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <label className="text-sm font-medium">Correo electrónico</label>
                <Input
                  type="email"
                  placeholder="correo@empresa.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-11"
                  autoComplete="email"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">Contraseña</label>
                  <Link to="/recuperar" className="text-xs text-primary hover:underline">
                    ¿Olvidaste tu contraseña?
                  </Link>
                </div>
                <div className="relative">
                  <Input
                    type={showPw ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-11 pr-10"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowPw(!showPw)}
                  >
                    {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Checkbox
                  id="remember"
                  checked={remember}
                  onCheckedChange={(c) => setRemember(c === true)}
                />
                <label htmlFor="remember" className="text-sm text-muted-foreground cursor-pointer">
                  Recordar sesión
                </label>
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full h-11 gradient-primary text-white font-semibold glow-sm"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Ingresando...
                  </span>
                ) : (
                  <>Ingresar <LogIn className="ml-2 h-4 w-4" /></>
                )}
              </Button>
            </form>

            <div className="text-center text-xs text-muted-foreground pt-4">
              <p>¿Necesitas acceso? Contacta al administrador de tu empresa.</p>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
