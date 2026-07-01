import { BookOpen, Calculator, GraduationCap, LineChart } from "lucide-react";
import { Link } from "react-router-dom";

import { BentoGrid, BentoGridItem } from "@/components/ui/bento-grid";
import { useAuthStore } from "@/stores/auth.store";

/**
 * Authenticated landing built with Aceternity's BentoGrid. Cards route into features as they are
 * built out in later phases.
 */
export function DashboardPage() {
  const user = useAuthStore((state) => state.user);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Hola{user ? `, ${user.email.split("@")[0]}` : ""}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Tu panel académico: materias, notas, avance de malla y simulaciones.
        </p>
      </div>

      <BentoGrid className="mx-0 max-w-full md:auto-rows-[16rem]">
        <BentoGridItem
          className="md:col-span-2"
          title="Calculadora de recuperación"
          description="Calcula tu nota final sobre 40 y cuánto necesitas para aprobar."
          header={<GradientHeader icon={<Calculator className="size-8 text-primary" />} />}
          icon={<Calculator className="size-4 text-muted-foreground" />}
        />
        <DashboardLink
          to="/app/calculadora"
          title="Simulador de matrícula"
          description="Próximamente: materias disponibles y límites de crédito."
          icon={<LineChart className="size-4 text-muted-foreground" />}
        />
        <DashboardLink
          to="/app/calculadora"
          title="Mis materias"
          description="Próximamente: notas por aporte, componentes e insumos."
          icon={<BookOpen className="size-4 text-muted-foreground" />}
        />
        <BentoGridItem
          className="md:col-span-2"
          title="Avance de malla"
          description="Próximamente: progreso por periodo y requisitos de graduación."
          header={<GradientHeader icon={<GraduationCap className="size-8 text-primary" />} />}
          icon={<GraduationCap className="size-4 text-muted-foreground" />}
        />
      </BentoGrid>
    </div>
  );
}

function GradientHeader({ icon }: { icon: React.ReactNode }) {
  return (
    <div className="flex size-full min-h-24 flex-1 items-center justify-center rounded-xl bg-gradient-to-br from-primary/10 via-transparent to-primary/5">
      {icon}
    </div>
  );
}

function DashboardLink({
  to,
  title,
  description,
  icon,
}: {
  to: string;
  title: string;
  description: string;
  icon: React.ReactNode;
}) {
  return (
    <Link to={to} className="[&>div]:h-full">
      <BentoGridItem
        title={title}
        description={description}
        header={<GradientHeader icon={icon} />}
        icon={icon}
      />
    </Link>
  );
}
