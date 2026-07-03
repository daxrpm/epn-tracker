import { ArrowLeft, Award, BookOpen, GraduationCap, Loader2, Pencil, Target } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDecimal } from "@/features/calculators/format";
import { useCurriculumCourses } from "@/features/curriculum/hooks";
import { subjectIcon } from "@/features/curriculum/subjectIcons";
import { useProfile } from "@/features/student/hooks";
import { ApiError } from "@/lib/api/types";
import { cn } from "@/lib/utils";

import type { Contribution } from "../api";
import { scoreTone } from "../colors";
import { ComponentRow } from "../components/ComponentRow";
import { SchemePicker } from "../components/SchemePicker";
import { CONTRIBUTION_LABELS, CONTRIBUTION_ORDER, FINAL_STATUS_META } from "../constants";
import type { ComponentState, ContributionResult } from "../gradebook";
import {
  useCalculate,
  useCreateEnrollment,
  useEnrollments,
  useGradebook,
  useProjection,
  useScheme,
  useSetBimestreOverride,
} from "../hooks";
import { formatScoreScale, parseScoreInput } from "../scoreInput";

const CONTRIBUTION_ICON: Record<Contribution, typeof BookOpen> = {
  APORTE_1: BookOpen,
  APORTE_2: GraduationCap,
};

/** Persists whether the student has marked bimestre 1 as done, so Segundo/Nota final stay
 * hidden (too noisy) until then. Scoped per enrollment via localStorage. */
function useFirstBimestreDone(enrollmentId: string | null) {
  const key = enrollmentId ? `epn-notas.bim1-done.${enrollmentId}` : null;
  const [done, setDone] = useState(() => Boolean(key && localStorage.getItem(key) === "true"));

  useEffect(() => {
    setDone(Boolean(key && localStorage.getItem(key) === "true"));
  }, [key]);

  function toggle() {
    if (!key) return;
    setDone((prev) => {
      const next = !prev;
      localStorage.setItem(key, String(next));
      return next;
    });
  }

  return [done, toggle] as const;
}

/** null when nothing has been graded yet, so cards read as neutral instead of failing-red. */
function scoreOrNull(result: ContributionResult | undefined): number | null {
  if (!result || Number(result.evaluated_weight_percent) === 0) return null;
  return Number(result.score_20);
}

