import { forwardRef } from "react";
import { cn } from "@/lib/utils";

export const GlassCard = forwardRef<
  HTMLDivElement,
  {
    children: React.ReactNode;
    className?: string;
    noPad?: boolean;
  }
>(({ children, className, noPad }, ref) => {
  return (
    <div
      ref={ref}
      className={cn(
        "rounded-2xl border border-slate-200/90 bg-card shadow-[0_1px_2px_rgba(15,23,42,0.04),0_10px_28px_rgba(15,23,42,0.07)]",
        !noPad && "p-4 md:p-5",
        className,
      )}
    >
      {children}
    </div>
  );
});

GlassCard.displayName = "GlassCard";
