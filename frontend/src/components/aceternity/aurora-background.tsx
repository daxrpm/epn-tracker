/**
 * Aurora background — adapted from Aceternity UI (aceternity.com/components/aurora-background).
 * Aceternity components are copy-paste; this is a typed, self-contained version using our `cn` util.
 */
import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

interface AuroraBackgroundProps {
  children: ReactNode;
  className?: string;
  showRadialGradient?: boolean;
}

export function AuroraBackground({
  children,
  className,
  showRadialGradient = true,
}: AuroraBackgroundProps) {
  return (
    <div
      className={cn(
        "relative flex min-h-screen flex-col items-center justify-center bg-zinc-50 text-slate-950",
        className,
      )}
    >
      <div className="absolute inset-0 overflow-hidden" aria-hidden>
        <div
          className={cn(
            `pointer-events-none absolute -inset-[10px] opacity-40 blur-[10px] will-change-transform
             [background-image:repeating-linear-gradient(100deg,#3b82f6_10%,#a5b4fc_15%,#93c5fd_20%,#ddd6fe_25%,#60a5fa_30%)]
             [background-size:300%,_200%] [background-position:50%_50%]
             animate-aurora`,
            showRadialGradient &&
              "[mask-image:radial-gradient(ellipse_at_100%_0%,black_10%,transparent_70%)]",
          )}
        />
      </div>
      {children}
    </div>
  );
}
