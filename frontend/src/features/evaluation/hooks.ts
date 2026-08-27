import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { ApiError } from "@/lib/api/types";
import { studentKeys } from "@/features/student/hooks";

import {
  copySchemeToPersonal,
  createScheme,
  getScheme,
  type Contribution,
  type SchemeCreateInput,
  type SchemeSuggestParams,
  suggestSchemes,
  voteScheme,
} from "./api";
import {
  addItem,
  calculate,
  createEnrollment,
  deleteEnrollment,
  deleteItem,
  type EnrollmentCreateInput,
  type GradeComponentMode,
  getGradebook,
  listEnrollments,
  patchComponent,
  patchItem,
  projection,
  setBimestreOverride,
  setRecoveryScore,
} from "./gradebook";

export const evaluationKeys = {
  suggest: (params: SchemeSuggestParams) => ["evaluation", "suggest", params] as const,
  scheme: (id: string) => ["evaluation", "scheme", id] as const,
  enrollments: ["evaluation", "enrollments"] as const,
  gradebook: (enrollmentId: string) => ["evaluation", "gradebook", enrollmentId] as const,
  calculate: (enrollmentId: string) => ["evaluation", "calculate", enrollmentId] as const,
  projection: (enrollmentId: string) => ["evaluation", "projection", enrollmentId] as const,
};

/**
 * Every gradebook write reports its own failure.
 *
 * These mutations were fired with `.mutate()` and no `onError`, so a rejected save left the
 * typed value on screen until the next refetch quietly reverted it — the worst possible outcome
 * in an app whose entire content is the user's grades.
 */
function errorToast(fallback: string) {
  return (error: unknown) => {
    toast.error(error instanceof ApiError ? error.message : fallback);
  };
}

// --- Schemes --------------------------------------------------------------------------------------

export function useSuggestSchemes(params: SchemeSuggestParams, enabled = true) {
  return useQuery({
    queryKey: evaluationKeys.suggest(params),
    queryFn: () => suggestSchemes(params),
    enabled: enabled && Boolean(params.course_id),
  });
}

export function useScheme(id: string | null) {
  return useQuery({
    queryKey: evaluationKeys.scheme(id ?? ""),
    queryFn: () => getScheme(id as string),
    enabled: Boolean(id),
  });
}

export function useCreateScheme() {
  return useMutation({
    mutationFn: (input: SchemeCreateInput) => createScheme(input),
    onError: errorToast("No se pudo crear el curso."),
  });
}

export function useVoteScheme() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => voteScheme(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["evaluation", "suggest"] });
    },
    onError: errorToast("No se pudo registrar el voto."),
  });
}

export function useCopyScheme() {
  return useMutation({
    mutationFn: (id: string) => copySchemeToPersonal(id),
    onError: errorToast("No se pudo copiar el curso."),
  });
}

// --- Enrollments + gradebook ----------------------------------------------------------------------

export function useEnrollments() {
  return useQuery({ queryKey: evaluationKeys.enrollments, queryFn: listEnrollments });
}

export function useCreateEnrollment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: EnrollmentCreateInput) => createEnrollment(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: evaluationKeys.enrollments });
    },
    onError: errorToast("No se pudo iniciar la materia."),
  });
}

export function useDeleteEnrollment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (enrollmentId: string) => deleteEnrollment(enrollmentId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: evaluationKeys.enrollments });
    },
    onError: errorToast("No se pudo cambiar de curso."),
  });
}

export function useGradebook(enrollmentId: string | null) {
  return useQuery({
    queryKey: evaluationKeys.gradebook(enrollmentId ?? ""),
    queryFn: () => getGradebook(enrollmentId as string),
    enabled: Boolean(enrollmentId),
  });
}

export function useCalculate(enrollmentId: string | null) {
  return useQuery({
    queryKey: evaluationKeys.calculate(enrollmentId ?? ""),
    queryFn: () => calculate(enrollmentId as string),
    enabled: Boolean(enrollmentId),
  });
}

export function useProjection(enrollmentId: string | null) {
  return useQuery({
    queryKey: evaluationKeys.projection(enrollmentId ?? ""),
    queryFn: () => projection(enrollmentId as string),
    enabled: Boolean(enrollmentId),
  });
}

/**
 * Invalidate the gradebook and everything derived from it.
 *
 * Course states are included because a finished gradebook now updates the malla server-side:
 * without this the curriculum map would keep showing the old state until a reload.
 */
function useGradebookInvalidator(enrollmentId: string) {
  const queryClient = useQueryClient();
  return () => {
    for (const key of [
      evaluationKeys.gradebook(enrollmentId),
      evaluationKeys.calculate(enrollmentId),
      evaluationKeys.projection(enrollmentId),
      evaluationKeys.enrollments,
      studentKeys.courseStates,
    ]) {
      void queryClient.invalidateQueries({ queryKey: key });
    }
  };
}

export function usePatchComponent(enrollmentId: string) {
  const invalidate = useGradebookInvalidator(enrollmentId);
  return useMutation({
    mutationFn: ({
      componentStateId,
      mode,
      direct_score,
      direct_score_scale,
    }: {
      componentStateId: string;
      mode?: GradeComponentMode;
      direct_score?: string | null;
      direct_score_scale?: string | null;
    }) => patchComponent(componentStateId, { mode, direct_score, direct_score_scale }),
    onSuccess: invalidate,
    onError: errorToast("No se pudo guardar la nota."),
  });
}

export function useAddItem(enrollmentId: string) {
  const invalidate = useGradebookInvalidator(enrollmentId);
  return useMutation({
    mutationFn: ({
      componentStateId,
      name,
      score,
      score_scale,
      internal_weight_percent,
    }: {
      componentStateId: string;
      name: string;
      score?: string | null;
      score_scale?: string;
      internal_weight_percent?: string | null;
    }) => addItem(componentStateId, { name, score, score_scale, internal_weight_percent }),
    onSuccess: invalidate,
    onError: errorToast("No se pudo agregar el insumo."),
  });
}

export function usePatchItem(enrollmentId: string) {
  const invalidate = useGradebookInvalidator(enrollmentId);
  return useMutation({
    mutationFn: ({
      itemId,
      ...payload
    }: {
      itemId: string;
      name?: string;
      score?: string | null;
      score_scale?: string;
      internal_weight_percent?: string | null;
    }) => patchItem(itemId, payload),
    onSuccess: invalidate,
    onError: errorToast("No se pudo guardar el cambio."),
  });
}

export function useDeleteItem(enrollmentId: string) {
  const invalidate = useGradebookInvalidator(enrollmentId);
  return useMutation({
    mutationFn: (itemId: string) => deleteItem(itemId),
    onSuccess: invalidate,
    onError: errorToast("No se pudo eliminar el insumo."),
  });
}

export function useSetBimestreOverride(enrollmentId: string) {
  const invalidate = useGradebookInvalidator(enrollmentId);
  return useMutation({
    mutationFn: ({
      contribution,
      score,
      score_scale,
    }: {
      contribution: Contribution;
      score: string | null;
      score_scale?: string | null;
    }) => setBimestreOverride(enrollmentId, { contribution, score, score_scale }),
    onSuccess: invalidate,
    onError: errorToast("No se pudo guardar la nota del bimestre."),
  });
}

export function useSetRecoveryScore(enrollmentId: string) {
  const invalidate = useGradebookInvalidator(enrollmentId);
  return useMutation({
    mutationFn: (score: string | null) => setRecoveryScore(enrollmentId, score),
    onSuccess: invalidate,
    onError: errorToast("No se pudo guardar la nota de recuperación."),
  });
}
