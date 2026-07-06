import type { Contribution, ResourceKind, ResourceStatus } from "./api";

/** The two EPN grading periods are shown to students as "bimestres". */
export const CONTRIBUTION_LABELS: Record<Contribution, string> = {
  APORTE_1: "Primer bimestre",
  APORTE_2: "Segundo bimestre",
};

export const KIND_LABELS: Record<ResourceKind, string> = {
  PDF: "PDF",
  IMAGE: "Imagen",
  MARKDOWN: "Markdown",
  TEXT: "Texto",
  OFFICE: "Documento",
  LINK: "Enlace",
};

export const STATUS_META: Record<
  ResourceStatus,
  { label: string; badge: "default" | "secondary" | "destructive" | "outline" }
> = {
  ADMIN_VERIFIED: { label: "Verificado por admin", badge: "default" },
  COMMUNITY_VERIFIED: { label: "Verificado por la comunidad", badge: "default" },
  COMMUNITY_PENDING: { label: "Pendiente de aprobación", badge: "secondary" },
  PERSONAL: { label: "Personal", badge: "outline" },
  REJECTED: { label: "Rechazado", badge: "destructive" },
  ARCHIVED: { label: "Archivado", badge: "outline" },
};

export function formatBytes(bytes: number | null): string {
  if (!bytes) return "";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(value < 10 && unit > 0 ? 1 : 0)} ${units[unit]}`;
}
