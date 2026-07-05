import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  Clock3,
  GraduationCap,
  Loader2,
  NotebookPen,
  Search,
  Settings2,
} from "lucide-react";
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
import { Input } from "@/components/ui/input";
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
import { CurriculumMap } from "../components/CurriculumMap";
import { COURSE_STATE_META, COURSE_STATE_ORDER, UNIT_META, courseHours } from "../constants";
import { useCareers, useCurricula, useCurriculumCourses } from "../hooks";
import { buildCodeStateMap, coursesWithUnmetPrereqs, unmetPrerequisites } from "../prerequisites";
import { subjectIcon } from "../subjectIcons";

export function CurriculumPage() {
  const profileQuery = useProfile();
  const curriculumId = profileQuery.data?.current_curriculum_id ?? null;
  const coursesQuery = useCurriculumCourses(curriculumId);
  const curriculaQuery = useCurricula();
  const careersQuery = useCareers();
  const statesQuery = useCourseStates();
  const bulkStates = useBulkCourseStates();

  const [selected, setSelected] = useState<CurriculumCourse | null>(null);
  const [search, setSearch] = useState("");

  const curriculum = (curriculaQuery.data ?? []).find((item) => item.id === curriculumId);
  const career = (careersQuery.data ?? []).find((item) => item.id === curriculum?.career_id);
  const totalHours =
    curriculum?.total_hours ??
    (coursesQuery.data ?? []).reduce((sum, course) => sum + courseHours(course), 0);

  const stateByCourse = useMemo(
    () =>
      new Map<string, CourseState>(
        (statesQuery.data ?? []).map((state) => [state.curriculum_course_id, state.state]),
      ),
    [statesQuery.data],
  );

  const filteredCourses = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("es");
    return (coursesQuery.data ?? []).filter(
      (course) =>
        !query || `${course.code} ${course.name}`.toLocaleLowerCase("es").includes(query),
    );
  }, [coursesQuery.data, search]);

  const prereqWarnings = useMemo(
    () => coursesWithUnmetPrereqs(coursesQuery.data ?? [], stateByCourse),
    [coursesQuery.data, stateByCourse],
  );

  const missingPrereqs = useMemo(() => {
    if (!selected) return [];
    return unmetPrerequisites(selected, buildCodeStateMap(coursesQuery.data ?? [], stateByCourse));
  }, [selected, coursesQuery.data, stateByCourse]);

  async function changeState(course: CurriculumCourse, state: CourseState) {
    try {
      await bulkStates.mutateAsync([{ curriculum_course_id: course.id, state }]);
      toast.success(`“${course.name}” ahora está ${COURSE_STATE_META[state].label.toLowerCase()}.`);
      setSelected(null);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "No se pudo actualizar la materia.");
    }
  }

  if (profileQuery.isLoading) return <PageLoader />;

  if (!curriculumId) {
    return (
      <Card className="border-border/80 bg-card/70">
        <CardContent className="flex flex-col items-start gap-4 p-8">
          <div className="grid size-11 place-items-center rounded-xl bg-muted">
            <GraduationCap className="size-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Aún no tienes una malla configurada</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Selecciona tu carrera y pénsum para construir tu mapa académico.
            </p>
          </div>
          <Button asChild>
            <Link to="/app/onboarding">Configurar ahora <ArrowRight /></Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Malla curricular · Pénsum {curriculum?.pensum_year ?? "—"}
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">
            {career?.name ?? "Tu malla académica"}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Toca una materia para resaltar sus prerrequisitos; tócala de nuevo para cambiar su estado.
          </p>
        </div>
        <Button asChild variant="outline" className="w-fit bg-background/60">
          <Link to="/app/ajustes"><Settings2 /> Cambiar carrera o pénsum</Link>
        </Button>
      </header>

      <section className="grid gap-3 sm:grid-cols-3" aria-label="Resumen de la malla">
        <SummaryCard icon={BookOpen} label="Asignaturas" value={String(coursesQuery.data?.length ?? 0)} />
        <SummaryCard icon={GraduationCap} label="Créditos" value={curriculum?.total_credits ?? "—"} />
        <SummaryCard icon={Clock3} label="Horas totales" value={String(totalHours || "—")} />
      </section>

      <section className="overflow-hidden rounded-2xl border border-border/80 bg-card/55 shadow-sm">
        <div className="flex flex-col gap-4 border-b border-border/70 p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por nombre o código"
              className="h-10 bg-background/70 pl-9"
            />
          </div>
          <Legend showArrows />
        </div>

        {coursesQuery.isLoading ? (
          <PageLoader />
        ) : filteredCourses.length === 0 ? (
          <div className="p-12 text-center text-sm text-muted-foreground">
            No encontramos materias con esa búsqueda.
          </div>
        ) : (
          <CurriculumMap
            courses={filteredCourses}
            stateByCourse={stateByCourse}
            onSelect={setSelected}
            prereqWarnings={prereqWarnings}
          />
        )}
      </section>

      <CourseDialog
        course={selected}
        state={selected ? stateByCourse.get(selected.id) ?? "NOT_TAKEN" : "NOT_TAKEN"}
        missingPrereqs={missingPrereqs}
        pending={bulkStates.isPending}
        onClose={() => setSelected(null)}
        onChange={changeState}
      />
    </div>
  );
}

