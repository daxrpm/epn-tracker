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
  { label: string; badge: "default" | "secondary" | "outline" | "passed" | "progress" }
> = {
  ADMIN_VERIFIED: { label: "Verificado por un admin", badge: "passed" },
  COMMUNITY_VERIFIED: { label: "Verificado por la comunidad", badge: "passed" },
  COMMUNITY_PENDING: { label: "Pendiente de aprobación", badge: "secondary" },
  PERSONAL: { label: "Personal", badge: "outline" },
  ARCHIVED: { label: "Archivado", badge: "outline" },
};

/** Final academic status → label + the semantic badge variant from the design system. */
export const FINAL_STATUS_META: Record<
  CourseFinalStatus,
  { label: string; badge: "passed" | "annulled" | "failed" | "outline" }
> = {
  APPROVED: { label: "Aprobado", badge: "passed" },
  RECOVERY_ELIGIBLE: { label: "Vas a recuperación", badge: "annulled" },
  FAILED_DIRECT: { label: "Reprobado", badge: "failed" },
  IN_PROGRESS: { label: "En progreso", badge: "outline" },
};
