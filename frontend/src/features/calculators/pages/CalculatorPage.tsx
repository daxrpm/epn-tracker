import { zodResolver } from "@hookform/resolvers/zod";
import { Button, Card, CardBody, Chip, Input } from "@heroui/react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { ApiError } from "@/lib/api/types";

import { useRecoveryCalculator } from "../hooks";

const scoreField = z
  .string()
  .refine((v) => v !== "" && Number(v) >= 0 && Number(v) <= 20, "Ingresa un valor entre 0 y 20.");

const schema = z.object({ aporte_1: scoreField, aporte_2: scoreField });
type FormValues = z.infer<typeof schema>;

const STATUS_LABELS: Record<string, { label: string; color: "success" | "warning" | "danger" }> = {
  APPROVED: { label: "Aprobado", color: "success" },
  RECOVERY_ELIGIBLE: { label: "Va a recuperación", color: "warning" },
  FAILED_DIRECT: { label: "Reprobado", color: "danger" },
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
  const status = result ? STATUS_LABELS[result.status] : null;
  const serverError = calculator.error instanceof ApiError ? calculator.error.message : null;

  return (
    <div className="mx-auto flex max-w-md flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Calculadora de recuperación</h1>
        <p className="mt-1 text-sm text-default-500">
          Ingresa tus dos aportes sobre 20 para ver tu nota final y si necesitas recuperación.
        </p>
      </div>

      <Card className="border border-default-100 shadow-sm">
        <CardBody className="gap-4 p-6">
          <form className="flex flex-col gap-4" onSubmit={onSubmit} noValidate>
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Aporte 1"
                variant="bordered"
                isInvalid={Boolean(errors.aporte_1)}
                errorMessage={errors.aporte_1?.message}
                {...register("aporte_1")}
              />
              <Input
                label="Aporte 2"
                variant="bordered"
                isInvalid={Boolean(errors.aporte_2)}
                errorMessage={errors.aporte_2?.message}
                {...register("aporte_2")}
              />
            </div>
            {serverError && <p className="text-sm text-danger">{serverError}</p>}
            <Button type="submit" color="primary" isLoading={calculator.isPending} fullWidth>
              Calcular
            </Button>
          </form>
        </CardBody>
      </Card>

      {result && status && (
        <Card className="border border-default-100 shadow-sm">
          <CardBody className="gap-3 p-6">
            <div className="flex items-center justify-between">
              <span className="text-sm text-default-500">Estado</span>
              <Chip color={status.color} variant="flat" size="sm">
                {status.label}
              </Chip>
            </div>
            <Row label="Nota final /40" value={result.final_40} />
            <Row label="Equivalente /20" value={result.display_final_20} />
            {result.display_required_recovery_score_40 && (
              <Row
                label="Necesitas en recuperación /40"
                value={result.display_required_recovery_score_40}
              />
            )}
          </CardBody>
        </Card>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-t border-default-100 pt-3 first:border-0 first:pt-0">
      <span className="text-sm text-default-500">{label}</span>
      <span className="text-sm font-medium tabular-nums">{value}</span>
    </div>
  );
}
