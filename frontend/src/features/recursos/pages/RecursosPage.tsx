import { useQuery } from "@tanstack/react-query";
import { Library, Loader2, Search, ShieldCheck, Upload } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { listAcademicPeriods } from "@/features/admin/api";
import type { Professor } from "@/features/offering/api";
import { ApiError } from "@/lib/api/types";
import { useAuthStore } from "@/stores/auth.store";
import { useCurriculumCourses } from "@/features/curriculum/hooks";
import { useCourseStates, useProfile } from "@/features/student/hooks";

import type { Contribution, CourseOption, ResourceKind, ResourceListItem } from "../api";
import { CoursePicker } from "../components/CoursePicker";
import { ModerationQueue } from "../components/ModerationQueue";
import { ProfessorPicker } from "../components/ProfessorPicker";
import { ResourceCard } from "../components/ResourceCard";
import { ResourceViewerDialog } from "../components/ResourceViewerDialog";
import { UploadResourceDialog } from "../components/UploadResourceDialog";
import { CONTRIBUTION_LABELS, KIND_LABELS } from "../constants";
import { useResources, useVoteResource } from "../hooks";

const NONE = "__all__";
const KINDS: ResourceKind[] = ["PDF", "IMAGE", "MARKDOWN", "TEXT", "OFFICE", "LINK"];

