import { GraduationCap, Languages, ListChecks, Loader2 } from "lucide-react";
import { useMemo } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  EnglishLevel,
  GradRequirementRecord,
  GradRequirementState,
  GradRequirementType,
} from "@/features/student/api";
import {
  ENGLISH_LEVELS,
  GRAD_REQ_STATE_META,
  GRAD_REQ_STATE_ORDER,
  GRAD_REQ_TYPE_LABELS,
} from "@/features/student/constants";
import {
  useGradRequirements,
  useProfile,
  useUpdateGradRequirement,
  useUpdateProfile,
} from "@/features/student/hooks";
import { ApiError } from "@/lib/api/types";

export function RequirementsPage() {
  const requirementsQuery = useGradRequirements();
  const updateRequirement = useUpdateGradRequirement();
  const profileQuery = useProfile();
  const updateProfile = useUpdateProfile();

  const requirements = requirementsQuery.data ?? [];

  const completed = requirements.filter((r) => r.state === "COMPLETED").length;
  const applicable = requirements.filter((r) => r.state !== "NOT_APPLICABLE").length;
  const percent = applicable === 0 ? 0 : Math.round((completed / applicable) * 100);

  const grouped = useMemo(() => {
    const map = new Map<GradRequirementType, GradRequirementRecord[]>();
    for (const requirement of requirements) {
      const list = map.get(requirement.requirement_type) ?? [];
      list.push(requirement);
      map.set(requirement.requirement_type, list);
    }
    return [...map.entries()];
  }, [requirements]);

  async function changeState(stateId: string, state: GradRequirementState) {
    try {
      await updateRequirement.mutateAsync({ stateId, state });
      toast.success("Requisito actualizado.");
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "No se pudo actualizar.");
    }
  }

  async function changeEnglish(level: EnglishLevel) {
    try {
      await updateProfile.mutateAsync({ english_level: level });
      toast.success("Nivel de inglés actualizado.");
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "No se pudo actualizar.");
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
          Progreso académico
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">
          Requisitos de graduación
        </h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Actualiza el estado de cada requisito no crediticio para tu graduación.
        </p>
      </div>

      {requirementsQuery.isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : requirements.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
            <ListChecks className="size-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              No hay requisitos de graduación registrados para tu perfil todavía.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card className="rounded-2xl bg-card/65">
            <CardContent className="flex flex-col gap-3 p-5">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-sm font-medium">
                  <GraduationCap className="size-4" /> Avance de requisitos
                </span>
                <span className="text-sm tabular-nums text-muted-foreground">
                  {completed}/{applicable} completados
                </span>
              </div>
              <Progress value={percent} />
            </CardContent>
          </Card>

          <Card className="rounded-2xl bg-card/65">
            <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-col gap-1">
                <span className="flex items-center gap-2 text-sm font-medium">
                  <Languages className="size-4" /> Nivel de inglés
                </span>
                <span className="text-xs text-muted-foreground">
                  Registra tu último nivel aprobado o tu suficiencia.
                </span>
              </div>
              <Select
                value={profileQuery.data?.english_level ?? "NONE"}
                onValueChange={(value) => void changeEnglish(value as EnglishLevel)}
                disabled={updateProfile.isPending || profileQuery.isLoading}
              >
                <SelectTrigger className="w-full sm:w-56">
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
            </CardContent>
          </Card>

          {grouped.map(([type, items]) => (
            <section key={type} className="flex flex-col gap-3">
              <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                {GRAD_REQ_TYPE_LABELS[type]}
              </h2>
              {items.map((requirement) => {
                const meta = GRAD_REQ_STATE_META[requirement.state];
                return (
                  <Card key={requirement.id} className="rounded-xl bg-card/65">
                    <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex flex-col gap-1">
                        <span className="text-sm font-medium">{requirement.name}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">{requirement.code}</span>
                          <Badge variant={meta.badge} className="w-fit">
                            {meta.label}
                          </Badge>
                        </div>
                      </div>
                      <Select
                        value={requirement.state}
                        onValueChange={(value) =>
                          void changeState(requirement.id, value as GradRequirementState)
                        }
                        disabled={updateRequirement.isPending}
                      >
                        <SelectTrigger className="w-full sm:w-56">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {GRAD_REQ_STATE_ORDER.map((state) => (
                            <SelectItem key={state} value={state}>
                              {GRAD_REQ_STATE_META[state].label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </CardContent>
                  </Card>
                );
              })}
            </section>
          ))}
        </>
      )}
    </div>
  );
}
