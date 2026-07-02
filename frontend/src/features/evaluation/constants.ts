import type { Contribution } from "./api";
import type { CourseFinalStatus } from "./gradebook";

/** The two EPN grading periods are shown to students as "bimestres". */
export const CONTRIBUTION_LABELS: Record<Contribution, string> = {
  APORTE_1: "Primer bimestre",
  APORTE_2: "Segundo bimestre",
};

export const CONTRIBUTION_ORDER: Contribution[] = ["APORTE_1", "APORTE_2"];

/** Scheme status → human label + badge variant. */
export const SCHEME_STATUS_META: Record<
  string,
  { label: string; badge: "default" | "secondary" | "destructive" | "outline" }
> = {
  ADMIN_VERIFIED: { label: "Verificado por admin", badge: "default" },
  COMMUNITY_VERIFIED: { label: "Verificado por la comunidad", badge: "default" },
  COMMUNITY_PENDING: { label: "Pendiente de aprobación", badge: "secondary" },
  PERSONAL: { label: "Personal", badge: "outline" },
  ARCHIVED: { label: "Archivado", badge: "outline" },
};

export const FINAL_STATUS_META: Record<
  CourseFinalStatus,
  { label: string; tone: string }
> = {
  APPROVED: { label: "Aprobado", tone: "text-emerald-600 dark:text-emerald-400" },
  RECOVERY_ELIGIBLE: { label: "Va a recuperación", tone: "text-amber-600 dark:text-amber-400" },
  FAILED_DIRECT: { label: "Reprobado", tone: "text-destructive" },
  IN_PROGRESS: { label: "En progreso", tone: "text-muted-foreground" },
};
