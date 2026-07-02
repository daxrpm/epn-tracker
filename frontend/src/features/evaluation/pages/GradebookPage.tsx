import { ArrowLeft, Loader2, Target } from "lucide-react";
import { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatScore } from "@/features/calculators/format";
import { useCurriculumCourses } from "@/features/curriculum/hooks";
import { useProfile } from "@/features/student/hooks";
import { ApiError } from "@/lib/api/types";
import { cn } from "@/lib/utils";

import type { Contribution } from "../api";
import { ComponentRow } from "../components/ComponentRow";
import { SchemePicker } from "../components/SchemePicker";
import { scoreTone } from "../colors";
import { CONTRIBUTION_LABELS, CONTRIBUTION_ORDER, FINAL_STATUS_META } from "../constants";
import type { ComponentState } from "../gradebook";
import {
  useCalculate,
  useCreateEnrollment,
  useEnrollments,
  useGradebook,
  useProjection,
  useScheme,
} from "../hooks";

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

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Link
          to="/app/notas"
          className="flex w-fit items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Mis materias
        </Link>
        <h1 className="text-3xl font-semibold tracking-[-0.04em]">
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
        <Tabs defaultValue="APORTE_1">
          <TabsList>
            {CONTRIBUTION_ORDER.map((contribution) => {
              const result =
                calculateQuery.data?.[contribution === "APORTE_1" ? "aporte_1" : "aporte_2"];
              return (
                <TabsTrigger key={contribution} value={contribution} className="gap-2">
                  {CONTRIBUTION_LABELS[contribution]}
                  {result && (
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {formatScore(result.score_20)}/20
                    </span>
                  )}
                </TabsTrigger>
              );
            })}
          </TabsList>

          {CONTRIBUTION_ORDER.map((contribution) => (
            <TabsContent key={contribution} value={contribution} className="mt-4 flex flex-col gap-4">
              {/* The final grade only matters once the second bimestre is in play. */}
              {contribution === "APORTE_2" && (
                <FinalSummary calculate={calculateQuery.data} projection={projectionQuery.data} />
              )}

              <ComponentsTable
                components={componentsByContribution[contribution]}
                enrollmentId={enrollment.id}
              />
            </TabsContent>
          ))}
        </Tabs>
      )}
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

function FinalSummary({
  calculate,
  projection,
}: {
  calculate: ReturnType<typeof useCalculate>["data"];
  projection: ReturnType<typeof useProjection>["data"];
}) {
  const status = calculate ? FINAL_STATUS_META[calculate.status] : null;
  // final_20 is already the grade on a /20 scale (final_40 / 2).
  const tone = calculate ? scoreTone(Number(calculate.final_20)) : null;

  return (
    <Card className="rounded-2xl bg-card/70">
      <CardContent className="flex flex-col gap-4 p-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
              Nota final
            </p>
            <div className="mt-1 flex items-baseline gap-2">
              <strong
                className={cn(
                  "text-4xl font-semibold tabular-nums tracking-[-0.04em]",
                  tone?.text,
                )}
              >
                {calculate ? formatScore(calculate.final_40) : "—"}
              </strong>
              <span className="text-sm text-muted-foreground">/40</span>
              {calculate && (
                <span className="text-sm text-muted-foreground">
                  · {formatScore(calculate.display_final_20)}/20
                </span>
              )}
            </div>
          </div>
          {status && (
            <Badge variant="outline" className={cn("border-current bg-background/50", status.tone)}>
              {status.label}
            </Badge>
          )}
        </div>

        {projection && !projection.already_reached && projection.required_avg_score_20 && (
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
                    {formatScore(projection.required_avg_score_20 ?? "0")}/20
                  </span>{" "}
                  en lo que te falta para aprobar (28/40).
                </>
              ) : (
                <>Ya no es posible alcanzar 28/40 con lo que resta.</>
              )}
            </p>
          </div>
        )}

        {calculate?.required_recovery_score_40 && (
          <p className="text-sm text-muted-foreground">
            Nota mínima en el suple:{" "}
            <span className="font-semibold text-foreground tabular-nums">
              {formatScore(calculate.required_recovery_score_40)}/40
            </span>
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function PageLoader() {
  return (
    <div className="flex justify-center py-16">
      <Loader2 className="size-6 animate-spin text-muted-foreground" />
    </div>
  );
}
