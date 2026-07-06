import {
  Eye,
  FileText,
  Image as ImageIcon,
  Link as LinkIcon,
  ThumbsUp,
  User,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

import type { ResourceKind, ResourceListItem } from "../api";
import { CONTRIBUTION_LABELS, formatBytes, KIND_LABELS, STATUS_META } from "../constants";

const KIND_ICON: Record<ResourceKind, typeof FileText> = {
  PDF: FileText,
  IMAGE: ImageIcon,
  MARKDOWN: FileText,
  TEXT: FileText,
  OFFICE: FileText,
  LINK: LinkIcon,
};

interface Props {
  resource: ResourceListItem;
  onView: (resource: ResourceListItem) => void;
  onVote?: (resource: ResourceListItem) => void;
  voting?: boolean;
}

export function ResourceCard({ resource, onView, onVote, voting }: Props) {
  const Icon = KIND_ICON[resource.kind];
  const status = STATUS_META[resource.status];
  const canVote = onVote && !resource.is_owner && resource.status === "COMMUNITY_PENDING";

  return (
    <Card className="flex h-full flex-col border-border/80 bg-card/65 transition-colors hover:border-primary/50">
      <CardContent className="flex h-full flex-col gap-3 p-4">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-muted">
            <Icon className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-sm font-semibold" title={resource.title}>
              {resource.title}
            </h3>
            <p className="truncate text-xs text-muted-foreground">
              {KIND_LABELS[resource.kind]}
              {resource.size_bytes ? ` · ${formatBytes(resource.size_bytes)}` : ""}
            </p>
          </div>
        </div>

        {resource.description && (
          <p className="line-clamp-2 text-xs text-muted-foreground">{resource.description}</p>
        )}

        <div className="flex flex-wrap gap-1.5">
          {status && <Badge variant={status.badge}>{status.label}</Badge>}
          {resource.contribution && (
            <Badge variant="outline">{CONTRIBUTION_LABELS[resource.contribution]}</Badge>
          )}
          {resource.tema && <Badge variant="outline">{resource.tema}</Badge>}
          {resource.academic_period_code && (
            <Badge variant="outline">{resource.academic_period_code}</Badge>
          )}
        </div>

        <div className="mt-auto flex items-center justify-between gap-2 pt-1">
          <span className="flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
            <User className="size-3.5 shrink-0" />
            <span className="truncate">{resource.professor_name ?? "Sin profesor"}</span>
          </span>
          <div className="flex shrink-0 items-center gap-1.5">
            {canVote && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onVote?.(resource)}
                disabled={voting}
                title="Aprobar recurso"
              >
                <ThumbsUp className="size-4" /> {resource.approval_count}
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => onView(resource)}>
              <Eye className="size-4" /> Ver
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
