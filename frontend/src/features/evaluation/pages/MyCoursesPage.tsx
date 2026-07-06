import { ArrowRight, BookOpen, Loader2, NotebookPen } from "lucide-react";
import { useMemo } from "react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useCurriculumCourses } from "@/features/curriculum/hooks";
import { subjectIcon } from "@/features/curriculum/subjectIcons";
import { useCourseStates, useProfile } from "@/features/student/hooks";

import { useCalculate, useEnrollments } from "../hooks";

export function MyCoursesPage() {
  const profileQuery = useProfile();
  const curriculumId = profileQuery.data?.current_curriculum_id ?? null;
  const coursesQuery = useCurriculumCourses(curriculumId);
  const statesQuery = useCourseStates();
  const enrollmentsQuery = useEnrollments();

  const inProgress = useMemo(() => {
    const ids = new Set(
      (statesQuery.data ?? [])
        .filter((s) => s.state === "IN_PROGRESS")
        .map((s) => s.curriculum_course_id),
    );
    return (coursesQuery.data ?? []).filter((c) => ids.has(c.id));
  }, [coursesQuery.data, statesQuery.data]);

  const loading =
    profileQuery.isLoading ||
    coursesQuery.isLoading ||
    statesQuery.isLoading ||
    enrollmentsQuery.isLoading;
  const enrollmentByCourse = useMemo(
    () =>
      new Map(
        (enrollmentsQuery.data ?? []).map((enrollment) => [
          enrollment.curriculum_course_id,
          enrollment.id,
        ]),
      ),
    [enrollmentsQuery.data],
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
          Gestión de notas
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">Mis materias</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Registra las notas de las materias que estás cursando y proyecta tu resultado final.
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : inProgress.length === 0 ? (
        <Card className="bg-card/65">
          <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
            <BookOpen className="size-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              No tienes materias marcadas como “cursando”. Márcalas en tu malla para gestionarlas
              aquí.
            </p>
            <Button asChild variant="outline">
              <Link to="/app/curriculum">
                Ir a la malla <ArrowRight className="size-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {inProgress.map((course) => {
            const Icon = subjectIcon(course.name, course.organization_unit);
            return (
            <Card key={course.id} className="bg-card/65 transition-colors hover:bg-card">
              <CardContent className="flex items-center justify-between gap-3 p-5">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted">
                    <Icon className="size-4 text-muted-foreground" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{course.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {course.code} · Semestre {course.reference_term}
                    </p>
                    <CourseGrade enrollmentId={enrollmentByCourse.get(course.id) ?? null} />
                  </div>
                </div>
                <Button asChild size="sm">
                  <Link to={`/app/notas/${course.id}`}>
                    <NotebookPen className="size-4" /> Notas
                  </Link>
                </Button>
              </CardContent>
            </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CourseGrade({ enrollmentId }: { enrollmentId: string | null }) {
  const calculationQuery = useCalculate(enrollmentId);
  if (!enrollmentId) {
    return <p className="mt-1 text-xs text-muted-foreground">Nota: sin configurar</p>;
  }
  if (calculationQuery.isLoading) {
    return <p className="mt-1 text-xs text-muted-foreground">Calculando nota…</p>;
  }
  const hasGrades =
    calculationQuery.data &&
    (Number(calculationQuery.data.aporte_1.evaluated_weight_percent) > 0 ||
      Number(calculationQuery.data.aporte_2.evaluated_weight_percent) > 0);
  return (
    <p className="mt-1 text-xs font-medium tabular-nums">
      Nota: {hasGrades ? `${calculationQuery.data?.final_40}/40` : "—"}
    </p>
  );
}
