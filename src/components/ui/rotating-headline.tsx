import { useEffect, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { TitleSubtitle } from "@/lib/landing-copy";
import { GradientCycleTitle, type GradientCycleSurface } from "@/components/ui/gradient-cycle-title";
import { RevealLegend } from "@/components/ui/reveal-legend";

function formatTitle(title: string): ReactNode {
  const pipe = title.indexOf("|");
  if (pipe === -1) return title;
  const left = title.slice(0, pipe).trimEnd();
  const right = title.slice(pipe + 1).trimStart();
  return (
    <>
      {left}{" "}
      <span className="text-gradient">{right}</span>
    </>
  );
}

type RotatingHeadlineProps = {
  items: TitleSubtitle[];
  intervalMs?: number;
  minHeightClass?: string;
  titleClassName?: string;
  subtitleClassName?: string;
  align?: "center" | "left";
  heading?: "h2" | "h3";
  mobileIntervalFactor?: number;
  /** Subtítulo con reveal por letra al rotar */
  subtitleReveal?: boolean;
  /** Clase del barrido en `RevealLegend` */
  subtitleSweepClassName?: string;
  /** Contraste del título cíclico (p. ej. contacto en fondo claro) */
  titleSurface?: GradientCycleSurface;
};

function itemKey(item: TitleSubtitle, index: number) {
  const cycle = item.titleCycle?.join("-") ?? "";
  return `${index}-${item.title}-${cycle}-${item.subtitle}`;
}

export function RotatingHeadline({
  items,
  intervalMs = 6000,
  minHeightClass = "min-h-[8.5rem] sm:min-h-[7.5rem]",
  titleClassName,
  subtitleClassName,
  align = "center",
  heading: Heading = "h2",
  mobileIntervalFactor = 1.15,
  subtitleReveal = true,
  subtitleSweepClassName,
  titleSurface = "dark",
}: RotatingHeadlineProps) {
  const [index, setIndex] = useState(0);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (reduceMotion || items.length <= 1) return;
    const isNarrow = typeof window !== "undefined" && window.matchMedia("(max-width: 639px)").matches;
    const ms = Math.round(intervalMs * (isNarrow ? mobileIntervalFactor : 1));
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % items.length);
    }, ms);
    return () => clearInterval(id);
  }, [items.length, intervalMs, mobileIntervalFactor, reduceMotion]);

  if (items.length === 0) return null;

  const current = items[reduceMotion ? 0 : index];

  return (
    <div
      className={cn(
        minHeightClass,
        align === "center" && "mx-auto max-w-4xl text-center",
        "break-normal",
      )}
      aria-live={reduceMotion ? undefined : "polite"}
      aria-atomic="true"
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={reduceMotion ? "static" : itemKey(current, index)}
          initial={reduceMotion ? false : { opacity: 0, y: 10, filter: "blur(6px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          exit={reduceMotion ? undefined : { opacity: 0, y: -8, filter: "blur(4px)" }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className={cn(align === "center" && "mx-auto")}
        >
          {current.titleCycle ? (
            <GradientCycleTitle
              segments={current.titleCycle}
              className={titleClassName}
              as={Heading}
              surface={titleSurface}
            />
          ) : (
            <Heading
              className={cn("break-normal text-balance hyphens-none", titleClassName)}
              lang="es"
            >
              {formatTitle(current.title)}
            </Heading>
          )}
          {current.subtitle ? (
            subtitleReveal ? (
              <RevealLegend
                text={current.subtitle}
                animationKey={reduceMotion ? "static" : itemKey(current, index)}
                className={cn("mt-3 text-base sm:text-lg", subtitleClassName)}
                sweepClassName={subtitleSweepClassName ?? "text-primary"}
                layout={align === "center" ? "center" : "start"}
              />
            ) : (
              <p
                className={cn(
                  "mt-3 text-base sm:text-lg break-normal hyphens-none [overflow-wrap:normal] [word-break:normal]",
                  subtitleClassName,
                )}
                lang="es"
              >
                {current.subtitle}
              </p>
            )
          ) : null}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
