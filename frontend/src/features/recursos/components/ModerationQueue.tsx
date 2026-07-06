import { Check, Eye, Loader2, Trash2, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ApiError } from "@/lib/api/types";

import type { ResourceListItem } from "../api";
import { CONTRIBUTION_LABELS } from "../constants";
import { useModerateResource, usePendingResources } from "../hooks";
import { ResourceViewerDialog } from "./ResourceViewerDialog";

export function ModerationQueue() {
  const pendingQuery = usePendingResources();
  const moderate = useModerateResource();
  const [viewing, setViewing] = useState<ResourceListItem | null>(null);

  async function act(id: string, action: "approve" | "reject" | "delete") {
    try {
      await moderate.mutateAsync({ id, action });
      toast.success(
        action === "approve" ? "Recurso aprobado." : action === "reject" ? "Recurso rechazado." : "Recurso eliminado.",
      );
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "No se pudo moderar.");
    }
  }

  if (pendingQuery.isLoading) {
    return (
      <div className="grid min-h-40 place-items-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const items = pendingQuery.data ?? [];
  if (items.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        No hay recursos pendientes de moderación.
      </p>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {items.map((resource) => (
          <Card key={resource.id} className="border-border/80 bg-card/65">
            <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{resource.title}</p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {resource.contribution && (
                    <Badge variant="outline">{CONTRIBUTION_LABELS[resource.contribution]}</Badge>
                  )}
                  {resource.tema && <Badge variant="outline">{resource.tema}</Badge>}
                  {resource.academic_period_code && (
                    <Badge variant="outline">{resource.academic_period_code}</Badge>
                  )}
                  {resource.professor_name && <Badge variant="outline">{resource.professor_name}</Badge>}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setViewing(resource)}>
                  <Eye className="size-4" /> Ver
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void act(resource.id, "approve")}
                  disabled={moderate.isPending}
                >
                  <Check className="size-4" /> Aprobar
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void act(resource.id, "reject")}
                  disabled={moderate.isPending}
                >
                  <X className="size-4" /> Rechazar
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => void act(resource.id, "delete")}
                  disabled={moderate.isPending}
                  title="Eliminar"
                >
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <ResourceViewerDialog resource={viewing} onClose={() => setViewing(null)} />
    </>
  );
}
