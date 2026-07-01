import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError } from "@/lib/api/types";

import { useRecoveryCalculator } from "../hooks";

const scoreField = z
  .string()
  .refine((v) => v !== "" && Number(v) >= 0 && Number(v) <= 20, "Ingresa un valor entre 0 y 20.");

const schema = z.object({ aporte_1: scoreField, aporte_2: scoreField });
type FormValues = z.infer<typeof schema>;

const STATUS_META: Record<
  string,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  APPROVED: { label: "Aprobado", variant: "default" },
  RECOVERY_ELIGIBLE: { label: "Va a recuperación", variant: "secondary" },
  FAILED_DIRECT: { label: "Reprobado", variant: "destructive" },
};

export function CalculatorPage() {
  const calculator = useRecoveryCalculator();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { aporte_1: "", aporte_2: "" },
  });

  const onSubmit = handleSubmit((values) => calculator.mutate(values));

  const result = calculator.data;
  const status = result ? STATUS_META[result.status] : null;
  const serverError = calculator.error instanceof ApiError ? calculator.error.message : null;

  return (
    <div className="mx-auto flex max-w-md flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Calculadora de recuperación</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Ingresa tus dos aportes sobre 20 para ver tu nota final y si necesitas recuperación.
        </p>
      </div>

      <Card>
        <CardContent className="p-6">
          <form className="flex flex-col gap-4" onSubmit={onSubmit} noValidate>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="aporte_1">Aporte 1</Label>
                <Input id="aporte_1" inputMode="decimal" {...register("aporte_1")} />
                {errors.aporte_1 && (
                  <p className="text-sm text-destructive">{errors.aporte_1.message}</p>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="aporte_2">Aporte 2</Label>
                <Input id="aporte_2" inputMode="decimal" {...register("aporte_2")} />
                {errors.aporte_2 && (
                  <p className="text-sm text-destructive">{errors.aporte_2.message}</p>
                )}
              </div>
            </div>
            {serverError && <p className="text-sm text-destructive">{serverError}</p>}
            <Button type="submit" className="w-full" disabled={calculator.isPending}>
              {calculator.isPending && <Loader2 className="size-4 animate-spin" />}
              Calcular
            </Button>
          </form>
        </CardContent>
      </Card>

      {result && status && (
        <Card>
          <CardContent className="flex flex-col gap-3 p-6">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Estado</span>
              <Badge variant={status.variant}>{status.label}</Badge>
            </div>
            <Row label="Nota final /40" value={result.final_40} />
            <Row label="Equivalente /20" value={result.display_final_20} />
            {result.display_required_recovery_score_40 && (
              <Row
                label="Necesitas en recuperación /40"
                value={result.display_required_recovery_score_40}
              />
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-t border-border pt-3 first:border-0 first:pt-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium tabular-nums">{value}</span>
    </div>
  );
}
