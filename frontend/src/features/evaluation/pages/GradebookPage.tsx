import { ArrowLeft, Loader2, Pencil, RefreshCw, Target } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDecimal } from "@/features/calculators/format";
import { useCurriculumCourses } from "@/features/curriculum/hooks";
import { useProfile } from "@/features/student/hooks";
import { cn } from "@/lib/utils";
import { creditsLabel } from "@/lib/format";

import type { Contribution } from "../api";
import { ComponentRow } from "../components/ComponentRow";
import { RecoveryPanel } from "../components/RecoveryPanel";
import { SchemePicker } from "../components/SchemePicker";
import { CONTRIBUTION_LABELS, CONTRIBUTION_ORDER, FINAL_STATUS_META } from "../constants";
import type { ComponentState } from "../gradebook";
import {
  useCalculate,
  useCreateEnrollment,
  useDeleteEnrollment,
  useEnrollments,
  useGradebook,
  useProjection,
  useScheme,
  useSetBimestreOverride,
} from "../hooks";
import {
  formatScoreScale,
  isScoreInputDraft,
  parseScoreInput,
  scoreInputError,
} from "../scoreInput";

/**
 * The screen's job: "what grade am I carrying, and what do I still need?".
 *
 * The focal element is the running grade over 40. The second bimestre and the final grade used
 * to be hidden behind a localStorage flag the student had to toggle by hand, which meant the
 * same account showed different things on different devices; they are now simply shown once
 * there is anything to show.
 */
