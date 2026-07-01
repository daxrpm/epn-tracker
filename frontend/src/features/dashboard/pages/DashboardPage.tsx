import {
  ArrowRight,
  BookOpen,
  Calculator,
  GraduationCap,
  ListChecks,
  Loader2,
  NotebookPen,
} from "lucide-react";
import { useMemo } from "react";
import { Link } from "react-router-dom";

import { BentoGrid, BentoGridItem } from "@/components/ui/bento-grid";
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

          <BentoGrid className="mx-0 max-w-full md:auto-rows-[12rem]">
            <StatItem label="Aprobadas" value={stats.counts.PASSED} accent="text-emerald-500" />
            <StatItem label="En curso" value={stats.counts.IN_PROGRESS} accent="text-sky-500" />
            <StatItem
              label="Reprobadas"
              value={stats.counts.FAILED + stats.counts.ANNULLED}
              accent="text-red-500"
            />
            <Link to="/app/curriculum" className="[&>div]:h-full">
              <BentoGridItem
                title="Malla interactiva"
                description="Explora tu pénsum por semestre y actualiza tus materias."
                header={<GradientHeader icon={<GraduationCap className="size-8 text-primary" />} />}
                icon={<GraduationCap className="size-4 text-muted-foreground" />}
              />
            </Link>
            <Link to="/app/notas" className="[&>div]:h-full">
              <BentoGridItem
                title="Gestión de notas"
                description="Registra tus notas por bimestre y proyecta tu resultado final."
                header={<GradientHeader icon={<NotebookPen className="size-8 text-primary" />} />}
                icon={<NotebookPen className="size-4 text-muted-foreground" />}
              />
            </Link>
            <Link to="/app/requisitos" className="[&>div]:h-full">
              <BentoGridItem
                title="Requisitos de graduación"
                description="Revisa y actualiza el estado de tus requisitos."
                header={<GradientHeader icon={<ListChecks className="size-8 text-primary" />} />}
                icon={<ListChecks className="size-4 text-muted-foreground" />}
              />
            </Link>
            <Link to="/app/calculadora" className="[&>div]:h-full">
              <BentoGridItem
                title="Calculadora de recuperación"
                description="Calcula tu nota final sobre 40 y cuánto necesitas para aprobar."
                header={<GradientHeader icon={<Calculator className="size-8 text-primary" />} />}
                icon={<BookOpen className="size-4 text-muted-foreground" />}
              />
            </Link>
          </BentoGrid>
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
    <div className="row-span-1 flex flex-col justify-between rounded-2xl border border-border/80 bg-card/65 p-5">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={`text-4xl font-bold tabular-nums ${accent}`}>{value}</span>
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
