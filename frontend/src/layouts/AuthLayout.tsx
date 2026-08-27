import { ArrowLeft } from "lucide-react";
import { Link, Outlet } from "react-router-dom";

import { BrandMark } from "@/components/BrandMark";
import { ThemeToggle } from "@/components/ThemeToggle";

/**
 * The sign-in shell. Previously an animated beam background; now the same ruled paper as the
 * rest of the app, so signing in already looks like the product you are signing in to.
 */
export function AuthLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-border px-4 sm:px-6">
        <Link
          to="/"
          className="flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Volver a la calculadora
        </Link>
        <ThemeToggle />
      </header>

      <main className="flex flex-1 items-center justify-center px-5 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-2.5">
            <BrandMark className="size-6 text-primary" />
            <span className="font-heading text-xl font-semibold tracking-tight">EPN Notas</span>
          </div>
          <Outlet />
        </div>
      </main>
    </div>
  );
}
