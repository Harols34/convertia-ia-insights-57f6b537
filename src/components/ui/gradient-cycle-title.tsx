"use client";

import { useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

export type GradientCycleSurface = "dark" | "light";

type GradientCycleTitleProps = {
  /** Tres fragmentos: los dos primeros en blanco (o slate en fondo claro); el último en gradiente tipo referencia */
  segments: readonly [string, string, string];
  className?: string;
  as?: "h1" | "h2" | "h3";
  /** Fondo de la sección para contraste de texto */
  surface?: GradientCycleSurface;
};

const dimAnim = ["animate-cc-title-dim-1", "animate-cc-title-dim-2", "animate-cc-title-dim-3"] as const;

/**
 * Título con énfasis cíclico: los fragmentos solo se atenúan, nunca desaparecen.
 * Al ~72–100% del ciclo todo vuelve a opacidad plena (frase completa legible).
 * Estilo referencia: inicio en blanco (o slate), cierre en gradiente primario/accent.
 */
export function GradientCycleTitle({
  segments,
  className,
  as: Tag = "h2",
  surface = "dark",
}: GradientCycleTitleProps) {
  const reduceMotion = useReducedMotion();
  const label = segments.join(" ").replace(/\s+/g, " ").trim();

  const segMid = surface === "light" ? "text-slate-800" : "text-white/90";
  const strong = surface === "light" ? "text-slate-950" : "text-white";

  return (
    <Tag
      aria-label={label}
      lang="es"
      className={cn(
        "flex flex-wrap items-baseline justify-center gap-x-2 gap-y-2 select-none tracking-tight break-normal text-balance hyphens-none",
        className,
      )}
    >
      {segments.map((text, i) => {
        const isAccent = i === 2;
        return (
          <span
            key={`${i}-${text}`}
            className={cn(
              "relative inline-block max-w-full px-0.5 sm:px-1",
              !reduceMotion && dimAnim[i],
            )}
            style={reduceMotion ? { opacity: 1 } : undefined}
          >
            {isAccent ? (
              <span className="bg-gradient-to-r from-primary to-accent bg-clip-text font-bold text-transparent">
                {text}
              </span>
            ) : (
              <span className={cn("font-bold", i === 0 ? strong : segMid)}>{text}</span>
            )}
          </span>
        );
      })}
    </Tag>
  );
}
