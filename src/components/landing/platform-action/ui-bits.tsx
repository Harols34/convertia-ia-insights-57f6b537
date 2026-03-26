import { useEffect, useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { pa } from "./theme";
import { cn } from "@/lib/utils";

export function CountUpSpan({
  end,
  prefix = "",
  suffix = "",
  duration = 1.4,
  decimals = 0,
  active,
}: {
  end: number;
  prefix?: string;
  suffix?: string;
  duration?: number;
  decimals?: number;
  active: boolean;
}) {
  const [val, setVal] = useState(0);

  useEffect(() => {
    if (!active) {
      setVal(0);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min((now - start) / (duration * 1000), 1);
      const eased = 1 - (1 - t) ** 3;
      const n = end * eased;
      setVal(decimals > 0 ? Number(n.toFixed(decimals)) : Math.round(n));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [end, duration, decimals, active]);

  const formatted =
    decimals > 0 ? val.toLocaleString("es-CO", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) : val.toLocaleString("es-CO");

  return (
    <span>
      {prefix}
      {formatted}
      {suffix}
    </span>
  );
}

export function ChartTooltip({
  title,
  lines,
  children,
  side = "top",
}: {
  title: string;
  lines: { label: string; value: string; hint?: string }[];
  children: ReactNode;
  side?: "top" | "bottom" | "left" | "right";
}) {
  return (
    <Tooltip delayDuration={120}>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side={side} className={pa.tooltip}>
        <p className="mb-1.5 font-display text-[11px] font-semibold text-slate-900 dark:text-emerald-200">{title}</p>
        <ul className="space-y-1">
          {lines.map((l) => (
            <li key={l.label} className="flex justify-between gap-4 text-[11px]">
              <span className="text-slate-500 dark:text-emerald-100/60">{l.label}</span>
              <span className="font-mono text-slate-800 dark:text-emerald-100">{l.value}</span>
            </li>
          ))}
        </ul>
      </TooltipContent>
    </Tooltip>
  );
}

export function KpiTile({
  label,
  children,
  sub,
  badge,
  icon,
  pulse,
  className,
}: {
  label: string;
  children: ReactNode;
  sub?: ReactNode;
  badge?: string;
  icon?: ReactNode;
  pulse?: boolean;
  className?: string;
}) {
  return (
    <motion.div
      className={cn(
        pa.card,
        pa.cardHover,
        "relative overflow-hidden p-3 sm:p-4",
        pulse && "animate-pulse-slow",
        className,
      )}
      whileHover={{ y: -1 }}
      transition={{ type: "spring", stiffness: 400, damping: 28 }}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <p className={pa.kpiLabel}>{label}</p>
        {icon ? <span className={pa.kpiIcon}>{icon}</span> : null}
      </div>
      <div className={pa.kpiValue}>{children}</div>
      {sub ? <div className={pa.kpiSub}>{sub}</div> : null}
      {badge ? <span className={pa.kpiBadge}>{badge}</span> : null}
    </motion.div>
  );
}
