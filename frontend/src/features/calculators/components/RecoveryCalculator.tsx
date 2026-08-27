import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, type UseFormRegisterReturn } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError } from "@/lib/api/types";
import { cn } from "@/lib/utils";

import type { RecoveryInput, RecoveryResult as Result } from "../api";
import { formatScore, limitDecimalInput } from "../format";

/**
 * The recovery calculator, shared by the public landing page and the in-app tool.
 *
 * Both pages previously carried their own copy of this form, its schema and its result copy,
 * so a change to the academic thresholds had to be made twice.
 */

const scoreField = z
  .string()
  .trim()
  .refine((value) => /^\d+(?:[.,]\d{1,2})?$/.test(value), "Usa como máximo 2 decimales.")
  .refine(
    (value) => Number(value.replace(",", ".")) >= 0 && Number(value.replace(",", ".")) <= 20,
    "La nota de un bimestre va de 0 a 20.",
  );

const schema = z.object({ aporte_1: scoreField, aporte_2: scoreField });
export type RecoveryFormValues = z.infer<typeof schema>;

const RESULT_COPY: Record<Result["status"], { title: string; tone: string }> = {
  APPROVED: {
    title: "Ya aprobaste. No necesitas rendir el suple.",
    tone: "text-state-passed",
  },
  RECOVERY_ELIGIBLE: {
    title: "Vas a recuperación. Esta es la nota mínima que necesitas.",
    tone: "text-state-annulled",
  },
  FAILED_DIRECT: {
    title: "No puedes rendir el suple: para eso la nota ordinaria debe llegar a 18/40.",
    tone: "text-state-failed",
  },
  IN_PROGRESS: {
    title: "Faltan notas para poder calcular el resultado.",
    tone: "text-muted-foreground",
  },
};

export function RecoveryCalculatorForm({
  onSubmit,
  pending,
  error,
  submitLabel,
  className,
}: {
  onSubmit: (values: RecoveryInput) => void;
  pending: boolean;
  error: unknown;
  submitLabel: React.ReactNode;
  className?: string;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RecoveryFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { aporte_1: "", aporte_2: "" },
    mode: "onTouched",
  });

  const serverError = error instanceof ApiError ? error.message : null;

  return (
    <form
      className={cn("flex flex-col gap-4", className)}
      onSubmit={handleSubmit((values) =>
        onSubmit({
          aporte_1: values.aporte_1.replace(",", "."),
          aporte_2: values.aporte_2.replace(",", "."),
        }),
      )}
      noValidate
    >
      <div className="grid grid-cols-2 gap-3">
        <ScoreField
          id="aporte_1"
          label="Primer bimestre"
          error={errors.aporte_1?.message}
          registration={register("aporte_1")}
        />
        <ScoreField
          id="aporte_2"
          label="Segundo bimestre"
          error={errors.aporte_2?.message}
          registration={register("aporte_2")}
        />
      </div>

      {serverError && (
        <p
          className="rounded-sm bg-destructive/10 px-3 py-2 text-sm text-destructive"
          role="alert"
        >
          {serverError}
        </p>
      )}

      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {submitLabel}
      </Button>
    </form>
  );
}

function ScoreField({
  id,
  label,
  error,
  registration,
}: {
  id: string;
  label: string;
  error?: string;
  registration: UseFormRegisterReturn;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>
        {label} <span className="font-normal text-muted-foreground">/20</span>
      </Label>
      <Input
        id={id}
        inputMode="decimal"
        placeholder="0"
        className="grade h-12 text-lg"
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

export function RecoveryResult({ result, className }: { result: Result; className?: string }) {
  const copy = RESULT_COPY[result.status];

  return (
    <div className={cn("border-t border-border pt-5", className)} aria-live="polite">
      <p className={cn("text-sm font-medium", copy.tone)}>{copy.title}</p>

      {result.display_required_recovery_score_40 && (
        <p className="mt-4 flex items-baseline gap-2">
          <span className="grade text-5xl">
            {formatScore(result.display_required_recovery_score_40)}
          </span>
          <span className="text-sm text-muted-foreground">/40 en el suple</span>
        </p>
      )}

      <dl className="mt-5 flex gap-8 border-t border-border pt-4 text-sm">
        <div>
          <dt className="text-muted-foreground">Nota final</dt>
          <dd className="grade mt-0.5 font-medium">{formatScore(result.final_40)}/40</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Equivale a</dt>
          <dd className="grade mt-0.5 font-medium">
            {formatScore(result.display_final_20)}/20
          </dd>
        </div>
      </dl>
    </div>
  );
}
