import { ArrowRight, BookOpen, Loader2, NotebookPen } from "lucide-react";
import { useMemo } from "react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useCurriculumCourses } from "@/features/curriculum/hooks";
import { useCourseStates, useProfile } from "@/features/student/hooks";

export function MyCoursesPage() {
  const profileQuery = useProfile();
  const curriculumId = profileQuery.data?.current_curriculum_id ?? null;
  const coursesQuery = useCurriculumCourses(curriculumId);
  const statesQuery = useCourseStates();

  const inProgress = useMemo(() => {
    const ids = new Set(
      (statesQuery.data ?? [])
        .filter((s) => s.state === "IN_PROGRESS")
        .map((s) => s.curriculum_course_id),
    );
    return (coursesQuery.data ?? []).filter((c) => ids.has(c.id));
  }, [coursesQuery.data, statesQuery.data]);

  const loading = profileQuery.isLoading || coursesQuery.isLoading || statesQuery.isLoading;

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
          {inProgress.map((course) => (
            <Card key={course.id} className="bg-card/65 transition-colors hover:bg-card">
              <CardContent className="flex items-center justify-between gap-3 p-5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{course.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {course.code} · Semestre {course.reference_term}
                  </p>
                </div>
                <Button asChild size="sm">
                  <Link to={`/app/notas/${course.id}`}>
                    <NotebookPen className="size-4" /> Notas
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
