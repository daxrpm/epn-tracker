import { ArrowRight, Loader2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CourseState } from "@/features/student/api";
import { useBulkCourseStates, useCourseStates, useProfile } from "@/features/student/hooks";
import { ApiError } from "@/lib/api/types";
import { cn } from "@/lib/utils";

import type { CurriculumCourse } from "../api";
import { COURSE_STATE_META, COURSE_STATE_ORDER } from "../constants";
import { useCurriculumCourses } from "../hooks";

export function CurriculumPage() {
  const profileQuery = useProfile();
  const curriculumId = profileQuery.data?.current_curriculum_id ?? null;
  const coursesQuery = useCurriculumCourses(curriculumId);
  const statesQuery = useCourseStates();
  const bulkStates = useBulkCourseStates();

  const [selected, setSelected] = useState<CurriculumCourse | null>(null);

  const stateByCourse = useMemo(
    () =>
      new Map<string, CourseState>(
        (statesQuery.data ?? []).map((s) => [s.curriculum_course_id, s.state]),
      ),
    [statesQuery.data],
  );

  const terms = useMemo(() => {
    const grouped = new Map<number, CurriculumCourse[]>();
    for (const course of coursesQuery.data ?? []) {
      const list = grouped.get(course.reference_term) ?? [];
      list.push(course);
      grouped.set(course.reference_term, list);
    }
    return [...grouped.entries()].sort((a, b) => a[0] - b[0]);
  }, [coursesQuery.data]);

  async function changeState(course: CurriculumCourse, state: CourseState) {
    try {
      await bulkStates.mutateAsync([{ curriculum_course_id: course.id, state }]);
      toast.success(`"${course.name}" actualizada a ${COURSE_STATE_META[state].label}.`);
      setSelected(null);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "No se pudo actualizar la materia.");
    }
  }

  if (profileQuery.isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!curriculumId) {
    return (
      <Card className="border-primary/30">
        <CardContent className="flex flex-col items-start gap-4 p-8">
          <h2 className="text-lg font-semibold">Aún no tienes una malla</h2>
          <p className="text-sm text-muted-foreground">
            Selecciona tu carrera y pénsum para ver tu malla interactiva.
          </p>
          <Button asChild>
            <Link to="/app/onboarding">
              Configurar ahora
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Malla interactiva</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Toca una materia para ver sus detalles y actualizar su estado.
        </p>
      </div>

      <Legend />

      {coursesQuery.isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          {terms.map(([term, courses]) => (
            <div key={term} className="flex flex-col gap-3">
              <h2 className="text-sm font-semibold text-muted-foreground">Semestre {term}</h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {courses.map((course) => {
                  const state = stateByCourse.get(course.id) ?? "NOT_TAKEN";
                  const meta = COURSE_STATE_META[state];
                  return (
                    <button
                      key={course.id}
                      type="button"
                      onClick={() => setSelected(course)}
                      className={cn(
                        "flex flex-col gap-2 rounded-xl border p-4 text-left transition-colors",
                        meta.card,
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-xs font-medium text-muted-foreground">
                          {course.code}
                        </span>
                        <span className={cn("mt-1 size-2 shrink-0 rounded-full", meta.dot)} />
                      </div>
                      <span className="text-sm font-semibold leading-tight">{course.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {Number(course.credits)} créditos · {meta.label}
                      </span>
                      {course.prerequisite_codes.length > 0 && (
                        <span className="text-xs text-muted-foreground">
                          Prerreq: {course.prerequisite_codes.join(", ")}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={selected !== null} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent>
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle>{selected.name}</DialogTitle>
                <DialogDescription>
                  {selected.code} · Semestre {selected.reference_term} ·{" "}
                  {Number(selected.credits)} créditos
                </DialogDescription>
              </DialogHeader>
              <div className="flex flex-col gap-4">
                <DetailRow
                  label="Prerrequisitos"
                  value={
                    selected.prerequisite_codes.length > 0
                      ? selected.prerequisite_codes.join(", ")
                      : "Ninguno"
                  }
                />
                <DetailRow
                  label="Correquisitos"
                  value={
                    selected.corequisite_codes.length > 0
                      ? selected.corequisite_codes.join(", ")
                      : "Ninguno"
                  }
                />
                <DetailRow label="Tipo" value={selected.is_required ? "Obligatoria" : "Optativa"} />

                <div className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium">Estado</span>
                  <Select
                    value={stateByCourse.get(selected.id) ?? "NOT_TAKEN"}
                    onValueChange={(value) => void changeState(selected, value as CourseState)}
                    disabled={bulkStates.isPending}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {COURSE_STATE_ORDER.map((state) => (
                        <SelectItem key={state} value={state}>
                          {COURSE_STATE_META[state].label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Legend() {
  return (
    <div className="flex flex-wrap gap-2">
      {COURSE_STATE_ORDER.map((state) => {
        const meta = COURSE_STATE_META[state];
        return (
          <Badge key={state} variant="outline" className="gap-1.5">
            <span className={cn("size-2 rounded-full", meta.dot)} />
            {meta.label}
          </Badge>
        );
      })}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border pb-3 last:border-0 last:pb-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-right text-sm font-medium">{value}</span>
    </div>
  );
}
