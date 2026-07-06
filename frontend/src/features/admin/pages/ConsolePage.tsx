import {
  GraduationCap,
  Network,
  ShieldCheck,
  SlidersHorizontal,
  UserSquare2,
  Users,
} from "lucide-react";
import { Link, Navigate } from "react-router-dom";

import { Card, CardContent } from "@/components/ui/card";
import { useAuthStore } from "@/stores/auth.store";

type ConsoleCard = {
  title: string;
  description: string;
  href: string;
  icon: typeof Users;
  superAdminOnly?: boolean;
};

const CARDS: ConsoleCard[] = [
  {
    title: "Usuarios y roles",
    description: "Crea administradores, cambia roles y suspende cuentas.",
    href: "/app/admin/usuarios",
    icon: Users,
    superAdminOnly: true,
  },
  {
    title: "Sistema",
    description: "Administra periodos académicos y carreras de la institución.",
    href: "/app/admin/sistema",
    icon: SlidersHorizontal,
    superAdminOnly: true,
  },
  {
    title: "Editar malla y cursos",
    description:
      "Edita créditos, horas y semestre de cada materia, y conecta prerrequisitos y correquisitos visualmente sobre la malla.",
    href: "/app/curriculum",
    icon: Network,
  },
  {
    title: "Profesores",
    description: "Registra y edita el catálogo de docentes de la institución.",
    href: "/app/admin/profesores",
    icon: UserSquare2,
  },
];

export function ConsolePage() {
  const user = useAuthStore((state) => state.user);
  if (user && user.role === "STUDENT") {
    return <Navigate to="/app/dashboard" replace />;
  }
  const isSuperAdmin = user?.role === "SUPER_ADMIN";
  const cards = CARDS.filter((card) => !card.superAdminOnly || isSuperAdmin);

  return (
    <div className="space-y-6">
      <header>
        <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
          <ShieldCheck className="size-3.5" /> {isSuperAdmin ? "Superadministración" : "Administración"}
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">Consola</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Gestiona el contenido académico y, como superadmin, las cuentas del sistema. Los cambios
          se aplican directamente y quedan registrados en la auditoría.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => (
          <Link key={card.href} to={card.href}>
            <Card className="h-full border-border/80 bg-card/65 transition-colors hover:border-primary/50 hover:bg-accent">
              <CardContent className="flex h-full flex-col gap-3 p-6">
                <span className="grid size-11 place-items-center rounded-xl bg-muted">
                  <card.icon className="size-5" />
                </span>
                <div>
                  <h2 className="text-base font-semibold">{card.title}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">{card.description}</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {isSuperAdmin && (
        <Card className="border-dashed border-border/70 bg-card/40">
          <CardContent className="flex items-center gap-3 p-5 text-sm text-muted-foreground">
            <GraduationCap className="size-5 shrink-0" />
            Editor genérico de la base de datos: disponible próximamente para casos avanzados.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