export function GradebookPage() {
  const { curriculumCourseId = "" } = useParams();
  const profileQuery = useProfile();
  const coursesQuery = useCurriculumCourses(profileQuery.data?.current_curriculum_id ?? null);
  const enrollmentsQuery = useEnrollments();
  const createEnrollment = useCreateEnrollment();

  const course = (coursesQuery.data ?? []).find((c) => c.id === curriculumCourseId);
  const enrollment = (enrollmentsQuery.data ?? []).find(
    (e) => e.curriculum_course_id === curriculumCourseId,
  );
  const enrollmentId = enrollment?.id ?? null;

  const gradebookQuery = useGradebook(enrollmentId);
  const calculateQuery = useCalculate(enrollmentId);
  const projectionQuery = useProjection(enrollmentId);
  const schemeQuery = useScheme(enrollment?.evaluation_scheme_id ?? null);
  const [firstBimestreDone, toggleFirstBimestreDone] = useFirstBimestreDone(enrollmentId);

  const componentsByContribution = useMemo(() => {
    const map: Record<Contribution, ComponentState[]> = { APORTE_1: [], APORTE_2: [] };
    for (const component of gradebookQuery.data?.components ?? []) {
      map[component.contribution].push(component);
    }
    return map;
  }, [gradebookQuery.data]);

  async function startWithScheme(schemeId: string) {
    try {
      await createEnrollment.mutateAsync({
        curriculum_course_id: curriculumCourseId,
        evaluation_scheme_id: schemeId,
      });
      toast.success("Materia lista para registrar tus notas.");
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "No se pudo iniciar la materia.");
    }
  }

  const loading =
    profileQuery.isLoading || coursesQuery.isLoading || enrollmentsQuery.isLoading;
  const CourseIcon = course ? subjectIcon(course.name, course.organization_unit) : BookOpen;

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Link
          to="/app/notas"
          className="flex w-fit items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Mis materias
        </Link>
        <h1 className="flex items-center gap-2 text-3xl font-semibold tracking-[-0.04em]">
          {course && <CourseIcon className="size-6 shrink-0 text-muted-foreground" />}
          {course ? course.name : "Notas"}
        </h1>
        {course && (
          <p className="text-sm text-muted-foreground">
            {course.code} · Semestre {course.reference_term}
          </p>
        )}
        {schemeQuery.data && (
          <p className="text-sm text-muted-foreground">
            Curso: <span className="font-medium text-foreground">{schemeQuery.data.title}</span>
            {schemeQuery.data.professor_name && ` · ${schemeQuery.data.professor_name}`}
          </p>
        )}
      </div>

      {loading ? (
        <PageLoader />
      ) : !course ? (
        <Card className="bg-card/65">
          <CardContent className="p-6 text-sm text-muted-foreground">
            No encontramos esta materia en tu malla.
          </CardContent>
        </Card>
      ) : !enrollment ? (
        <SchemePicker
          courseId={course.course_id}
          courseName={course.name}
          onUse={(schemeId) => void startWithScheme(schemeId)}
          busy={createEnrollment.isPending}
        />
      ) : gradebookQuery.isLoading ? (
        <PageLoader />
      ) : (
        <div className="flex flex-col gap-5">
          <div className="grid gap-3 sm:grid-cols-3">
            <BimestreCard
              icon={CONTRIBUTION_ICON.APORTE_1}
              label={CONTRIBUTION_LABELS.APORTE_1}
              score20={scoreOrNull(calculateQuery.data?.aporte_1)}
            />
            {firstBimestreDone && (
              <>
                <BimestreCard
                  icon={CONTRIBUTION_ICON.APORTE_2}
                  label={CONTRIBUTION_LABELS.APORTE_2}
                  score20={scoreOrNull(calculateQuery.data?.aporte_2)}
                />
                <FinalGradeCard calculate={calculateQuery.data} />
              </>
            )}
          </div>

          <div className="flex justify-end">
            <Button type="button" variant="outline" size="sm" onClick={toggleFirstBimestreDone}>
              {firstBimestreDone
                ? "Ocultar nota final y segundo bimestre"
                : "Marcar primer bimestre como finalizado"}
            </Button>
          </div>

          {firstBimestreDone && <ProjectionNotice projection={projectionQuery.data} />}

          <Tabs defaultValue="APORTE_1">
            <TabsList>
              {CONTRIBUTION_ORDER.map((contribution) => (
                <TabsTrigger key={contribution} value={contribution}>
                  {CONTRIBUTION_LABELS[contribution]}
                </TabsTrigger>
              ))}
            </TabsList>

            {CONTRIBUTION_ORDER.map((contribution) => {
              const overrideScore =
                contribution === "APORTE_1"
                  ? enrollment.aporte_1_override_score
                  : enrollment.aporte_2_override_score;
              const overrideScale =
                contribution === "APORTE_1"
                  ? enrollment.aporte_1_override_scale
                  : enrollment.aporte_2_override_scale;
              return (
                <TabsContent
                  key={contribution}
                  value={contribution}
                  className="mt-4 flex flex-col gap-3"
                >
                  <BimestreOverrideControl
                    enrollmentId={enrollment.id}
                    contribution={contribution}
                    overrideScore={overrideScore}
                    overrideScale={overrideScale}
                  />
                  {overrideScore === null && (
                    <ComponentsTable
                      components={componentsByContribution[contribution]}
                      enrollmentId={enrollment.id}
                    />
                  )}
                </TabsContent>
              );
            })}
          </Tabs>
        </div>
      )}
    </div>
  );
}

function BimestreOverrideControl({
  enrollmentId,
  contribution,
  overrideScore,
  overrideScale,
}: {
  enrollmentId: string;
  contribution: Contribution;
  overrideScore: string | null;
  overrideScale: string | null;
}) {
  const setOverride = useSetBimestreOverride(enrollmentId);
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(formatScoreScale(overrideScore, overrideScale));

  useEffect(() => {
    setText(formatScoreScale(overrideScore, overrideScale));
  }, [overrideScore, overrideScale]);

  async function commit() {
    const parsed = parseScoreInput(text);
    if (!parsed) {
      toast.error("Ingresa una nota válida, ej. 16/20.");
      return;
    }
    try {
      await setOverride.mutateAsync({
        contribution,
        score: parsed.score,
        score_scale: parsed.scale,
      });
      toast.success("Nota del bimestre guardada.");
      setEditing(false);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "No se pudo guardar la nota.");
    }
  }

  async function clear() {
    try {
      await setOverride.mutateAsync({ contribution, score: null });
      toast.success("Se volvió a calcular por ponderaciones.");
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "No se pudo actualizar.");
    }
  }

  if (overrideScore !== null) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-sky-500/40 bg-sky-500/10 p-3 text-sm">
        <p>
          Nota del bimestre ingresada directamente:{" "}
          <span className="font-semibold tabular-nums">
            {formatScoreScale(overrideScore, overrideScale)}
          </span>
        </p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => void clear()}
          disabled={setOverride.isPending}
        >
          Volver a ponderaciones
        </Button>
      </div>
    );
  }

  if (!editing) {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-fit"
        onClick={() => setEditing(true)}
      >
        <Pencil className="size-3.5" /> Poner nota total del bimestre directamente
      </Button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input
        autoFocus
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Ej. 16/20"
        className="h-9 w-28 tabular-nums"
      />
      <Button type="button" size="sm" onClick={() => void commit()} disabled={setOverride.isPending}>
        {setOverride.isPending && <Loader2 className="size-3.5 animate-spin" />}
        Guardar
      </Button>
      <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(false)}>
        Cancelar
      </Button>
    </div>
  );
}

