import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Loader2, Database } from "lucide-react";
import { useDashboardLeadsDataset } from "@/hooks/use-dashboard-leads-dataset";

export function AppDataLoader({ children }: { children: React.ReactNode }) {
  const [progress, setProgress] = useState(0);
  const [showOverlay, setShowOverlay] = useState(true);

  // No usamos useDashboardLeadsDataset aquí directamente si queremos que sea ligero.
  // En su lugar, el AppDataLoader simplemente asegura que la estructura esté lista
  // y podemos opcionalmente disparar una precarga silenciosa o simplemente dejar que
  // cada dashboard pida lo que necesite.
  
  const isLoading = false; // Ya no bloqueamos globalmente por el dataset pesado
  const isError = false;
  const data = true; 

  // Una vez que tenemos data, esperamos un poco para que la transición sea suave
  useEffect(() => {
    if (!isLoading && data) {
      const t = setTimeout(() => setShowOverlay(false), 800);
      return () => clearTimeout(t);
    }
  }, [isLoading, data]);

  if (isError) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center bg-background p-6 text-center">
        <div className="mb-4 rounded-2xl bg-destructive/10 p-4 text-destructive">
          <Database className="h-10 w-10" />
        </div>
        <h2 className="mb-2 text-xl font-bold">Error al cargar datos estratégicos</h2>
        <p className="max-w-md text-sm text-muted-foreground">
          No pudimos conectar con la base de datos de leads. Por favor, verifica tu conexión o contacta a soporte.
        </p>
        <button 
          onClick={() => window.location.reload()}
          className="mt-6 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <>
      <AnimatePresence>
        {showOverlay && (
          <motion.div
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6, ease: "easeInOut" }}
            className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-background/95 backdrop-blur-md"
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="relative mb-8 flex h-24 w-24 items-center justify-center"
            >
              <div className="absolute inset-0 animate-pulse rounded-3xl bg-primary/20 blur-xl"></div>
              <div className="relative flex h-20 w-20 items-center justify-center rounded-3xl gradient-primary shadow-2xl glow-primary">
                <Sparkles className="h-10 w-10 text-primary-foreground" />
              </div>
            </motion.div>

            <div className="space-y-4 text-center">
              <h2 className="text-2xl font-display font-bold tracking-tight">Cargando Inteligencia</h2>
              <p className="text-sm text-muted-foreground">
                Sincronizando base de datos de leads y ventas...
              </p>
              
              <div className="mx-auto w-64 space-y-2">
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <motion.div
                    className="h-full bg-primary shadow-[0_0_8px_rgba(var(--primary),0.5)]"
                    initial={{ width: "0%" }}
                    animate={{ width: isLoading ? "90%" : "100%" }}
                    transition={{ duration: 2, ease: "easeOut" }}
                  />
                </div>
                <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                  <span>{isLoading ? "Procesando registros" : "Listo"}</span>
                  <span className="flex items-center gap-1.5">
                    {isLoading && <Loader2 className="h-3 w-3 animate-spin" />}
                    {progress > 0 ? `${progress.toLocaleString()} registros` : ""}
                  </span>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {!showOverlay && children}
    </>
  );
}
