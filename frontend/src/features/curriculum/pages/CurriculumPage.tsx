import {
  ArrowRight,
  BookOpen,
  Clock3,
  GraduationCap,
  Loader2,
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

import type { CurriculumCourse, OrganizationUnit } from "../api";
import { COURSE_STATE_META, COURSE_STATE_ORDER } from "../constants";
import { useCareers, useCurricula, useCurriculumCourses } from "../hooks";

const UNIT_META: Record<OrganizationUnit, { label: string; stripe: string }> = {
  BASIC: { label: "Unidad básica", stripe: "bg-yellow-400 dark:bg-yellow-500" },
  PROFESSIONAL: { label: "Unidad profesional", stripe: "bg-blue-600" },
  CAPSTONE: { label: "Integración curricular", stripe: "bg-emerald-600" },
  OTHER: { label: "Otra", stripe: "bg-zinc-500" },
};

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

  const terms = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("es");
    const grouped = new Map<number, CurriculumCourse[]>();
    for (const course of coursesQuery.data ?? []) {
      if (query && !`${course.code} ${course.name}`.toLocaleLowerCase("es").includes(query)) {
        continue;
      }
      const list = grouped.get(course.reference_term) ?? [];
      list.push(course);
      grouped.set(course.reference_term, list);
    }
    return [...grouped.entries()].sort((a, b) => a[0] - b[0]);
  }, [coursesQuery.data, search]);

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
            Explora las materias por semestre y selecciona una para actualizar tu progreso.
          </p>
        </div>
        <Button asChild variant="outline" className="w-fit bg-background/60">
          <Link to="/app/onboarding"><Settings2 /> Configurar malla</Link>
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
          <Legend />
        </div>

        {coursesQuery.isLoading ? (
          <PageLoader />
        ) : terms.length === 0 ? (
          <div className="p-12 text-center text-sm text-muted-foreground">
            No encontramos materias con esa búsqueda.
          </div>
        ) : (
          <div className="divide-y divide-border/70">
            {terms.map(([term, courses]) => (
              <TermRow
                key={term}
                term={term}
                courses={courses}
                stateByCourse={stateByCourse}
                onSelect={setSelected}
              />
            ))}
          </div>
        )}
      </section>

      <CourseDialog
        course={selected}
        state={selected ? stateByCourse.get(selected.id) ?? "NOT_TAKEN" : "NOT_TAKEN"}
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

function TermRow({
  term,
  courses,
  stateByCourse,
  onSelect,
}: {
  term: number;
  courses: CurriculumCourse[];
  stateByCourse: Map<string, CourseState>;
  onSelect: (course: CurriculumCourse) => void;
}) {
  return (
    <div className="grid grid-cols-[4.5rem_minmax(0,1fr)] bg-background/25">
      <div className="flex flex-col items-center justify-center border-r border-border/70 px-2 py-5">
        <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Sem</span>
        <span className="text-2xl font-semibold tabular-nums">{term}</span>
      </div>
      <div className="overflow-x-auto p-3 scrollbar-thin">
        <div className="flex min-w-max gap-3">
          {courses.map((course) => {
            const state = stateByCourse.get(course.id) ?? "NOT_TAKEN";
            const stateMeta = COURSE_STATE_META[state];
            const unitMeta = UNIT_META[course.organization_unit];
            return (
              <button
                key={course.id}
                type="button"
                onClick={() => onSelect(course)}
                className={cn(
                  "group relative flex h-36 w-44 shrink-0 flex-col overflow-hidden rounded-lg border text-left transition-all hover:-translate-y-0.5 hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring",
                  stateMeta.card,
                )}
              >
                <div className="flex items-center justify-between border-b border-current/10 px-3 py-2 text-[10px] text-muted-foreground">
                  <span>{Number(course.credits)} créditos</span>
                  <span>{courseHours(course)} h</span>
                </div>
                <div className="flex flex-1 flex-col px-3 py-2.5">
                  <span className="line-clamp-3 text-xs font-semibold uppercase leading-[1.35]">
                    {course.name}
                  </span>
                  {course.prerequisite_codes.length > 0 && (
                    <span className="mt-auto truncate text-[10px] text-muted-foreground">
                      Req. {course.prerequisite_codes.join(", ")}
                    </span>
                  )}
                </div>
                <div className={cn("flex h-6 items-center justify-between px-3 text-[10px] font-semibold text-white", unitMeta.stripe)}>
                  <span>{course.code}</span>
                  <span className="size-1.5 rounded-full bg-white/90" title={stateMeta.label} />
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Legend() {
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
    </div>
  );
}

function CourseDialog({
  course,
  state,
  pending,
  onClose,
  onChange,
}: {
  course: CurriculumCourse | null;
  state: CourseState;
  pending: boolean;
  onClose: () => void;
  onChange: (course: CurriculumCourse, state: CourseState) => Promise<void>;
}) {
  return (
    <Dialog open={course !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        {course && (
          <>
            <DialogHeader>
              <DialogTitle>{course.name}</DialogTitle>
              <DialogDescription>
                {course.code} · Semestre {course.reference_term} · {Number(course.credits)} créditos · {courseHours(course)} horas
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
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

function courseHours(course: CurriculumCourse): number {
  return course.hours ?? Number(course.credits) * 48;
}
