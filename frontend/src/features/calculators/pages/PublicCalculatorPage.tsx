import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, Calculator, CheckCircle2, Loader2, ShieldCheck } from "lucide-react";
import { useForm, type UseFormRegisterReturn } from "react-hook-form";
import { Link } from "react-router-dom";
import { z } from "zod";

import { BrandMark } from "@/components/BrandMark";
import { ThemeToggle } from "@/components/ThemeToggle";
import { BackgroundBeams } from "@/components/ui/background-beams";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError } from "@/lib/api/types";
import { cn } from "@/lib/utils";

import { useRecoveryCalculator } from "../hooks";
import { formatScore } from "../format";

const scoreField = z
  .string()
  .trim()
  .refine((value) => value !== "" && Number(value) >= 0 && Number(value) <= 20, {
    message: "Usa una nota entre 0 y 20.",
  });

const schema = z.object({ aporte_1: scoreField, aporte_2: scoreField });
type FormValues = z.infer<typeof schema>;

const RESULT_COPY = {
  APPROVED: {
    eyebrow: "Materia aprobada",
    title: "Ya alcanzaste la nota de aprobación.",
    tone: "text-emerald-600 dark:text-emerald-400",
  },
  RECOVERY_ELIGIBLE: {
    eyebrow: "Puedes rendir recuperación",
    title: "Esta es la nota mínima que necesitas.",
    tone: "text-amber-600 dark:text-amber-400",
  },
  FAILED_DIRECT: {
    eyebrow: "No elegible para recuperación",
    title: "La nota ordinaria debe ser al menos 18/40.",
    tone: "text-destructive",
  },
  IN_PROGRESS: {
    eyebrow: "Cálculo pendiente",
    title: "Completa ambos bimestres para obtener el resultado.",
    tone: "text-muted-foreground",
  },
} as const;

export function PublicCalculatorPage() {
  const calculator = useRecoveryCalculator();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { aporte_1: "", aporte_2: "" },
    mode: "onTouched",
  });

  const onSubmit = handleSubmit((values) => calculator.mutate(values));
  const result = calculator.data;
  const resultCopy = result ? RESULT_COPY[result.status] : null;
  const serverError = calculator.error instanceof ApiError ? calculator.error.message : null;

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_10%,color-mix(in_oklch,var(--foreground)_7%,transparent),transparent_32%)]" />
      <BackgroundBeams className="opacity-20 dark:opacity-30" />

      <header className="relative z-20 mx-auto flex h-18 w-full max-w-6xl items-center justify-between px-6">
        <Link to="/" className="flex items-center gap-2.5" aria-label="EPN Notas, inicio">
          <BrandMark className="size-5" />
          <span className="text-sm font-semibold tracking-tight">EPN Notas</span>
        </Link>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button asChild variant="outline" className="h-9 bg-background/60 backdrop-blur">
            <Link to="/login">Iniciar sesión</Link>
          </Button>
        </div>
      </header>

      <main className="relative z-10 mx-auto grid w-full max-w-6xl items-center gap-12 px-6 py-14 lg:min-h-[calc(100vh-4.5rem)] lg:grid-cols-[1fr_27rem] lg:py-20">
        <section className="max-w-2xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-background/65 px-3 py-1.5 text-xs text-muted-foreground backdrop-blur">
            <ShieldCheck className="size-3.5" />
            Cálculo anónimo · no guardamos tus datos
          </div>
          <h1 className="mt-7 text-balance text-5xl font-semibold leading-[1.02] tracking-[-0.055em] sm:text-6xl lg:text-7xl">
            ¿Cuánto necesitas en el suple?
          </h1>
          <p className="mt-6 max-w-xl text-pretty text-base leading-7 text-muted-foreground sm:text-lg">
            Ingresa las notas de tu primer y segundo bimestre. Calculamos tu nota final, si puedes
            rendir recuperación y el mínimo que necesitas según las reglas de la EPN.
          </p>
          <div className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-sm text-muted-foreground">
            <span className="flex items-center gap-2">
              <CheckCircle2 className="size-4 text-foreground" /> Resultado sobre 40 y 20
            </span>
            <span className="flex items-center gap-2">
              <CheckCircle2 className="size-4 text-foreground" /> Sin crear una cuenta
            </span>
          </div>
        </section>

        <section className="rounded-2xl border border-border/80 bg-card/80 p-1.5 shadow-2xl shadow-black/5 backdrop-blur-xl dark:shadow-black/25" aria-labelledby="calculator-title">
          <div className="rounded-xl border border-border/60 bg-background/80 p-5 sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                  Calculadora rápida
                </p>
                <h2 id="calculator-title" className="mt-1.5 text-xl font-semibold tracking-tight">
                  Nota de recuperación
                </h2>
              </div>
              <span className="grid size-9 place-items-center rounded-lg bg-muted text-foreground">
                <Calculator className="size-4" />
              </span>
            </div>

            <form className="mt-6 space-y-5" onSubmit={onSubmit} noValidate>
              <div className="grid grid-cols-2 gap-3">
                <ScoreInput
                  id="aporte_1"
                  label="Primer bimestre"
                  error={errors.aporte_1?.message}
                  registration={register("aporte_1")}
                />
                <ScoreInput
                  id="aporte_2"
                  label="Segundo bimestre"
                  error={errors.aporte_2?.message}
                  registration={register("aporte_2")}
                />
              </div>

              {serverError && (
                <p className="rounded-lg bg-destructive/10 px-3 py-2.5 text-sm text-destructive" role="alert">
                  {serverError}
                </p>
              )}

              <Button type="submit" size="lg" className="h-11 w-full" disabled={calculator.isPending}>
                {calculator.isPending ? <Loader2 className="animate-spin" /> : null}
                {calculator.isPending ? "Calculando…" : "Calcular mi nota"}
                {!calculator.isPending ? <ArrowRight /> : null}
              </Button>
            </form>

            {result && resultCopy && (
              <div className="mt-6 border-t border-border pt-5" aria-live="polite">
                <p className={cn("text-xs font-semibold uppercase tracking-[0.14em]", resultCopy.tone)}>
                  {resultCopy.eyebrow}
                </p>
                <p className="mt-1.5 text-sm font-medium">{resultCopy.title}</p>

                {result.display_required_recovery_score_40 ? (
                  <div className="my-5 flex items-baseline gap-2">
                    <strong className="text-5xl font-semibold tracking-[-0.05em] tabular-nums">
                      {formatScore(result.display_required_recovery_score_40)}
                    </strong>
                    <span className="text-sm text-muted-foreground">/40 en el suple</span>
                  </div>
                ) : null}

                <dl className="mt-4 grid grid-cols-2 gap-3">
                  <ResultMetric label="Nota final" value={`${formatScore(result.final_40)}/40`} />
                  <ResultMetric
                    label="Equivalente"
                    value={`${formatScore(result.display_final_20)}/20`}
                  />
                </dl>
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

interface ScoreInputProps {
  id: "aporte_1" | "aporte_2";
  label: string;
  error?: string;
  registration: UseFormRegisterReturn;
}

function ScoreInput({ id, label, error, registration }: ScoreInputProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label} <span className="font-normal text-muted-foreground">/20</span></Label>
      <Input
        id={id}
        inputMode="decimal"
        placeholder="0.00"
        className="h-12 bg-muted/45 px-3 text-lg font-medium tabular-nums"
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        {...registration}
      />
      {error && (
        <p id={`${id}-error`} className="text-xs text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

function ResultMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-muted/55 px-3 py-2.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm font-semibold tabular-nums">{value}</dd>
    </div>
  );
}
