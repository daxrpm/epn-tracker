import type { EnglishLevel, GradRequirementState, GradRequirementType } from "./api";

export const ENGLISH_LEVELS: { value: EnglishLevel; label: string }[] = [
  { value: "NONE", label: "Sin nivel / no iniciado" },
  { value: "BASIC_1", label: "Básico 1" },
  { value: "BASIC_2", label: "Básico 2" },
  { value: "INTERMEDIATE_1", label: "Intermedio 1" },
  { value: "ADVANCED_1", label: "Avanzado 1" },
  { value: "ADVANCED_2", label: "Avanzado 2" },
  { value: "SUFFICIENCY_B1", label: "Suficiencia B1" },
];

export const GRAD_REQ_STATE_META: Record<
  GradRequirementState,
  { label: string; badge: "default" | "secondary" | "destructive" | "outline" }
> = {
  PENDING: { label: "Pendiente", badge: "destructive" },
  IN_PROGRESS: { label: "En curso", badge: "secondary" },
  COMPLETED: { label: "Completado", badge: "default" },
  NOT_APPLICABLE: { label: "No aplica", badge: "outline" },
};

export const GRAD_REQ_STATE_ORDER: GradRequirementState[] = [
  "PENDING",
  "IN_PROGRESS",
  "COMPLETED",
  "NOT_APPLICABLE",
];

export const GRAD_REQ_TYPE_LABELS: Record<GradRequirementType, string> = {
  ENGLISH: "Inglés",
  SPORTS: "Deportes",
  CLUBS: "Clubes",
  SOCIAL: "Vinculación con la sociedad",
  ENTREPRENEURSHIP: "Emprendimiento",
  ENVIRONMENT: "Ambiente",
  PROJECTS: "Proyectos",
  OTHER: "Otros",
};
