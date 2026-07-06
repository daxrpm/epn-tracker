import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import type { ResourceListItem } from "../api";
import { CONTRIBUTION_LABELS, KIND_LABELS } from "../constants";
import { ResourceViewer } from "./ResourceViewer";

interface Props {
  resource: ResourceListItem | null;
  onClose: () => void;
}

export function ResourceViewerDialog({ resource, onClose }: Props) {
  return (
    <Dialog open={resource !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-4xl">
        {resource && (
          <>
            <DialogHeader>
              <DialogTitle>{resource.title}</DialogTitle>
              <DialogDescription>
                {resource.description || KIND_LABELS[resource.kind]}
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-wrap gap-1.5">
              {resource.contribution && (
                <Badge variant="outline">{CONTRIBUTION_LABELS[resource.contribution]}</Badge>
              )}
              {resource.tema && <Badge variant="outline">{resource.tema}</Badge>}
              {resource.academic_period_code && (
                <Badge variant="outline">{resource.academic_period_code}</Badge>
              )}
              {resource.professor_name && <Badge variant="outline">{resource.professor_name}</Badge>}
            </div>
            <ResourceViewer resource={resource} className="mt-1" />
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