function SummaryCard({ icon: Icon, label, value }: { icon: typeof BookOpen; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border/70 bg-card/65 p-4">
      <span className="grid size-9 place-items-center rounded-lg bg-muted"><Icon className="size-4" /></span>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-lg font-semibold tabular-nums">{value}</p>
      </div>
    </div>
  );
}

function Legend({ showArrows = false }: { showArrows?: boolean }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {COURSE_STATE_ORDER.slice(0, 3).map((state) => {
        const meta = COURSE_STATE_META[state];
        return (
          <Badge key={state} variant="outline" className="gap-1.5 bg-background/50 font-normal">
            <span className={cn("size-1.5 rounded-full", meta.dot)} /> {meta.label}
          </Badge>
        );
      })}
      {showArrows && (
        <>
          <Badge variant="outline" className="gap-1.5 bg-background/50 font-normal">
            <span className="h-0.5 w-4 rounded-full bg-blue-500" /> Prerrequisito
          </Badge>
          <Badge variant="outline" className="gap-1.5 bg-background/50 font-normal">
            <span className="h-0.5 w-4 rounded-full bg-amber-500" /> Correquisito
          </Badge>
        </>
      )}
    </div>
  );
}

function CourseDialog({
  course,
  state,
  missingPrereqs,
  pending,
  onClose,
  onChange,
}: {
  course: CurriculumCourse | null;
  state: CourseState;
  missingPrereqs: string[];
  pending: boolean;
  onClose: () => void;
  onChange: (course: CurriculumCourse, state: CourseState) => Promise<void>;
}) {
  const Icon = course ? subjectIcon(course.name, course.organization_unit) : null;
  return (
    <Dialog open={course !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        {course && Icon && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Icon className="size-4.5 shrink-0 text-muted-foreground" />
                {course.name}
              </DialogTitle>
              <DialogDescription>
                {course.code} · Semestre {course.reference_term} · {Number(course.credits)} créditos · {courseHours(course)} horas
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              {missingPrereqs.length > 0 && (
                <div className="flex items-start gap-2.5 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-300">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                  <p>
                    Te faltan prerrequisitos para esta materia:{" "}
                    <span className="font-medium">{missingPrereqs.join(", ")}</span>.
                  </p>
                </div>
              )}
              <DetailRow label="Prerrequisitos" value={course.prerequisite_codes.join(", ") || "Ninguno"} />
              <DetailRow label="Correquisitos" value={course.corequisite_codes.join(", ") || "Ninguno"} />
              <DetailRow label="Unidad" value={UNIT_META[course.organization_unit].label} />
              <div className="space-y-1.5">
                <span className="text-sm font-medium">Estado académico</span>
                <Select
                  value={state}
                  onValueChange={(value) => void onChange(course, value as CourseState)}
                  disabled={pending}
                >
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {COURSE_STATE_ORDER.map((item) => (
                      <SelectItem key={item} value={item}>{COURSE_STATE_META[item].label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {state === "IN_PROGRESS" && (
                <Button asChild className="w-full">
                  <Link to={`/app/notas/${course.id}`}>
                    <NotebookPen className="size-4" /> Gestionar notas
                  </Link>
                </Button>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border pb-3">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-right text-sm font-medium">{value}</span>
    </div>
  );
}

function PageLoader() {
  return <div className="flex justify-center py-16"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>;
}
