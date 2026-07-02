import { ArrowLeft, ArrowRight, Check, Loader2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CurriculumGrid } from "@/features/curriculum/components/CurriculumGrid";
import { COURSE_STATE_META } from "@/features/curriculum/constants";
import { useCareers, useCurricula, useCurriculumCourses } from "@/features/curriculum/hooks";
import { coursesWithUnmetPrereqs } from "@/features/curriculum/prerequisites";
import type { CourseState, EnglishLevel } from "@/features/student/api";
import { ENGLISH_LEVELS } from "@/features/student/constants";
import { useBulkCourseStates, useUpdateProfile } from "@/features/student/hooks";
import { ApiError } from "@/lib/api/types";
import { cn } from "@/lib/utils";

const STEPS = ["Carrera y pénsum", "Tus materias", "Nivel de inglés"];

/** Click a course to cycle: sin tomar → aprobada → cursando → sin tomar. */
const CYCLE: Record<string, CourseState> = {
  NOT_TAKEN: "PASSED",
  PASSED: "IN_PROGRESS",
  IN_PROGRESS: "NOT_TAKEN",
  FAILED: "NOT_TAKEN",
  ANNULLED: "NOT_TAKEN",
};

export function OnboardingPage() {
  const navigate = useNavigate();

  const careersQuery = useCareers();
  const curriculaQuery = useCurricula();
  const updateProfile = useUpdateProfile();
  const bulkStates = useBulkCourseStates();

  const [step, setStep] = useState(0);
  const [careerId, setCareerId] = useState("");
  const [curriculumId, setCurriculumId] = useState("");
  const [courseStates, setCourseStates] = useState<Record<string, CourseState>>({});
  const [englishLevel, setEnglishLevel] = useState<EnglishLevel>("NONE");

  const coursesQuery = useCurriculumCourses(step >= 1 ? curriculumId : null);

  const curriculaForCareer = useMemo(
    () => (curriculaQuery.data ?? []).filter((c) => c.career_id === careerId),
    [curriculaQuery.data, careerId],
  );

  // When a career has a single pénsum, select it automatically so the student
  // isn't blocked on a one-option dropdown that's easy to leave untouched.
  useEffect(() => {
    if (curriculaForCareer.length === 1 && curriculumId !== curriculaForCareer[0].id) {
      setCurriculumId(curriculaForCareer[0].id);
    }
  }, [curriculaForCareer, curriculumId]);

  const stateByCourse = useMemo(
    () => new Map<string, CourseState>(Object.entries(courseStates)),
    [courseStates],
  );

  const prereqWarnings = useMemo(
    () => coursesWithUnmetPrereqs(coursesQuery.data ?? [], stateByCourse),
    [coursesQuery.data, stateByCourse],
  );

  const submitting = updateProfile.isPending || bulkStates.isPending;

  function cycleCourse(id: string) {
    setCourseStates((prev) => {
      const next = { ...prev };
      const target = CYCLE[prev[id] ?? "NOT_TAKEN"];
      if (target === "NOT_TAKEN") delete next[id];
      else next[id] = target;
      return next;
    });
  }

  async function finish() {
    try {
      const items = Object.entries(courseStates).map(([curriculum_course_id, state]) => ({
        curriculum_course_id,
        state,
      }));
      if (items.length > 0) {
        await bulkStates.mutateAsync(items);
      }
      await updateProfile.mutateAsync({
        current_curriculum_id: curriculumId,
        english_level: englishLevel,
      });
      toast.success("Perfil académico configurado.");
      navigate("/app/dashboard");
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "No se pudo guardar tu perfil.");
    }
  }

  const canNext = step === 0 ? Boolean(curriculumId) : true;

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-8">
      <div>
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
          Configuración inicial
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">
          Configura tu malla
        </h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Tres pasos para tener tu avance académico al día.
        </p>
      </div>

      <Stepper current={step} />

      <Card className="rounded-2xl bg-card/65">
        <CardContent className="p-6">
          {step === 0 && (
            <div className="flex flex-col gap-5">
              <div className="flex flex-col gap-1.5">
                <Label>Carrera</Label>
                <Select
                  value={careerId}
                  onValueChange={(value) => {
                    setCareerId(value);
                    setCurriculumId("");
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue
                      placeholder={careersQuery.isLoading ? "Cargando..." : "Selecciona tu carrera"}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {(careersQuery.data ?? []).map((career) => (
                      <SelectItem key={career.id} value={career.id}>
                        {career.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label>Pénsum</Label>
                <Select value={curriculumId} onValueChange={setCurriculumId} disabled={!careerId}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecciona tu pénsum" />
                  </SelectTrigger>
                  <SelectContent>
                    {curriculaForCareer.map((curriculum) => (
                      <SelectItem key={curriculum.id} value={curriculum.id}>
                        {curriculum.name} ({curriculum.pensum_year})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {careerId && curriculaForCareer.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    No hay pénsums disponibles para esta carrera todavía.
                  </p>
                )}
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <p className="text-sm text-muted-foreground">
                  Toca una materia para marcarla. Primero las que{" "}
                  <span className="font-medium text-foreground">ya aprobaste</span>, luego las que
                  estás <span className="font-medium text-foreground">cursando</span> ahora. Puedes
                  ajustarlo después en tu malla.
                </p>
                <CycleLegend />
              </div>
              {coursesQuery.isLoading && (
                <div className="flex justify-center py-8">
                  <Loader2 className="size-5 animate-spin text-muted-foreground" />
                </div>
              )}
              {coursesQuery.data && coursesQuery.data.length > 0 && (
                <div className="overflow-hidden rounded-2xl border border-border/80 bg-card/40">
                  <CurriculumGrid
                    courses={coursesQuery.data}
                    stateByCourse={stateByCourse}
                    onSelect={(course) => cycleCourse(course.id)}
                    prereqWarnings={prereqWarnings}
                    layout="wrap"
                  />
                </div>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="flex flex-col gap-5">
              <p className="text-sm text-muted-foreground">
                Indica el último nivel de inglés que aprobaste (o tu suficiencia).
              </p>
              <div className="flex flex-col gap-1.5">
                <Label>Nivel de inglés</Label>
                <Select
                  value={englishLevel}
                  onValueChange={(value) => setEnglishLevel(value as EnglishLevel)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ENGLISH_LEVELS.map((level) => (
                      <SelectItem key={level.value} value={level.value}>
                        {level.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0 || submitting}
        >
          <ArrowLeft className="size-4" />
          Atrás
        </Button>
        {step < STEPS.length - 1 ? (
          <Button onClick={() => setStep((s) => s + 1)} disabled={!canNext}>
            Siguiente
            <ArrowRight className="size-4" />
          </Button>
        ) : (
          <Button onClick={() => void finish()} disabled={submitting}>
            {submitting ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
            Finalizar
          </Button>
        )}
      </div>
    </div>
  );
}

function CycleLegend() {
  return (
    <div className="flex flex-wrap gap-1.5">
      {(["PASSED", "IN_PROGRESS", "NOT_TAKEN"] as const).map((state) => {
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

function Stepper({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-2">
      {STEPS.map((label, index) => (
        <div key={label} className="flex flex-1 flex-col gap-2">
          <div
            className={cn(
              "h-1 rounded-full transition-colors",
              index <= current ? "bg-primary" : "bg-muted",
            )}
          />
          <span
            className={cn(
              "text-xs",
              index === current ? "font-medium text-foreground" : "text-muted-foreground",
            )}
          >
            {index + 1}. {label}
          </span>
        </div>
      ))}
    </div>
  );
}