export function RecursosPage() {
  const role = useAuthStore((state) => state.user?.role);
  const isAdmin = role === "ADMIN" || role === "SUPER_ADMIN";

  const [uploadOpen, setUploadOpen] = useState(false);
  const [course, setCourse] = useState<CourseOption | null>(null);
  const [viewing, setViewing] = useState<ResourceListItem | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [contribution, setContribution] = useState<string>(NONE);
  const [kind, setKind] = useState<string>(NONE);
  const [periodId, setPeriodId] = useState<string>(NONE);
  const [professor, setProfessor] = useState<Professor | null>(null);

  const periodsQuery = useQuery({
    queryKey: ["academic-periods"],
    queryFn: listAcademicPeriods,
  });
  const vote = useVoteResource();

  // Debounced so typing does not fire a request per keystroke.
  const debouncedSearch = useDebounced(search, 300);

  const filters = useMemo(
    () => ({
      course_id: course?.id,
      academic_period_id: periodId === NONE ? undefined : periodId,
      professor_id: professor?.id,
      contribution: contribution === NONE ? undefined : (contribution as Contribution),
      kind: kind === NONE ? undefined : (kind as ResourceKind),
      q: debouncedSearch.trim() || undefined,
    }),
    [course?.id, periodId, professor?.id, contribution, kind, debouncedSearch],
  );

  const resourcesQuery = useResources(filters, Boolean(course));
  const filtered = resourcesQuery.data ?? [];

  // Before a course is picked, show what is already there for the courses this student is
  // taking. Landing on an empty screen with a single picker made the whole section feel dead.
  const profileQuery = useProfile();
  const coursesQuery = useCurriculumCourses(profileQuery.data?.current_curriculum_id ?? null);
  const courseStatesQuery = useCourseStates();
  const myCourseIds = useMemo(() => {
    const inProgress = new Set(
      (courseStatesQuery.data ?? [])
        .filter((s) => s.state === "IN_PROGRESS")
        .map((s) => s.curriculum_course_id),
    );
    return (coursesQuery.data ?? [])
      .filter((c) => inProgress.has(c.id))
      .map((c) => ({ id: c.course_id, code: c.code, name: c.name }));
  }, [coursesQuery.data, courseStatesQuery.data]);

  async function handleVote(resource: ResourceListItem) {
    try {
      await vote.mutateAsync(resource.id);
      toast.success("¡Gracias! Tu aprobación se registró.");
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "No se pudo votar.");
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Library className="size-3.5" /> Recursos de estudio
          </p>
          <h1 className="mt-2 text-3xl font-semibold sm:text-4xl">Recursos por materia</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Apuntes, exámenes y material compartido por la comunidad. Busca una materia y
            explora los aportes de cada año, o sube el tuyo.
          </p>
        </div>
        <Button onClick={() => setUploadOpen(true)}>
          <Upload /> Aportar recurso
        </Button>
      </header>

      <Tabs defaultValue="consultar">
        <TabsList>
          <TabsTrigger value="consultar">Consultar</TabsTrigger>
          {isAdmin && (
            <TabsTrigger value="moderacion">
              <ShieldCheck className="size-4" /> Moderación
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="consultar" className="mt-4 space-y-5">
          <div className="max-w-xl space-y-1.5">
            <Label>Materia</Label>
            <CoursePicker value={course} onChange={setCourse} />
          </div>

          {!course ? (
            <MyCoursesShortcut courses={myCourseIds} onPick={setCourse} />
          ) : (
            <>
              <div className="grid gap-3 rounded-md border border-border bg-card p-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="relative sm:col-span-2 lg:col-span-1">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Buscar por título o tema"
                    className="h-9 pl-8"
                  />
                </div>
                <Select value={contribution} onValueChange={setContribution}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Bimestre" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Todos los bimestres</SelectItem>
                    <SelectItem value="APORTE_1">{CONTRIBUTION_LABELS.APORTE_1}</SelectItem>
                    <SelectItem value="APORTE_2">{CONTRIBUTION_LABELS.APORTE_2}</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={periodId} onValueChange={setPeriodId}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Año" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Todos los años</SelectItem>
                    {(periodsQuery.data ?? []).map((period) => (
                      <SelectItem key={period.id} value={period.id}>
                        {period.code}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={kind} onValueChange={setKind}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Todos los tipos</SelectItem>
                    {KINDS.map((k) => (
                      <SelectItem key={k} value={k}>
                        {KIND_LABELS[k]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="sm:col-span-2 lg:col-span-4">
                  <ProfessorPicker
                    value={professor}
                    onChange={setProfessor}
                    placeholder="Filtrar por profesor (opcional)"
                  />
                </div>
              </div>

              {resourcesQuery.isLoading ? (
                <div className="grid min-h-40 place-items-center">
                  <Loader2 className="size-6 animate-spin text-muted-foreground" />
                </div>
              ) : filtered.length === 0 ? (
                <div className="flex flex-col items-start gap-3 py-12">
                  <p className="text-sm text-muted-foreground">
                    {search || contribution !== NONE || kind !== NONE || periodId !== NONE
                      ? "Ningún recurso de esta materia coincide con esos filtros."
                      : "Todavía no hay recursos para esta materia."}
                  </p>
                  <Button size="sm" onClick={() => setUploadOpen(true)}>
                    <Upload /> Sube el primero
                  </Button>
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {filtered.map((resource) => (
                    <ResourceCard
                      key={resource.id}
                      resource={resource}
                      onView={setViewing}
                      onVote={handleVote}
                      voting={vote.isPending}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </TabsContent>

        {isAdmin && (
          <TabsContent value="moderacion" className="mt-4">
            <ModerationQueue />
          </TabsContent>
        )}
      </Tabs>

      <UploadResourceDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        initialCourse={course}
      />
      <ResourceViewerDialog resource={viewing} onClose={() => setViewing(null)} />
    </div>
  );
}

/** Debounce a value so a filter change does not fire a request per keystroke. */
function useDebounced<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

/** The landing state of the tab: the student's own courses, one click away. */
function MyCoursesShortcut({
  courses,
  onPick,
}: {
  courses: { id: string; code: string; name: string }[];
  onPick: (course: CourseOption) => void;
}) {
  if (courses.length === 0) {
    return (
      <p className="py-12 text-sm text-muted-foreground">
        Busca una materia arriba para ver sus recursos. Cuando marques materias como “En curso”
        en tu malla, aparecerán aquí como atajo.
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-3 py-2">
      <h2 className="text-sm font-medium text-muted-foreground">Tus materias en curso</h2>
      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {courses.map((course) => (
          <li key={course.id}>
            <button
              type="button"
              onClick={() => onPick(course)}
              className="flex w-full flex-col items-start gap-0.5 rounded-md border border-border bg-card p-3 text-left transition-colors hover:border-primary/40 hover:bg-muted/50"
            >
              <span className="text-sm font-medium">{course.name}</span>
              <span className="grade text-xs text-muted-foreground">{course.code}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
