import { Outlet } from "react-router-dom";

import { ThemeToggle } from "@/components/ThemeToggle";
import { AuroraBackground } from "@/components/ui/aurora-background";
import { TextGenerateEffect } from "@/components/ui/text-generate-effect";

/**
 * Split-screen auth layout: an animated Aceternity Aurora panel beside the form column.
 * The form column uses shadcn components. Collapses to a single column on mobile.
 */
export function AuthLayout() {
  return (
    <div className="grid min-h-screen bg-background lg:grid-cols-2">
      {/* Decorative animated panel — hidden on small screens. */}
      <AuroraBackground className="hidden h-full min-h-screen lg:flex">
        <div className="relative z-10 max-w-lg px-12">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-neutral-600 dark:text-neutral-300">
            EPN · FIS
          </p>
          <TextGenerateEffect
            words="Tus notas y tu malla, bajo control."
            className="mt-4 text-4xl font-bold tracking-tight text-neutral-900 dark:text-white"
          />
          <p className="mt-6 text-base text-neutral-700 dark:text-neutral-300">
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
            <h1 className="text-2xl font-bold tracking-tight text-foreground">EPN Notas Mallas</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Controla tus notas, tu malla y tus simulaciones.
            </p>
          </header>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
