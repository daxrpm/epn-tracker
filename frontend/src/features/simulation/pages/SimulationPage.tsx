import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  GitBranch,
  GraduationCap,
  Loader2,
  Lock,
  Plus,
  Save,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import type { CourseState } from "@/features/student/api";
import { useCourseStates, useProfile } from "@/features/student/hooks";
import { useCurriculumCourses } from "@/features/curriculum/hooks";
import { ApiError } from "@/lib/api/types";
import { cn } from "@/lib/utils";

import { getSimulation, type SimulationResult } from "../api";
import {
  useDeleteSimulation,
  useRunSimulation,
  useSaveSimulation,
  useSavedSimulations,
} from "../hooks";

/** Outcomes the student can project for a course they are currently taking (ERS §8.22, CU-007). */
const ASSUMPTION_OPTIONS: { value: CourseState; label: string }[] = [
  { value: "PASSED", label: "La aprobaré" },
  { value: "FAILED", label: "Me quedaré" },
  { value: "ANNULLED", label: "La anularé" },
];

export function SimulationPage() {
  const profileQuery = useProfile();
  const curriculumId = profileQuery.data?.current_curriculum_id ?? null;
  const coursesQuery = useCurriculumCourses(curriculumId);
  const statesQuery = useCourseStates();

  const runSim = useRunSimulation();
  const saveSim = useSaveSimulation();
  const savedQuery = useSavedSimulations();
  const deleteSim = useDeleteSimulation();

  const courses = useMemo(() => coursesQuery.data ?? [], [coursesQuery.data]);
  const courseById = useMemo(
    () => new Map(courses.map((c) => [c.id, c])),
    [courses],
  );
  const stateByCourse = useMemo(
    () =>
      new Map<string, CourseState>(
        (statesQuery.data ?? []).map((s) => [s.curriculum_course_id, s.state]),
      ),
    [statesQuery.data],
  );

  const currentCourses = useMemo(
    () => courses.filter((c) => stateByCourse.get(c.id) === "IN_PROGRESS"),
    [courses, stateByCourse],
  );
  const approvedCredits = useMemo(
    () =>
      courses.reduce(
        (sum, c) => (stateByCourse.get(c.id) === "PASSED" ? sum + Number(c.credits) : sum),
        0,
      ),
    [courses, stateByCourse],
  );

  const [assumptions, setAssumptions] = useState<Record<string, CourseState>>({});
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [specialAuth, setSpecialAuth] = useState(false);
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [hasRun, setHasRun] = useState(false);
  const [scenarioName, setScenarioName] = useState("");

  // Seed each in-progress course with an optimistic "La aprobaré" the first time it appears.
  useEffect(() => {
    setAssumptions((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const c of currentCourses) {
        if (!(c.id in next)) {
          next[c.id] = "PASSED";
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [currentCourses]);

  function buildPayload(
    a: Record<string, CourseState>,
    sel: Set<string>,
    special: boolean,
  ) {
    return {
      assumptions: currentCourses.map((c) => ({
        curriculum_course_id: c.id,
        state: a[c.id] ?? ("PASSED" as CourseState),
      })),
      selected_course_ids: [...sel],
      has_special_credit_authorization: special,
    };
  }

  async function runWith(a: Record<string, CourseState>, sel: Set<string>, special: boolean) {
    try {
      const res = await runSim.mutateAsync(buildPayload(a, sel, special));
      setResult(res);
      setHasRun(true);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "No se pudo simular.");
    }
  }

  function changeAssumption(courseId: string, state: CourseState) {
    const next = { ...assumptions, [courseId]: state };
    const nextSelected = new Set(selectedIds);
    if (state === "FAILED") nextSelected.add(courseId);
    else nextSelected.delete(courseId);
    setAssumptions(next);
    setSelectedIds(nextSelected);
    if (state === "FAILED") {
      toast.info("La materia reprobada se agregó obligatoriamente al próximo semestre.");
    }
    if (hasRun) void runWith(next, nextSelected, specialAuth);
  }

  function toggleSelect(courseId: string) {
    const next = new Set(selectedIds);
    if (next.has(courseId)) next.delete(courseId);
    else next.add(courseId);
    setSelectedIds(next);
    if (hasRun) void runWith(assumptions, next, specialAuth);
  }

  function toggleSpecial(value: boolean) {
    setSpecialAuth(value);
    if (hasRun) void runWith(assumptions, selectedIds, value);
  }

  async function save() {
    const name = scenarioName.trim();
    if (!name) {
      toast.error("Ponle un nombre al escenario.");
      return;
    }
    try {
      await saveSim.mutateAsync({ name, ...buildPayload(assumptions, selectedIds, specialAuth) });
      toast.success("Escenario guardado.");
      setScenarioName("");
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "No se pudo guardar el escenario.");
    }
  }

  async function loadScenario(id: string, name: string) {
    try {
      const s = await getSimulation(id);
      const a: Record<string, CourseState> = {};
      for (const it of s.input_snapshot.assumptions) a[it.curriculum_course_id] = it.state;
      setAssumptions(a);
      setSelectedIds(new Set(s.input_snapshot.selected_course_ids));
      setSpecialAuth(s.input_snapshot.has_special_credit_authorization);
      setResult(s.result);
      setHasRun(true);
      setScenarioName(s.name);
      toast.success(`Escenario “${name}” cargado.`);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "No se pudo cargar el escenario.");
    }
  }

  async function removeScenario(id: string) {
    try {
      await deleteSim.mutateAsync(id);
      toast.success("Escenario eliminado.");
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "No se pudo eliminar.");
    }
  }

  if (profileQuery.isLoading || coursesQuery.isLoading) return <PageLoader />;

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
              Selecciona tu carrera y pénsum para simular tu próxima matrícula.
            </p>
          </div>
          <Button asChild>
            <Link to="/app/onboarding">
              Configurar ahora <ArrowRight />
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const maxCredits = result ? Number(result.max_credits) : null;
  const selectedCreditsLive = [...selectedIds].reduce(
    (sum, id) => sum + Number(courseById.get(id)?.credits ?? 0),
    0,
  );
  const overLimit = maxCredits != null && selectedCreditsLive > maxCredits;

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
          Simulador de matrícula
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">
          ¿Qué puedo tomar el próximo semestre?
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Marca cómo crees que terminarán tus materias en curso. Con tus créditos aprobados y las
          reglas de la EPN, calculamos qué materias quedan habilitadas y armas tu próxima matrícula.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          {/* Step 1 — mark current courses */}
          <Section title="1 · Tus materias en curso" hint={`${approvedCredits} créditos aprobados`}>
            {currentCourses.length === 0 ? (
              <EmptyHint>
                No tienes materias marcadas como “En curso”. Márcalas en tu{" "}
                <Link to="/app/curriculum" className="font-medium underline underline-offset-2">
                  malla
                </Link>{" "}
                para proyectar tu próximo semestre.
              </EmptyHint>
            ) : (
              <div className="space-y-2.5">
                {currentCourses.map((course) => (
                  <div
                    key={course.id}
                    className="flex flex-col gap-3 rounded-xl border border-border/70 bg-background/50 p-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{course.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {course.code} · {Number(course.credits)} créditos
                      </p>
                    </div>
                    <Select
                      value={assumptions[course.id] ?? "PASSED"}
                      onValueChange={(v) => changeAssumption(course.id, v as CourseState)}
                    >
                      <SelectTrigger className="w-full bg-background/70 sm:w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ASSUMPTION_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            )}

            <label className="mt-4 flex items-center gap-2.5 text-sm text-muted-foreground">
              <Checkbox
                checked={specialAuth}
                onCheckedChange={(v) => toggleSpecial(v === true)}
              />
              Tengo autorización para superar el máximo normal de créditos
            </label>

            <Button
              className="mt-4 w-full sm:w-auto"
              onClick={() => void runWith(assumptions, selectedIds, specialAuth)}
              disabled={runSim.isPending}
            >
              {runSim.isPending ? <Loader2 className="animate-spin" /> : <GitBranch />}
              {hasRun ? "Volver a simular" : "Simular"}
            </Button>
          </Section>

          {/* Step 2 — results */}
          {result && (
            <>
              <RestrictionBanner result={result} />
              <EligibleCourses
                result={result}
                selectedIds={selectedIds}
                onToggle={toggleSelect}
              />
              <BlockedCourses result={result} />
            </>
          )}
        </div>

        {/* Sidebar — selection cart + saved scenarios */}
        <aside className="space-y-6 lg:sticky lg:top-20 lg:self-start">
          <Section title="2 · Próximo semestre">
            {selectedIds.size === 0 ? (
              <EmptyHint>
                Aún no eliges materias. Toca una materia habilitada para agregarla aquí.
              </EmptyHint>
            ) : (
              <div className="space-y-2">
                {[...selectedIds].map((id) => {
                  const course = courseById.get(id);
                  if (!course) return null;
                  return (
                    <div
                      key={id}
                      className="flex items-center justify-between gap-2 rounded-lg border border-border/70 bg-background/50 px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{course.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {course.code} · {Number(course.credits)} cr
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => toggleSelect(id)}
                        className="grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        aria-label={`Quitar ${course.name}`}
                      >
                        <X className="size-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {maxCredits != null && (
              <div className="mt-4 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Créditos seleccionados</span>
                  <span
                    className={cn("font-semibold tabular-nums", overLimit && "text-destructive")}
                  >
                    {selectedCreditsLive} / {maxCredits}
                  </span>
                </div>
                <Progress
                  value={Math.min(100, (selectedCreditsLive / Math.max(maxCredits, 1)) * 100)}
                  indicatorClassName={overLimit ? "bg-destructive" : undefined}
                />
                {result && !result.selected_valid ? (
                  <p className="flex items-start gap-1.5 text-xs text-destructive">
                    <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                    {overLimit
                      ? "Superas el límite de créditos permitido."
                      : "Revisa las advertencias antes de matricular esta selección."}
                  </p>
                ) : (
                  selectedIds.size > 0 && (
                    <p className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="size-3.5" /> Selección válida.
                    </p>
                  )
                )}
              </div>
            )}

            <Separator className="my-4" />

            <div className="flex gap-2">
              <Input
                value={scenarioName}
                onChange={(e) => setScenarioName(e.target.value)}
                placeholder="Nombra este escenario"
                className="h-9 bg-background/70"
              />
              <Button size="icon" onClick={() => void save()} disabled={saveSim.isPending} aria-label="Guardar escenario">
                {saveSim.isPending ? <Loader2 className="animate-spin" /> : <Save />}
              </Button>
            </div>
          </Section>

          <Section title="Escenarios guardados">
            {savedQuery.isLoading ? (
              <div className="flex justify-center py-4">
                <Loader2 className="size-4 animate-spin text-muted-foreground" />
              </div>
            ) : (savedQuery.data ?? []).length === 0 ? (
              <EmptyHint>Guarda un escenario para compararlo después.</EmptyHint>
            ) : (
              <div className="space-y-2">
                {(savedQuery.data ?? []).map((s) => (
                  <div
                    key={s.id}
                    className="rounded-lg border border-border/70 bg-background/50 p-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => void loadScenario(s.id, s.name)}
                        className="min-w-0 flex-1 text-left"
                      >
                        <p className="truncate text-sm font-medium">{s.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {s.selected_credits}/{s.max_credits} cr ·{" "}
                          {s.selected_valid ? "válido" : "con avisos"}
                        </p>
                      </button>
                      <button
                        type="button"
                        onClick={() => void removeScenario(s.id)}
                        className="grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                        aria-label={`Eliminar ${s.name}`}
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Section>
        </aside>
      </div>
    </div>
  );
}

function RestrictionBanner({ result }: { result: SimulationResult }) {
  return (
    <Card className="border-border/80 bg-card/60">
      <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
            Créditos máximos este periodo
          </p>
          <p className="mt-1 text-3xl font-semibold tabular-nums">{result.max_credits}</p>
        </div>
        <div className="flex-1 space-y-1.5 sm:max-w-md">
          {result.restriction_reasons.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aplica el máximo normal de 15 créditos.
            </p>
          ) : (
            result.restriction_reasons.map((r) => (
              <p
                key={r.code}
                className="flex items-start gap-1.5 text-sm text-amber-700 dark:text-amber-300"
              >
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                {r.message}
              </p>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function EligibleCourses({
  result,
  selectedIds,
  onToggle,
}: {
  result: SimulationResult;
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
}) {
  const eligible = result.eligible_courses;
  const byTerm = useMemo(() => {
    const groups = new Map<number, typeof eligible>();
    for (const c of eligible) {
      const term = c.reference_term ?? 0;
      const list = groups.get(term) ?? [];
      list.push(c);
      groups.set(term, list);
    }
    return [...groups.entries()].sort((a, b) => a[0] - b[0]);
  }, [eligible]);

  if (result.eligible_courses.length === 0) {
    return (
      <Section title="Materias habilitadas">
        <EmptyHint>No hay materias habilitadas con este escenario.</EmptyHint>
      </Section>
    );
  }

  return (
    <Section title={`Materias habilitadas (${result.eligible_courses.length})`}>
      <div className="space-y-5">
        {byTerm.map(([term, list]) => (
          <div key={term}>
            <p className="mb-2 text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
              {term > 0 ? `Semestre ${term}` : "Otras"}
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {list.map((course) => {
                const id = course.curriculum_course_id;
                const selected = id != null && selectedIds.has(id);
                return (
                  <button
                    key={course.code}
                    type="button"
                    disabled={id == null}
                    onClick={() => id != null && onToggle(id)}
                    className={cn(
                      "flex items-center justify-between gap-2 rounded-xl border p-3 text-left transition-colors",
                      selected
                        ? "border-emerald-500/50 bg-emerald-500/10"
                        : "border-border/70 bg-background/50 hover:bg-accent",
                    )}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{course.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {course.code} · {Number(course.credits)} créditos
                      </p>
                    </div>
                    <span
                      className={cn(
                        "grid size-6 shrink-0 place-items-center rounded-full border",
                        selected
                          ? "border-emerald-500 bg-emerald-500 text-white"
                          : "border-border text-muted-foreground",
                      )}
                    >
                      {selected ? <CheckCircle2 className="size-4" /> : <Plus className="size-4" />}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}

function BlockedCourses({ result }: { result: SimulationResult }) {
  const [open, setOpen] = useState(false);
  if (result.blocked_courses.length === 0) return null;

  return (
    <Section title={`Materias bloqueadas (${result.blocked_courses.length})`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between text-sm text-muted-foreground"
      >
        <span className="flex items-center gap-2">
          <Lock className="size-4" /> Ver por qué están bloqueadas
        </span>
        <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="mt-3 space-y-2">
          {result.blocked_courses.map((course) => (
            <div key={course.code} className="rounded-lg border border-border/60 bg-background/40 p-3">
              <p className="text-sm font-medium">
                {course.name}{" "}
                <span className="font-normal text-muted-foreground">· {course.code}</span>
              </p>
              <ul className="mt-1 space-y-0.5">
                {course.reasons.map((r) => (
                  <li key={r.code} className="text-xs text-muted-foreground">
                    {r.message}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border/80 bg-card/55 p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold">{title}</h2>
        {hint && <span className="text-xs text-muted-foreground tabular-nums">{hint}</span>}
      </div>
      {children}
    </section>
  );
}

function EmptyHint({ children }: { children: React.ReactNode }) {
  return <p className="text-sm leading-6 text-muted-foreground">{children}</p>;
}

function PageLoader() {
  return (
    <div className="flex justify-center py-16">
      <Loader2 className="size-6 animate-spin text-muted-foreground" />
    </div>
  );
}