export function GradebookPage() {
  const { curriculumCourseId = "" } = useParams();
  const navigate = useNavigate();
  const profileQuery = useProfile();
  const coursesQuery = useCurriculumCourses(profileQuery.data?.current_curriculum_id ?? null);
  const enrollmentsQuery = useEnrollments();
  const createEnrollment = useCreateEnrollment();
  const deleteEnrollment = useDeleteEnrollment();

  const [changingCourse, setChangingCourse] = useState(false);

  const course = (coursesQuery.data ?? []).find((c) => c.id === curriculumCourseId);
  const enrollment = (enrollmentsQuery.data ?? []).find(
    (e) => e.curriculum_course_id === curriculumCourseId,
  );
  const enrollmentId = enrollment?.id ?? null;

  const gradebookQuery = useGradebook(enrollmentId);
  const calculateQuery = useCalculate(enrollmentId);
  const projectionQuery = useProjection(enrollmentId);
  const schemeQuery = useScheme(enrollment?.evaluation_scheme_id ?? null);

  const componentsByContribution = useMemo(() => {
    const map: Record<Contribution, ComponentState[]> = { APORTE_1: [], APORTE_2: [] };
    for (const component of gradebookQuery.data?.components ?? []) {
      map[component.contribution].push(component);
    }
    return map;
  }, [gradebookQuery.data]);

  async function startWithScheme(schemeId: string) {
    await createEnrollment.mutateAsync({
      curriculum_course_id: curriculumCourseId,
      evaluation_scheme_id: schemeId,
    });
    toast.success("Materia lista para registrar tus notas.");
    setChangingCourse(false);
  }

  async function dropEnrollment() {
    if (!enrollmentId) return;
    await deleteEnrollment.mutateAsync(enrollmentId);
    toast.success("Curso descartado. Elige otro para volver a empezar.");
    setChangingCourse(true);
  }

  const loading =
    profileQuery.isLoading || coursesQuery.isLoading || enrollmentsQuery.isLoading;

  if (loading) return <PageLoader />;

  if (!course) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <h1 className="font-heading text-xl font-semibold">No encontramos esta materia</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          No pertenece a tu malla actual, o el enlace está mal escrito.
        </p>
        <Button className="mt-5" onClick={() => navigate("/app/notas")}>
          Ver mis materias
        </Button>
      </div>
    );
  }

  const calculate = calculateQuery.data;
  const hasAnyGrade =
    calculate != null &&
    (Number(calculate.aporte_1.evaluated_weight_percent) > 0 ||
      Number(calculate.aporte_2.evaluated_weight_percent) > 0);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8">
      <header className="flex flex-col gap-3">
        <Link
          to="/app/notas"
          className="flex w-fit items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden /> Mis materias
        </Link>
        <div className="margin-rule">
          <h1 className="font-heading text-2xl font-semibold sm:text-3xl">{course.name}</h1>
          <p className="grade mt-1 text-sm text-muted-foreground">
            {course.code} · Semestre {course.reference_term} · {creditsLabel(course.credits)}
          </p>
        </div>
      </header>

      {!enrollment || changingCourse ? (
        <div className="flex flex-col gap-4">
          {changingCourse && enrollment && (
            <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-muted/50 p-3 text-sm">
              <span className="text-muted-foreground">Estás cambiando de curso.</span>
              <Button variant="ghost" size="sm" onClick={() => setChangingCourse(false)}>
                Cancelar
              </Button>
            </div>
          )}
          <SchemePicker
            courseId={course.course_id}
            courseName={course.name}
            onUse={(schemeId) => void startWithScheme(schemeId)}
            busy={createEnrollment.isPending}
          />
        </div>
      ) : gradebookQuery.isLoading ? (
        <PageLoader />
      ) : (
        <>
          <section aria-label="Nota actual">
            <RunningGrade calculate={calculate} hasAnyGrade={hasAnyGrade} />
          </section>

          {projectionQuery.data && <ProjectionNotice projection={projectionQuery.data} />}

          {/* Shown once the ordinary grade lands in the recovery band, and kept visible
              afterwards so the recorded score stays editable. */}
          {enrollmentId &&
            calculate &&
            (calculate.status === "RECOVERY_ELIGIBLE" ||
              calculate.recovery_score_40 != null) && (
              <RecoveryPanel
                enrollmentId={enrollmentId}
                recoveryScore={enrollment.recovery_score_40}
                required={calculate.required_recovery_score_40}
                passed={calculate.recovery_passed}
                effectiveFinal40={calculate.effective_final_40}
              />
            )}

          <Tabs defaultValue="APORTE_1" className="flex flex-col gap-4">
            <TabsList>
              {CONTRIBUTION_ORDER.map((contribution) => (
                <TabsTrigger key={contribution} value={contribution}>
                  {CONTRIBUTION_LABELS[contribution]}
                  {calculate && (
                    <span className="grade ml-2 text-xs text-muted-foreground">
                      {Number(calculate[bimestreKey(contribution)].evaluated_weight_percent) > 0
                        ? formatDecimal(calculate[bimestreKey(contribution)].score_20)
                        : "—"}
                    </span>
                  )}
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
                  className="flex flex-col gap-4"
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

          <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
            <p className="text-sm text-muted-foreground">
              {schemeQuery.data ? (
                <>
                  Curso:{" "}
                  <span className="font-medium text-foreground">{schemeQuery.data.title}</span>
                  {schemeQuery.data.professor_name && ` · ${schemeQuery.data.professor_name}`}
                </>
              ) : (
                "Curso sin nombre"
              )}
            </p>
            <ConfirmDialog
              title="¿Cambiar de curso?"
              description="Se borran las notas que registraste en este curso. Después podrás elegir otro paralelo o profesor."
              confirmLabel="Sí, cambiar de curso"
              onConfirm={dropEnrollment}
              pending={deleteEnrollment.isPending}
              trigger={
                <Button variant="outline" size="sm">
                  <RefreshCw /> Cambiar de curso
                </Button>
              }
            />
          </footer>
        </>
      )}
    </div>
  );
}

function bimestreKey(contribution: Contribution): "aporte_1" | "aporte_2" {
  return contribution === "APORTE_1" ? "aporte_1" : "aporte_2";
}

/** The focal element: the grade over 40 that this course is currently carrying. */
function RunningGrade({
  calculate,
  hasAnyGrade,
}: {
  calculate: ReturnType<typeof useCalculate>["data"];
  hasAnyGrade: boolean;
}) {
  const status = calculate ? FINAL_STATUS_META[calculate.status] : null;
  const shown = calculate?.effective_final_40 ?? calculate?.final_40;
  const usedRecovery = calculate?.recovery_score_40 != null;

  return (
    <Card focal>
      <CardContent className="flex flex-wrap items-end justify-between gap-6 p-6">
        <div>
          <p className="text-sm text-muted-foreground">
            {usedRecovery ? "Nota final con recuperación" : "Nota que llevas"}
          </p>
          <p className="mt-1 flex items-baseline gap-1.5">
            <span className="grade text-5xl sm:text-6xl">
              {hasAnyGrade && shown ? formatDecimal(shown) : "—"}
            </span>
            <span className="text-xl text-muted-foreground">/40</span>
          </p>
          {hasAnyGrade && calculate && (
            <p className="grade mt-1 text-sm text-muted-foreground">
              equivale a {formatDecimal(calculate.effective_final_20)}/20
            </p>
          )}
        </div>
        {status && (
          <Badge variant={status.badge} className="text-sm">
            {status.label}
          </Badge>
        )}
      </CardContent>
    </Card>
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
    const validationError = scoreInputError(text, "20");
    if (validationError) {
      toast.error(validationError);
      return;
    }
    const parsed = parseScoreInput(text, "20");
    if (!parsed) {
      toast.error("Escribe la nota del bimestre, por ejemplo 16/20.");
      return;
    }
    await setOverride.mutateAsync({
      contribution,
      score: parsed.score,
      score_scale: parsed.scale,
    });
    toast.success("Nota del bimestre guardada.");
    setEditing(false);
  }

  if (overrideScore !== null) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-muted/50 p-3 text-sm">
        <p>
          Nota del bimestre puesta a mano:{" "}
          <span className="grade font-medium">
            {formatScoreScale(overrideScore, overrideScale)}
          </span>
          <span className="ml-1.5 text-muted-foreground">
            (reemplaza el cálculo por ponderaciones, sin borrarlas)
          </span>
        </p>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => void setOverride.mutateAsync({ contribution, score: null })}
          disabled={setOverride.isPending}
        >
          Volver a ponderaciones
        </Button>
      </div>
    );
  }

  if (!editing) {
    return (
      <Button variant="outline" size="sm" className="w-fit" onClick={() => setEditing(true)}>
        <Pencil /> Poner la nota total del bimestre
      </Button>
    );
  }

  const inputId = `override-${contribution}`;
  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="flex flex-col gap-1">
        <label htmlFor={inputId} className="text-xs text-muted-foreground">
          Nota del bimestre
        </label>
        <Input
          id={inputId}
          autoFocus
          inputMode="decimal"
          value={text}
          onChange={(e) => isScoreInputDraft(e.target.value) && setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void commit();
            if (e.key === "Escape") setEditing(false);
          }}
          placeholder="16/20"
          className="grade w-28"
        />
      </div>
      <Button size="sm" onClick={() => void commit()} disabled={setOverride.isPending}>
        {setOverride.isPending && <Loader2 className="animate-spin" />}
        Guardar
      </Button>
      <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
        Cancelar
      </Button>
    </div>
  );
}

