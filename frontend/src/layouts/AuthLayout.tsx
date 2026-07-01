import { ArrowLeft } from "lucide-react";
import { Link, Outlet } from "react-router-dom";

import { ThemeToggle } from "@/components/ThemeToggle";
import { BackgroundBeams } from "@/components/ui/background-beams";

/**
 * Focused auth shell with a restrained Aceternity background.
 */
export function AuthLayout() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,color-mix(in_oklch,var(--foreground)_7%,transparent),transparent_42%)]" />
      <BackgroundBeams className="opacity-25 dark:opacity-40" />

      <header className="absolute inset-x-0 top-0 z-20 flex items-center justify-between px-5 py-5 sm:px-8">
        <Link
          to="/"
          className="flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Volver a la calculadora
        </Link>
        <div>
          <ThemeToggle />
        </div>
      </header>

      <main className="relative z-10 flex min-h-screen items-center justify-center px-6 py-24">
        <div className="w-full max-w-md">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
