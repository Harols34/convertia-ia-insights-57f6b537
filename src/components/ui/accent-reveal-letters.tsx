import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

type AccentRevealLettersProps = {
  text: string;
  className?: string;
  /** Re-dispara animación al cambiar */
  animationKey?: string | number;
};

/**
 * Acento tipo “reveal” por letra — ligero, sin assets externos.
 * Pensado para una palabra o frase corta dentro del hero.
 */
export function AccentRevealLetters({ text, className, animationKey }: AccentRevealLettersProps) {
  const reduceMotion = useReducedMotion();
  const chars = text.split("");

  if (reduceMotion) {
    return <span className={cn("text-gradient", className)}>{text}</span>;
  }

  return (
    <span
      className={cn("inline-block max-w-full whitespace-nowrap text-gradient", className)}
      aria-hidden={false}
    >
      {chars.map((ch, i) => (
        <motion.span
          key={`${animationKey ?? text}-${i}-${ch}`}
          className="inline-block text-gradient"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            delay: i * 0.045,
            duration: 0.42,
            ease: [0.16, 1, 0.3, 1],
          }}
        >
          {ch === " " ? "\u00a0" : ch}
        </motion.span>
      ))}
    </span>
  );
}
