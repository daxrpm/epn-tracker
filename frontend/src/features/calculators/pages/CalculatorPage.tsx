import { Loader2 } from "lucide-react";

import { RecoveryCalculatorForm, RecoveryResult } from "../components/RecoveryCalculator";
import { useRecoveryCalculator } from "../hooks";

/**
 * The same calculator as the landing page, inside the app shell.
 *
 * Signed-in students already have their real grades in the gradebook, so this is for a quick
 * what-if on numbers that are not theirs (a friend's, or a course they have not started).
 */
export function CalculatorPage() {
  const calculator = useRecoveryCalculator();

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-6">
      <header className="margin-rule">
        <h1 className="font-heading text-2xl font-semibold sm:text-3xl">
          Calculadora del suple
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Un cálculo suelto con dos notas de bimestre. Para tus materias, usa{" "}
          <span className="text-foreground">Notas</span>: ahí ya está todo cargado.
        </p>
      </header>

      <section className="rounded-md border border-border bg-card p-5 sm:p-6">
        <RecoveryCalculatorForm
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
    </div>
  );
}
