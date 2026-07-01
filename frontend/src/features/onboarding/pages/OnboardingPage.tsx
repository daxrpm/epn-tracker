import { ArrowLeft, ArrowRight, Check, Loader2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TextGenerateEffect } from "@/components/ui/text-generate-effect";
import { useCareers, useCurricula, useCurriculumCourses } from "@/features/curriculum/hooks";
import type { CourseState, EnglishLevel } from "@/features/student/api";
import { ENGLISH_LEVELS } from "@/features/student/constants";
import { useBulkCourseStates, useUpdateProfile } from "@/features/student/hooks";
import { ApiError } from "@/lib/api/types";
import { cn } from "@/lib/utils";

const STEPS = ["Carrera y pénsum", "Materias aprobadas", "Nivel de inglés"];

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

  const terms = useMemo(() => {
    const set = new Set<number>();
    (coursesQuery.data ?? []).forEach((c) => set.add(c.reference_term));
    return [...set].sort((a, b) => a - b);
  }, [coursesQuery.data]);

  const submitting = updateProfile.isPending || bulkStates.isPending;

  function setCourse(id: string, state: CourseState) {
    setCourseStates((prev) => {
      const next = { ...prev };
      if (state === "NOT_TAKEN") delete next[id];
      else next[id] = state;
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
    <div className="mx-auto flex max-w-3xl flex-col gap-8">
      <div>
        <TextGenerateEffect
          words="Configura tu malla"
          className="[&_div]:mt-0 [&_div>div]:text-3xl"
        />
        <p className="mt-2 text-sm text-muted-foreground">
          Tres pasos para tener tu avance académico al día.
        </p>
      </div>

      <Stepper current={step} />

      <Card>
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
                      placeholder={
                        careersQuery.isLoading ? "Cargando..." : "Selecciona tu carrera"
                      }
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
                <Select
                  value={curriculumId}
                  onValueChange={setCurriculumId}
                  disabled={!careerId}
                >
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
              <p className="text-sm text-muted-foreground">
                Marca las materias que ya aprobaste o que estás cursando. Puedes ajustarlo
                después en tu malla.
              </p>
              {coursesQuery.isLoading && (
                <div className="flex justify-center py-8">
                  <Loader2 className="size-5 animate-spin text-muted-foreground" />
                </div>
              )}
              {coursesQuery.data && terms.length > 0 && (
                <Tabs defaultValue={String(terms[0])}>
                  <TabsList className="flex-wrap">
                    {terms.map((term) => (
                      <TabsTrigger key={term} value={String(term)}>
                        Sem {term}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                  {terms.map((term) => (
                    <TabsContent key={term} value={String(term)} className="mt-4">
                      <div className="flex flex-col divide-y divide-border">
                        {(coursesQuery.data ?? [])
                          .filter((course) => course.reference_term === term)
                          .map((course) => {
                            const state = courseStates[course.id] ?? "NOT_TAKEN";
                            return (
                              <div
                                key={course.id}
                                className="flex items-center justify-between gap-3 py-2.5"
                              >
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-medium">{course.name}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {course.code} · {Number(course.credits)} cr
                                  </p>
                                </div>
                                <div className="flex shrink-0 items-center gap-4">
                                  <label className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <Checkbox
                                      checked={state === "PASSED"}
                                      onCheckedChange={(checked) =>
                                        setCourse(course.id, checked ? "PASSED" : "NOT_TAKEN")
                                      }
                                    />
                                    Aprobada
                                  </label>
                                  <label className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <Checkbox
                                      checked={state === "IN_PROGRESS"}
                                      onCheckedChange={(checked) =>
                                        setCourse(
                                          course.id,
                                          checked ? "IN_PROGRESS" : "NOT_TAKEN",
                                        )
                                      }
                                    />
                                    Cursando
                                  </label>
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    </TabsContent>
                  ))}
                </Tabs>
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
            {submitting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Check className="size-4" />
            )}
            Finalizar
          </Button>
        )}
      </div>
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
