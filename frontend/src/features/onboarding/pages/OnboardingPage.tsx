import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Loader2,
  PlayCircle,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

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
import { useCareers, useCurricula, useCurriculumCourses } from "@/features/curriculum/hooks";
import { coursesWithUnmetPrereqs } from "@/features/curriculum/prerequisites";
import type { CourseState, EnglishLevel } from "@/features/student/api";
import { ENGLISH_LEVELS } from "@/features/student/constants";
import { useBulkCourseStates, useUpdateProfile } from "@/features/student/hooks";
import { ApiError } from "@/lib/api/types";
import { cn } from "@/lib/utils";

const STEPS = ["Carrera y pénsum", "Tus materias", "Nivel de inglés"];
const MAX_IN_PROGRESS_CREDITS = 15;

/** The two states a student can paint onto a course during onboarding. */
type PickMode = "PASSED" | "IN_PROGRESS";

const PICK_MODES: { value: PickMode; label: string; icon: typeof CheckCircle2; classes: string }[] = [
  { value: "PASSED", label: "Aprobada", icon: CheckCircle2, classes: "bg-emerald-500 text-white" },
  { value: "IN_PROGRESS", label: "Cursando", icon: PlayCircle, classes: "bg-sky-500 text-white" },
];

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
  const [pickMode, setPickMode] = useState<PickMode>("PASSED");
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
  const inProgressCredits = useMemo(
    () =>
      (coursesQuery.data ?? []).reduce(
        (total, course) =>
          courseStates[course.id] === "IN_PROGRESS" ? total + Number(course.credits) : total,
        0,
      ),
    [courseStates, coursesQuery.data],
  );

  const submitting = updateProfile.isPending || bulkStates.isPending;

  function validatedStates(next: Record<string, CourseState>): boolean {
    const nextMap = new Map<string, CourseState>(Object.entries(next));
    const invalid = coursesWithUnmetPrereqs(coursesQuery.data ?? [], nextMap);
    if (invalid.size > 0) {
      toast.error("Primero debes aprobar los prerrequisitos de las materias seleccionadas.");
      return false;
    }
    const credits = (coursesQuery.data ?? []).reduce(
      (total, course) =>
        next[course.id] === "IN_PROGRESS" ? total + Number(course.credits) : total,
      0,
    );
    if (credits > MAX_IN_PROGRESS_CREDITS) {
      toast.error(`Puedes marcar como cursando hasta ${MAX_IN_PROGRESS_CREDITS} créditos.`);
      return false;
    }
    return true;
  }

  /** Tap a course to paint it with the active mode; invalid prerequisite chains are rejected. */
  function applyMode(id: string) {
    const next = { ...courseStates };
    if (courseStates[id] === pickMode) delete next[id];
    else next[id] = pickMode;
    if (validatedStates(next)) setCourseStates(next);
  }

  /** Paint (or clear, if all already match) every course of a semester with the active mode. */
  function applyModeToTerm(courseIds: string[]) {
    const next = { ...courseStates };
    const allMatch = courseIds.every((id) => courseStates[id] === pickMode);
    for (const id of courseIds) {
      if (allMatch) delete next[id];
      else next[id] = pickMode;
    }
    if (validatedStates(next)) setCourseStates(next);
  }

  async function finish() {
    try {
      const items = Object.entries(courseStates).map(([curriculum_course_id, state]) => ({
        curriculum_course_id,
        state,
      }));
      await updateProfile.mutateAsync({
        current_curriculum_id: curriculumId,
        english_level: englishLevel,
      });
      if (items.length > 0) {
        await bulkStates.mutateAsync(items);
      }
      const finishedCareer =
        (coursesQuery.data?.length ?? 0) > 0 &&
        coursesQuery.data?.every((course) => courseStates[course.id] === "PASSED");
      toast.success(
        finishedCareer
          ? "¡Felicidades! Completaste todas las materias de tu carrera."
          : "Perfil académico configurado.",
      );
      navigate("/app/dashboard");
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "No se pudo guardar tu perfil.");
    }
  }

  const canNext =
    step === 0
      ? Boolean(curriculumId)
      : step === 1
        ? prereqWarnings.size === 0 && inProgressCredits <= MAX_IN_PROGRESS_CREDITS
        : true;

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
              <div className="flex flex-col gap-3">
                <p className="text-sm text-muted-foreground">
                  Elige qué estás marcando y toca las materias correspondientes. Cambia de modo
                  cuando termines con un grupo. Puedes ajustarlo después en tu malla.
                </p>
                <ModePicker mode={pickMode} onChange={setPickMode} />
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/70 bg-muted/30 px-3 py-2 text-sm">
                  <span className="text-muted-foreground">Créditos cursando</span>
                  <span
                    className={cn(
                      "font-semibold tabular-nums",
                      inProgressCredits > MAX_IN_PROGRESS_CREDITS && "text-destructive",
                    )}
                  >
                    {inProgressCredits} / {MAX_IN_PROGRESS_CREDITS}
                  </span>
                </div>
                {prereqWarnings.size > 0 && (
                  <p className="flex items-start gap-2 text-sm text-destructive">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                    Corrige las materias con prerrequisitos pendientes antes de continuar.
                  </p>
                )}
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
                    onSelect={(course) => applyMode(course.id)}
                    prereqWarnings={prereqWarnings}
                    layout="wrap"
                    renderTermExtra={(_term, courseIds) => {
                      const activeMode = PICK_MODES.find((m) => m.value === pickMode)!;
                      const allMarked = courseIds.every((id) => courseStates[id] === pickMode);
                      return (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 gap-1.5 px-2.5 text-xs"
                          onClick={() => applyModeToTerm(courseIds)}
                        >
                          <activeMode.icon className="size-3.5" />
                          {allMarked ? `Quitar ${activeMode.label.toLowerCase()}` : `Marcar semestre`}
                        </Button>
                      );
                    }}
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

/** Segmented "brush" control: choose what tapping a course will mark it as. */
function ModePicker({ mode, onChange }: { mode: PickMode; onChange: (mode: PickMode) => void }) {
  return (
    <div className="inline-flex w-fit gap-1 rounded-lg border border-border bg-muted/40 p-1">
      {PICK_MODES.map((option) => {
        const active = option.value === mode;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            aria-pressed={active}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              active ? cn(option.classes, "shadow-sm") : "text-muted-foreground hover:text-foreground",
            )}
          >
            <option.icon className="size-4" />
            Marcando: {option.label}
          </button>
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
