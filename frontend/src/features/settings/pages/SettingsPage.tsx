import { AlertTriangle, Check, Loader2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCareers, useCurricula } from "@/features/curriculum/hooks";
import { useProfile, useUpdateProfile } from "@/features/student/hooks";
import { ApiError } from "@/lib/api/types";

export function SettingsPage() {
  const profileQuery = useProfile();
  const careersQuery = useCareers();
  const curriculaQuery = useCurricula();
  const updateProfile = useUpdateProfile();

  const currentCurriculumId = profileQuery.data?.current_curriculum_id ?? null;
  const currentCurriculum = (curriculaQuery.data ?? []).find(
    (c) => c.id === currentCurriculumId,
  );

  const [careerId, setCareerId] = useState("");
  const [curriculumId, setCurriculumId] = useState("");

  // Seed the selects from the current profile once the data resolves.
  useEffect(() => {
    if (currentCurriculum) {
      setCareerId(currentCurriculum.career_id);
      setCurriculumId(currentCurriculum.id);
    }
  }, [currentCurriculum]);

  const curriculaForCareer = useMemo(
    () => (curriculaQuery.data ?? []).filter((c) => c.career_id === careerId),
    [curriculaQuery.data, careerId],
  );

  const changed = curriculumId !== "" && curriculumId !== currentCurriculumId;

  async function save() {
    try {
      await updateProfile.mutateAsync({ current_curriculum_id: curriculumId });
      toast.success("Carrera y pénsum actualizados.");
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "No se pudo guardar.");
    }
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
          Ajustes
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">
          Tu cuenta
        </h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Administra tu carrera y pénsum. El resto de tu progreso se organiza a partir de esta
          selección.
        </p>
      </div>

      <Card className="rounded-2xl bg-card/65">
        <CardHeader>
          <CardTitle className="text-lg">Carrera y pénsum</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
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
          </div>

          {changed && (
            <div className="flex items-start gap-2.5 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-300">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <p>
                Cambiar de pénsum reorganiza tu malla. El estado de materias que no existan en el
                nuevo pénsum dejará de mostrarse.
              </p>
            </div>
          )}

          <div className="flex justify-end">
            <Button onClick={() => void save()} disabled={!changed || updateProfile.isPending}>
              {updateProfile.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Check className="size-4" />
              )}
              Guardar cambios
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
