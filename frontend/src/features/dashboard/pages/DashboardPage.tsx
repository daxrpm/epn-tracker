import { Card, CardBody } from "@heroui/react";
import { Link } from "react-router-dom";

import { useAuthStore } from "@/stores/auth.store";

/**
 * Minimal authenticated landing. Intentionally sparse (ERS §20.5: no invented KPIs) — real academic
 * widgets (current courses, malla progress) plug in here as those features are built.
 */
export function DashboardPage() {
  const user = useAuthStore((state) => state.user);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Hola{user ? `, ${user.email}` : ""}</h1>
        <p className="mt-1 text-sm text-default-500">
          Tu panel académico se construirá aquí: materias actuales, notas y progreso de malla.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card as={Link} to="/app/calculadora" isPressable className="border border-default-100">
          <CardBody className="gap-1 p-5">
            <span className="text-sm font-medium">Calculadora de recuperación</span>
            <span className="text-sm text-default-500">
              Calcula tu nota final y cuánto necesitas para aprobar.
            </span>
          </CardBody>
        </Card>
        <Card className="border border-dashed border-default-200">
          <CardBody className="gap-1 p-5">
            <span className="text-sm font-medium text-default-400">Materias actuales</span>
            <span className="text-sm text-default-400">Próximamente.</span>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
