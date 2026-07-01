import type { CourseState } from "@/features/student/api";

/** Visual + copy metadata for each course state, shared across malla and dashboard. */
export const COURSE_STATE_META: Record<
  CourseState,
  { label: string; card: string; dot: string }
> = {
  PASSED: {
    label: "Aprobada",
    card: "border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20",
    dot: "bg-emerald-500",
  },
  IN_PROGRESS: {
    label: "En curso",
    card: "border-sky-500/40 bg-sky-500/10 hover:bg-sky-500/20",
    dot: "bg-sky-500",
  },
  FAILED: {
    label: "Reprobada",
    card: "border-red-500/40 bg-red-500/10 hover:bg-red-500/20",
    dot: "bg-red-500",
  },
  ANNULLED: {
    label: "Anulada",
    card: "border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20",
    dot: "bg-amber-500",
  },
  NOT_TAKEN: {
    label: "Sin tomar",
    card: "border-border bg-card hover:bg-accent",
    dot: "bg-muted-foreground/40",
  },
};

export const COURSE_STATE_ORDER: CourseState[] = [
  "NOT_TAKEN",
  "IN_PROGRESS",
  "PASSED",
  "FAILED",
  "ANNULLED",
];
