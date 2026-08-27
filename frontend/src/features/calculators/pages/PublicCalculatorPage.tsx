import { Loader2 } from "lucide-react";
import { Link } from "react-router-dom";

import { BrandMark } from "@/components/BrandMark";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { useRecoveryCalculator } from "../hooks";
import { RecoveryCalculatorForm, RecoveryResult } from "../components/RecoveryCalculator";

/**
 * The public landing page, which is also the product's most-used single feature.
 *
 * It is a calculator, not a marketing page: the form is above the fold and the answer replaces
 * the space it needed. No feature grid, no testimonials, no logo bar — there is one thing to do
 * here and the page is that thing.
 */
export function PublicCalculatorPage() {
  const calculator = useRecoveryCalculator();

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-border px-4 sm:px-6">
        <Link to="/" className="flex items-center gap-2.5" aria-label="EPN Notas, inicio">
          <BrandMark className="size-5 text-primary" />
          <span className="font-heading text-base font-semibold tracking-tight">EPN Notas</span>
        </Link>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button asChild variant="outline" size="sm">
            <Link to="/login">Iniciar sesión</Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-5xl flex-1 items-start gap-10 px-5 py-12 lg:grid-cols-[1fr_24rem] lg:gap-16 lg:py-20">
        <section className="margin-rule max-w-xl">
          <h1 className="font-heading text-4xl leading-[1.05] font-semibold sm:text-5xl">
            ¿Cuánto necesitas en el suple?
          </h1>
          <p className="mt-5 text-base leading-7 text-muted-foreground">
            Escribe las notas de tus dos bimestres. Calculamos tu nota final sobre 40, si puedes
            rendir recuperación y la nota mínima que necesitas, con las reglas de la EPN.
          </p>
          <dl className="mt-8 flex flex-col gap-3 border-t border-border pt-6 text-sm">
            <div className="flex gap-3">
              <dt className="w-32 shrink-0 text-muted-foreground">Aprobar</dt>
              <dd className="grade">28/40</dd>
            </div>
            <div className="flex gap-3">
              <dt className="w-32 shrink-0 text-muted-foreground">Ir a recuperación</dt>
              <dd className="grade">entre 18 y 28 sobre 40</dd>
            </div>
            <div className="flex gap-3">
              <dt className="w-32 shrink-0 text-muted-foreground">Pasar el suple</dt>
              <dd className="grade">24/40, y promedio 24/40</dd>
            </div>
          </dl>
          <p className="mt-6 text-xs text-muted-foreground">
            Este cálculo no se guarda y no necesitas cuenta. Proyecto hecho por estudiantes; no
            es un sistema oficial de la EPN.
          </p>
        </section>

        <section
          aria-labelledby="calculadora"
          className="w-full rounded-md border border-border bg-card p-5 sm:p-6"
        >
          <h2 id="calculadora" className="font-heading text-lg font-semibold">
            Calcula tu nota
          </h2>
          <RecoveryCalculatorForm
            className="mt-5"
            pending={calculator.isPending}
            error={calculator.error}
            onSubmit={(values) => calculator.mutate(values)}
            submitLabel={
              calculator.isPending ? (
                <>
                  <Loader2 className="animate-spin" /> Calculando…
                </>
              ) : (
                "Calcular"
              )
            }
          />
          {calculator.data && <RecoveryResult result={calculator.data} className="mt-6" />}
        </section>
      </main>
    </div>
  );
}
