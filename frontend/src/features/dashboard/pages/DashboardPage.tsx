import { ArrowRight, GraduationCap, Loader2, NotebookPen } from "lucide-react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useCurriculumCourses } from "@/features/curriculum/hooks";
import { COURSE_STATE_META } from "@/features/curriculum/constants";
import type { CourseState } from "@/features/student/api";
import { useCourseStates, useProfile, useProgress } from "@/features/student/hooks";
import { useEnrollments } from "@/features/evaluation/hooks";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth.store";
import { creditsLabel } from "@/lib/format";

/**
 * The screen's job: answer "where am I, and what should I open next?".
 *
 * The focal element is the malla progress; everything else defers to it. It is deliberately not
 * the default dashboard shell (stat row + chart + table): there is one number that matters and a
 * short list of courses in flight, so that is what the page is.
 */
export function DashboardPage() {
  const user = useAuthStore((state) => state.user);
  const profileQuery = useProfile();
  const curriculumId = profileQuery.data?.current_curriculum_id ?? null;

  const progressQuery = useProgress(Boolean(curriculumId));
  const coursesQuery = useCurriculumCourses(curriculumId);
  const statesQuery = useCourseStates();
  const enrollmentsQuery = useEnrollments();

  const firstName = user?.email.split("@")[0] ?? "";

  if (profileQuery.isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="size-5 animate-spin text-muted-foreground" aria-hidden />
      </div>
    );
  }

  if (!curriculumId) return <OnboardingCta name={firstName} />;

  const progress = progressQuery.data;
  const counts = progress?.counts_by_state;

  // Courses the student is taking right now, with a direct link into their gradebook.
  const inProgress = (coursesQuery.data ?? []).filter(
    (course) =>
      (statesQuery.data ?? []).find((s) => s.curriculum_course_id === course.id)?.state ===
      "IN_PROGRESS",
  );
  const enrollmentByCourse = new Map(
    (enrollmentsQuery.data ?? []).map((e) => [e.curriculum_course_id, e.id]),
  );

  return (
    <div className="flex flex-col gap-10">
      <header className="margin-rule">
        <h1 className="font-heading text-3xl font-semibold sm:text-4xl">Hola, {firstName}</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Tu cuaderno académico: avance, materias en curso y herramientas.
        </p>
      </header>

      {/* Focal element: how much of the malla is done. */}
      <section aria-labelledby="avance">
        <Card focal className="overflow-hidden">
          <CardContent className="flex flex-col gap-5 p-6 sm:p-8">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h2 id="avance" className="text-sm font-medium text-muted-foreground">
                  Avance de la malla
                </h2>
                <p className="mt-1 flex items-baseline gap-1.5">
                  <span className="grade text-5xl text-primary sm:text-6xl">
                    {progress ? Number(progress.percent).toFixed(0) : "—"}
                  </span>
                  <span className="text-xl text-muted-foreground">%</span>
                </p>
              </div>
              <p className="grade text-sm text-muted-foreground">
                {progress
                  ? `${progress.approved_credits} / ${progress.total_credits}`
                  : "— / —"}{" "}
                créditos
              </p>
            </div>

            <ProgressBar percent={progress ? Number(progress.percent) : 0} />

            {counts && (
              <dl className="flex flex-wrap gap-x-8 gap-y-3 pt-1">
                <CountItem state="PASSED" value={counts.PASSED} />
                <CountItem state="IN_PROGRESS" value={counts.IN_PROGRESS} />
                <CountItem state="FAILED" value={counts.FAILED} />
                {/* Annulled is its own count: the rules treat it as neither passed nor failed,
                    so folding it into "reprobadas" told the student something untrue. */}
                <CountItem state="ANNULLED" value={counts.ANNULLED} />
                <CountItem state="NOT_TAKEN" value={counts.NOT_TAKEN} />
              </dl>
            )}
          </CardContent>
        </Card>
      </section>

      {/* Different composition on purpose: a ruled list, not another grid of cards. */}
      <section aria-labelledby="en-curso" className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-4 border-b border-border pb-2">
          <h2 id="en-curso" className="font-heading text-lg font-semibold">
            Materias en curso
          </h2>
          <Link
            to="/app/notas"
            className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            Ver todas
          </Link>
        </div>

        {inProgress.length === 0 ? (
          <EmptyInProgress />
        ) : (
          <ul className="rule-list">
            {inProgress.map((course) => (
              <li key={course.id}>
                <Link
                  to={`/app/notas/${course.id}`}
                  className="flex items-center justify-between gap-4 py-3 transition-colors hover:bg-muted/60"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{course.name}</p>
                    <p className="grade text-xs text-muted-foreground">
                      {course.code} · {creditsLabel(course.credits)}
                    </p>
                  </div>
                  <span className="flex shrink-0 items-center gap-1.5 text-sm text-muted-foreground">
                    {enrollmentByCourse.has(course.id) ? "Ver notas" : "Empezar"}
                    <ArrowRight className="size-4" aria-hidden />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="herramientas" className="flex flex-col gap-3">
        <h2
          id="herramientas"
          className="border-b border-border pb-2 font-heading text-lg font-semibold"
        >
          Herramientas
        </h2>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <ToolLink
            to="/app/simulacion"
            title="Simulador de matrícula"
            description="Qué materias quedan habilitadas para el próximo semestre."
          />
          <ToolLink
            to="/app/calculadora"
            title="Calculadora del suple"
            description="Cuánto necesitas para aprobar según tus dos bimestres."
          />
          <ToolLink
            to="/app/requisitos"
            title="Requisitos de graduación"
            description="Inglés, deportes, vinculación y el resto del checklist."
          />
        </ul>
      </section>
    </div>
  );
}

function ProgressBar({ percent }: { percent: number }) {
  const clamped = Math.min(100, Math.max(0, percent));
  return (
    <div
      className="h-2 w-full overflow-hidden rounded-full bg-muted"
      role="progressbar"
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label="Avance de la malla"
    >
      <div
        className="h-full rounded-full bg-primary transition-[width] duration-500"
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}

function CountItem({ state, value }: { state: CourseState; value: number }) {
  const meta = COURSE_STATE_META[state];
  return (
    <div className="flex items-center gap-2">
      <span className={cn("size-2 shrink-0 rounded-full", meta.dot)} aria-hidden />
      <dt className="text-sm text-muted-foreground">{meta.label}</dt>
      <dd className="grade text-sm font-medium">{value}</dd>
    </div>
  );
}

function EmptyInProgress() {
  return (
    <div className="flex flex-col items-start gap-3 py-6">
      <p className="text-sm text-muted-foreground">
        No tienes materias marcadas como “En curso”. Márcalas en tu malla y aparecerán aquí con
        acceso directo a sus notas.
      </p>
      <Button asChild variant="outline" size="sm">
        <Link to="/app/curriculum">
          <NotebookPen /> Ir a mi malla
        </Link>
      </Button>
    </div>
  );
}

function ToolLink({
  to,
  title,
  description,
}: {
  to: string;
  title: string;
  description: string;
}) {
  return (
    <li>
      <Link
        to={to}
        className="flex h-full flex-col gap-1 rounded-md border border-border bg-card p-4 transition-colors hover:border-primary/40 hover:bg-muted/50"
      >
        <span className="font-heading text-base font-semibold">{title}</span>
        <span className="text-sm leading-5 text-muted-foreground">{description}</span>
      </Link>
    </li>
  );
}

function OnboardingCta({ name }: { name: string }) {
  return (
    <div className="mx-auto flex max-w-lg flex-col items-start gap-5 py-16">
      <GraduationCap className="size-8 text-primary" aria-hidden />
      <div>
        <h1 className="font-heading text-2xl font-semibold">Hola, {name}</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Para armar tu cuaderno necesitamos tu carrera y tu pénsum. Son dos minutos y después
          puedes ajustar todo desde la malla.
        </p>
      </div>
      <Button asChild>
        <Link to="/app/onboarding">
          Configurar mi malla <ArrowRight />
        </Link>
      </Button>
    </div>
  );
}
