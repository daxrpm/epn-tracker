import {
  ArrowRight,
  Calculator,
  GitBranch,
  GraduationCap,
  ListChecks,
  Loader2,
  NotebookPen,
} from "lucide-react";
import { useMemo } from "react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useCurriculumCourses } from "@/features/curriculum/hooks";
import type { CourseState } from "@/features/student/api";
import { useCourseStates, useProfile } from "@/features/student/hooks";
import { useAuthStore } from "@/stores/auth.store";

export function DashboardPage() {
  const user = useAuthStore((state) => state.user);
  const profileQuery = useProfile();
  const curriculumId = profileQuery.data?.current_curriculum_id ?? null;
  const coursesQuery = useCurriculumCourses(curriculumId);
  const statesQuery = useCourseStates();

  const stats = useMemo(() => {
    const courses = coursesQuery.data ?? [];
    const stateByCourse = new Map<string, CourseState>(
      (statesQuery.data ?? []).map((s) => [s.curriculum_course_id, s.state]),
    );
    const counts: Record<CourseState, number> = {
      NOT_TAKEN: 0,
      IN_PROGRESS: 0,
      PASSED: 0,
      FAILED: 0,
      ANNULLED: 0,
    };
    let totalCredits = 0;
    let approvedCredits = 0;
    for (const course of courses) {
      const credits = Number(course.credits) || 0;
      totalCredits += credits;
      const state = stateByCourse.get(course.id) ?? "NOT_TAKEN";
      counts[state] += 1;
      if (state === "PASSED") approvedCredits += credits;
    }
    const percent = totalCredits > 0 ? Math.round((approvedCredits / totalCredits) * 100) : 0;
    return { counts, totalCredits, approvedCredits, percent, totalCourses: courses.length };
  }, [coursesQuery.data, statesQuery.data]);

  const greeting = user ? `, ${user.email.split("@")[0]}` : "";

  return (
    <div className="flex flex-col gap-8">
      <div>
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Panel académico</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">Hola{greeting}</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Tu panel académico: avance de malla, materias, requisitos y simulaciones.
        </p>
      </div>

      {profileQuery.isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : !curriculumId ? (
        <OnboardingCta />
      ) : (
        <>
          <Card className="rounded-2xl bg-card/65">
            <CardContent className="flex flex-col gap-4 p-6">
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Avance de malla</p>
                  <p className="text-3xl font-bold tabular-nums">{stats.percent}%</p>
                </div>
                <p className="text-sm text-muted-foreground tabular-nums">
                  {stats.approvedCredits} / {stats.totalCredits} créditos
                </p>
              </div>
              <Progress value={stats.percent} className="h-2" />
            </CardContent>
          </Card>

          <div className="grid gap-3 sm:grid-cols-3">
            <StatItem label="Aprobadas" value={stats.counts.PASSED} accent="text-emerald-500" />
            <StatItem label="En curso" value={stats.counts.IN_PROGRESS} accent="text-sky-500" />
            <StatItem
              label="Reprobadas"
              value={stats.counts.FAILED + stats.counts.ANNULLED}
              accent="text-red-500"
            />
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <DashboardAction
              to="/app/curriculum"
              title="Malla interactiva"
              description="Explora tu pénsum por semestre y actualiza el estado de tus materias."
              icon={GraduationCap}
            />
            <DashboardAction
              to="/app/simulacion"
              title="Simulador de matrícula"
              description="Proyecta tus materias y arma tu próximo semestre según las reglas EPN."
              icon={GitBranch}
            />
            <DashboardAction
              to="/app/notas"
              title="Gestión de notas"
              description="Registra tus notas por bimestre y proyecta tu resultado final."
              icon={NotebookPen}
            />
            <DashboardAction
              to="/app/requisitos"
              title="Requisitos de graduación"
              description="Revisa y actualiza el estado de todos tus requisitos."
              icon={ListChecks}
            />
            <DashboardAction
              to="/app/calculadora"
              title="Calculadora de recuperación"
              description="Calcula tu nota final sobre 40 y cuánto necesitas para aprobar."
              icon={Calculator}
            />
          </div>
        </>
      )}
    </div>
  );
}

function OnboardingCta() {
  return (
    <Card className="rounded-2xl border-border/80 bg-card/65">
      <CardContent className="flex flex-col items-start gap-4 p-8">
        <GraduationCap className="size-10 text-primary" />
        <div>
          <h2 className="text-lg font-semibold">Configura tu malla</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Aún no has seleccionado tu carrera y pénsum. Complétalo para ver tu avance
            académico.
          </p>
        </div>
        <Button asChild>
          <Link to="/app/onboarding">
            Empezar
            <ArrowRight className="size-4" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function StatItem({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent: string;
}) {
  return (
    <div className="flex min-h-28 flex-col justify-between rounded-2xl border border-border/80 bg-card/65 p-5 shadow-sm">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={`text-3xl font-semibold tabular-nums ${accent}`}>{value}</span>
    </div>
  );
}

function DashboardAction({
  to,
  title,
  description,
  icon: Icon,
}: {
  to: string;
  title: string;
  description: string;
  icon: typeof GraduationCap;
}) {
  return (
    <Link to={to} className="group block h-full rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <Card className="h-full min-h-40 rounded-2xl border-border/80 bg-card/65 py-0 shadow-sm transition-all duration-200 group-hover:-translate-y-0.5 group-hover:border-primary/25 group-hover:shadow-md">
        <CardContent className="flex h-full items-start gap-4 p-5">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
            <Icon className="size-5" />
          </span>
          <div className="flex min-w-0 flex-1 flex-col self-stretch">
            <h2 className="text-base font-semibold leading-snug">{title}</h2>
            <p className="mt-2 text-sm leading-5 text-muted-foreground">{description}</p>
            <span className="mt-auto flex items-center gap-1 pt-4 text-xs font-medium text-muted-foreground transition-colors group-hover:text-foreground">
              Abrir <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
