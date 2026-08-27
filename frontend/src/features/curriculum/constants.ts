import type { CourseState } from "@/features/student/api";

import type { CurriculumCourse, OrganizationUnit } from "./api";

/** Visual + copy metadata for each organization unit, shared across malla and onboarding. */
export const UNIT_META: Record<OrganizationUnit, { label: string; stripe: string }> = {
  BASIC: { label: "Unidad básica", stripe: "bg-state-annulled" },
  PROFESSIONAL: { label: "Unidad profesional", stripe: "bg-primary" },
  CAPSTONE: { label: "Integración curricular", stripe: "bg-state-passed" },
  OTHER: { label: "Otra", stripe: "bg-muted-foreground" },
};

/**
 * Hours for a course. The API sends 0 when the malla did not declare them, which is not the
 * same as "unknown" — returning null lets the caller say "—" instead of a confident zero.
 */
export function courseHours(course: CurriculumCourse): number | null {
  return course.hours && course.hours > 0 ? course.hours : null;
}

/**
 * Academic state: label, badge variant, and the marks that carry the state without relying on
 * colour alone (a dot, and the left edge of a card).
 */
export const COURSE_STATE_META: Record<
  CourseState,
  {
    label: string;
    badge: "passed" | "progress" | "failed" | "annulled" | "outline";
    dot: string;
    edge: string;
    card: string;
  }
> = {
  PASSED: {
    label: "Aprobada",
    badge: "passed",
    dot: "bg-state-passed",
    edge: "border-l-state-passed",
    card: "bg-state-passed-soft/60 hover:bg-state-passed-soft",
  },
  IN_PROGRESS: {
    label: "En curso",
    badge: "progress",
    dot: "bg-state-progress",
    edge: "border-l-state-progress",
    card: "bg-state-progress-soft/60 hover:bg-state-progress-soft",
  },
  FAILED: {
    label: "Reprobada",
    badge: "failed",
    dot: "bg-state-failed",
    edge: "border-l-state-failed",
    card: "bg-state-failed-soft/60 hover:bg-state-failed-soft",
  },
  ANNULLED: {
    label: "Anulada",
    badge: "annulled",
    dot: "bg-state-annulled",
    edge: "border-l-state-annulled",
    card: "bg-state-annulled-soft/60 hover:bg-state-annulled-soft",
  },
  NOT_TAKEN: {
    label: "Sin tomar",
    badge: "outline",
    dot: "bg-muted-foreground/40",
    edge: "border-l-border",
    card: "bg-card hover:bg-muted",
  },
};

export const COURSE_STATE_ORDER: CourseState[] = [
  "NOT_TAKEN",
  "IN_PROGRESS",
  "PASSED",
  "FAILED",
  "ANNULLED",
];
