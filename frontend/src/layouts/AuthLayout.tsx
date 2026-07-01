import { Outlet } from "react-router-dom";

import { AuroraBackground } from "@/components/aceternity/aurora-background";
import { ThemeToggle } from "@/components/ThemeToggle";

/**
 * Split-screen auth layout: a decorative Aurora panel (Aceternity) beside the form column.
 * The form uses HeroUI components. Collapses to a single centered column on mobile.
 */
export function AuthLayout() {
  return (
    <div className="grid min-h-screen bg-background lg:grid-cols-2">
      {/* Decorative panel — hidden on small screens. */}
      <AuroraBackground className="hidden min-h-full lg:flex">
        <div className="relative z-10 max-w-md px-12 text-slate-900">
          <p className="text-sm font-medium uppercase tracking-widest text-primary">EPN · FIS</p>
          <h2 className="mt-4 text-4xl font-semibold leading-tight tracking-tight">
            Tus notas y tu malla, bajo control.
          </h2>
          <p className="mt-4 text-base text-slate-600">
            Calcula notas y recuperación, sigue tu avance de malla y simula tu próxima matrícula con
            las reglas de la EPN.
          </p>
        </div>
      </AuroraBackground>

      {/* Form column. */}
      <div className="relative flex items-center justify-center px-6 py-12">
        <div className="absolute right-6 top-6">
          <ThemeToggle />
        </div>
        <main className="flex w-full max-w-sm flex-col gap-8">
          <header>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              EPN Notas Mallas
            </h1>
            <p className="mt-1 text-sm text-default-500">
              Controla tus notas, tu malla y tus simulaciones.
            </p>
          </header>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
