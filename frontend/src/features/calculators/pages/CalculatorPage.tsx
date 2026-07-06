import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, Calculator, Loader2 } from "lucide-react";
import { useForm, type UseFormRegisterReturn } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError } from "@/lib/api/types";
import { cn } from "@/lib/utils";

import { useRecoveryCalculator } from "../hooks";
import { formatScore, limitDecimalInput } from "../format";

const scoreField = z
  .string()
  .trim()
  .refine((v) => /^\d+(?:\.\d{1,2})?$/.test(v), "Usa máximo 2 decimales.")
  .refine((v) => v !== "" && Number(v) >= 0 && Number(v) <= 20, "Ingresa un valor entre 0 y 20.");

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
    title: "Esta es la nota mínima que necesitas en el suple.",
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

export function CalculatorPage() {
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
    <div className="mx-auto flex max-w-lg flex-col gap-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
          Herramientas académicas
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em]">
          Calculadora de recuperación
        </h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Ingresa las notas de tu primer y segundo bimestre sobre 20 para ver tu nota final y
          cuánto necesitas en el suple.
        </p>
      </div>

      <section className="rounded-2xl border border-border/80 bg-card/80 p-1.5 shadow-xl shadow-black/5 dark:shadow-black/25">
        <div className="rounded-xl border border-border/60 bg-background/80 p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                Calculadora rápida
              </p>
              <h2 className="mt-1.5 text-xl font-semibold tracking-tight">Nota de recuperación</h2>
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
      <Label htmlFor={id}>
        {label} <span className="font-normal text-muted-foreground">/20</span>
      </Label>
      <Input
        id={id}
        inputMode="decimal"
        placeholder="0.00"
        className="h-12 bg-muted/45 px-3 text-lg font-medium tabular-nums"
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        onInput={(event) => {
          event.currentTarget.value = limitDecimalInput(event.currentTarget.value);
        }}
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
