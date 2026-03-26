"use client";

import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useEffect, useMemo, useState } from "react";

type RevealLegendProps = {
  text: string;
  className?: string;
  animationKey?: string | number;
  sweepClassName?: string;
  /** Alineación de las líneas de la leyenda (espacios reales vía flex `gap`, no spans con espacio) */
  layout?: "center" | "start";
};

function splitWords(text: string): string[] {
  return text.trim().split(/\s+/).filter(Boolean);
}

/**
 * Leyenda con reveal por letra. Cada palabra es un ítem flex con `gap` fijo
 * para que los espacios nunca colapsen (evita "Unaplataforma...").
 * `whitespace-nowrap` solo por palabra → saltos de línea entre palabras enteras.
 */
export function RevealLegend({
  text,
  className,
  animationKey,
  sweepClassName = "text-primary",
  layout = "center",
}: RevealLegendProps) {
  const reduceMotion = useReducedMotion();
  const [showSweep, setShowSweep] = useState(false);
  const words = useMemo(() => splitWords(text), [text]);

  const letterCount = useMemo(
    () => words.reduce((n, w) => n + w.length, 0),
    [words],
  );

  const letterDelay = 0.022;
  const springMs = 480;

  useEffect(() => {
    if (reduceMotion) return;
    const last = Math.max(0, letterCount - 1) * letterDelay * 1000 + springMs;
    setShowSweep(false);
    const t = window.setTimeout(() => setShowSweep(true), last);
    return () => clearTimeout(t);
  }, [animationKey, text, reduceMotion, letterCount, letterDelay]);

  if (reduceMotion) {
    return (
      <p
        className={cn(
          "w-full max-w-full break-normal hyphens-none [overflow-wrap:normal] [word-break:normal]",
          layout === "center" && "text-center",
          className,
        )}
        lang="es"
      >
        {text}
      </p>
    );
  }

  let letterIndex = 0;

  return (
    <p
      className={cn(
        "relative w-full max-w-full font-body break-normal hyphens-none [overflow-wrap:normal] [word-break:normal]",
        layout === "center" && "text-center",
        className,
      )}
      lang="es"
      aria-label={text}
    >
      <span
        aria-hidden
        className={cn(
          "flex w-full max-w-full flex-wrap items-baseline gap-x-2 gap-y-1 sm:gap-x-2.5",
          layout === "center" ? "justify-center" : "justify-start",
        )}
      >
        {words.map((word, wi) => (
          <span
            key={`${animationKey ?? ""}-w-${wi}-${word}`}
            className="inline-flex max-w-full shrink-0 whitespace-nowrap"
          >
            {word.split("").map((ch) => {
              const i = letterIndex++;
              return (
                <motion.span
                  key={`${animationKey ?? ""}-c-${i}-${ch}`}
                  className="relative inline-block align-baseline"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    delay: i * letterDelay,
                    type: "spring",
                    damping: 14,
                    stiffness: 280,
                    mass: 0.65,
                  }}
                >
                  <span className="relative z-[1] text-inherit">{ch}</span>
                  {showSweep ? (
                    <motion.span
                      className={cn("pointer-events-none absolute inset-0 z-0", sweepClassName)}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: [0, 0.85, 0.85, 0] }}
                      transition={{
                        delay: i * 0.04,
                        duration: 0.55,
                        times: [0, 0.15, 0.55, 1],
                        ease: "easeInOut",
                      }}
                    >
                      {ch}
                    </motion.span>
                  ) : null}
                </motion.span>
              );
            })}
          </span>
        ))}
      </span>
    </p>
  );
}
