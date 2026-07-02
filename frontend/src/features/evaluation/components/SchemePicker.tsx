import { ArrowLeft, Check, Loader2, Plus, ThumbsUp } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ApiError } from "@/lib/api/types";

import { SCHEME_STATUS_META } from "../constants";
import { useSuggestSchemes, useVoteScheme } from "../hooks";
import { SchemeForm } from "./SchemeForm";

export function SchemePicker({
  courseId,
  courseName,
  onUse,
  busy,
}: {
  courseId: string;
  courseName: string;
  /** Called with the scheme the student wants to track their grades with. */
  onUse: (schemeId: string) => void;
  busy: boolean;
}) {
  const suggestQuery = useSuggestSchemes({ course_id: courseId });
  const voteScheme = useVoteScheme();
  const [creating, setCreating] = useState(false);

  const options = suggestQuery.data ?? [];

  async function vote(id: string) {
    try {
      const result = await voteScheme.mutateAsync(id);
      toast.success(
        result.status === "COMMUNITY_VERIFIED"
          ? "¡Esquema verificado por la comunidad!"
          : `Voto registrado (${result.approval_count}/3).`,
      );
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "No se pudo registrar el voto.");
    }
  }

  if (creating) {
    return (
      <div className="flex flex-col gap-4">
        <Button variant="ghost" size="sm" className="w-fit" onClick={() => setCreating(false)}>
          <ArrowLeft className="size-4" /> Volver a los esquemas
        </Button>
        <SchemeForm courseId={courseId} defaultTitle={courseName} onCreated={onUse} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold">Elige un esquema de evaluación</h2>
        <p className="text-sm text-muted-foreground">
          Selecciona cómo se pondera <span className="font-medium text-foreground">{courseName}</span>
          . Usa uno creado por la comunidad o crea el tuyo.
        </p>
      </div>

      {suggestQuery.isLoading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : options.length === 0 ? (
        <Card className="bg-card/65">
          <CardContent className="p-6 text-sm text-muted-foreground">
            Todavía no hay esquemas para esta materia. Crea el primero.
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {options.map((option) => {
            const meta = SCHEME_STATUS_META[option.status] ?? {
              label: option.status,
              badge: "outline" as const,
            };
            const isPending = option.status === "COMMUNITY_PENDING";
            return (
              <Card key={option.id} className="bg-card/65">
                <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-col gap-1.5">
                    <span className="text-sm font-medium">{option.title}</span>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={meta.badge}>{meta.label}</Badge>
                      {isPending && (
                        <span className="text-xs text-muted-foreground">
                          {option.approval_count}/3 aprobaciones
                        </span>
                      )}
                      {option.warning && (
                        <span className="text-xs text-amber-600 dark:text-amber-400">
                          {option.warning}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {isPending && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => void vote(option.id)}
                        disabled={voteScheme.isPending}
                      >
                        <ThumbsUp className="size-4" /> Aprobar
                      </Button>
                    )}
                    <Button size="sm" onClick={() => onUse(option.id)} disabled={busy}>
                      {busy ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                      Usar este
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Button variant="outline" className="w-fit" onClick={() => setCreating(true)}>
        <Plus className="size-4" /> Crear mi propio esquema
      </Button>
    </div>
  );
}