function ProjectionNotice({
  projection,
}: {
  projection: ReturnType<typeof useProjection>["data"];
}) {
  if (!projection || projection.already_reached || !projection.required_avg_score_20)
    return null;

  const target = formatDecimal(projection.target_final_40);
  return (
    <div
      className={cn(
        "flex items-start gap-2.5 rounded-md border p-3 text-sm",
        projection.is_reachable
          ? "border-border bg-muted/50"
          : "border-state-failed/40 bg-state-failed-soft text-state-failed",
      )}
    >
      <Target className="mt-0.5 size-4 shrink-0" aria-hidden />
      <p>
        {projection.is_reachable ? (
          <>
            Necesitas un promedio de{" "}
            <span className="grade font-medium">
              {formatDecimal(projection.required_avg_score_20)}/20
            </span>{" "}
            en lo que te falta para llegar a {target}/40.
          </>
        ) : (
          <>Con lo que resta ya no alcanzas {target}/40 en la nota ordinaria.</>
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
      <p className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
        Este bimestre no tiene componentes en el curso que elegiste.
      </p>
    );
  }
  return (
    <ul className="rule-list overflow-hidden rounded-md border border-border">
      {components.map((component) => (
        <ComponentRow key={component.id} component={component} enrollmentId={enrollmentId} />
      ))}
    </ul>
  );
}

function PageLoader() {
  return (
    <div className="flex justify-center py-16" role="status" aria-live="polite">
      <Loader2 className="size-5 animate-spin text-muted-foreground" aria-hidden />
      <span className="sr-only">Cargando</span>
    </div>
  );
}