function BimestreCard({
  icon: Icon,
  label,
  score20,
}: {
  icon: typeof BookOpen;
  label: string;
  score20: number | null;
}) {
  const tone = scoreTone(score20);
  const percent = score20 !== null ? Math.min(100, Math.max(0, (score20 / 20) * 100)) : 0;

  return (
    <Card className={cn("rounded-xl border", tone.border, tone.bg)}>
      <CardContent className="flex flex-col gap-2 p-3.5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
            {label}
          </span>
          <Icon className={cn("size-3.5", tone.text)} />
        </div>
        <div className="flex items-baseline gap-1">
          <strong className={cn("text-xl font-semibold tabular-nums tracking-[-0.02em]", tone.text)}>
            {score20 !== null ? formatDecimal(score20) : "—"}
          </strong>
          <span className="text-xs text-muted-foreground">/20</span>
        </div>
        <Progress value={percent} indicatorClassName={tone.indicator} />
      </CardContent>
    </Card>
  );
}

function FinalGradeCard({ calculate }: { calculate: ReturnType<typeof useCalculate>["data"] }) {
  const hasAnyData =
    calculate &&
    (Number(calculate.aporte_1.evaluated_weight_percent) > 0 ||
      Number(calculate.aporte_2.evaluated_weight_percent) > 0);
  const final20 = hasAnyData ? Number(calculate.final_20) : null;
  const tone = scoreTone(final20);
  const percent = final20 !== null ? Math.min(100, Math.max(0, (final20 / 20) * 100)) : 0;
  const status = calculate ? FINAL_STATUS_META[calculate.status] : null;

  return (
    <Card className={cn("rounded-xl border", tone.border, tone.bg)}>
      <CardContent className="flex flex-col gap-2 p-3.5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
            Nota final
          </span>
          <Award className={cn("size-3.5", tone.text)} />
        </div>
        <div className="flex items-baseline gap-1">
          <strong className={cn("text-xl font-semibold tabular-nums tracking-[-0.02em]", tone.text)}>
            {final20 !== null && calculate ? formatDecimal(calculate.final_40) : "—"}
          </strong>
          <span className="text-xs text-muted-foreground">/40</span>
        </div>
        <Progress value={percent} indicatorClassName={tone.indicator} />
        {status && (
          <Badge
            variant="outline"
            className={cn("w-fit border-current bg-background/50 text-[10px]", status.tone)}
          >
            {status.label}
          </Badge>
        )}
      </CardContent>
    </Card>
  );
}

function ProjectionNotice({
  projection,
}: {
  projection: ReturnType<typeof useProjection>["data"];
}) {
  if (!projection || projection.already_reached || !projection.required_avg_score_20) return null;

  return (
    <div
      className={cn(
        "flex items-start gap-2.5 rounded-lg border p-3 text-sm",
        projection.is_reachable
          ? "border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300"
          : "border-destructive/40 bg-destructive/10 text-destructive",
      )}
    >
      <Target className="mt-0.5 size-4 shrink-0" />
      <p>
        {projection.is_reachable ? (
          <>
            Necesitas un promedio de{" "}
            <span className="font-semibold tabular-nums">
              {formatDecimal(projection.required_avg_score_20)}/20
            </span>{" "}
            en lo que te falta para aprobar (28/40).
          </>
        ) : (
          <>Ya no es posible alcanzar 28/40 con lo que resta.</>
        )}
      </p>
    </div>
  );
}

function ComponentsTable({
  components,
  enrollmentId,
}: {
  components: ComponentState[];
  enrollmentId: string;
}) {
  if (components.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
        Este bimestre no tiene componentes.
      </p>
    );
  }
  return (
    <div className="overflow-hidden rounded-xl border border-border/80">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>Componente</TableHead>
            <TableHead>Modo</TableHead>
            <TableHead>Entrada</TableHead>
            <TableHead>Nota /20</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {components.map((component) => (
            <ComponentRow key={component.id} component={component} enrollmentId={enrollmentId} />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function PageLoader() {
  return (
    <div className="flex justify-center py-16">
      <Loader2 className="size-6 animate-spin text-muted-foreground" />
    </div>
  );
}
