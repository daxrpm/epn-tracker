import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  copySchemeToPersonal,
  createScheme,
  getScheme,
  type SchemeCreateInput,
  type SchemeSuggestParams,
  suggestSchemes,
  voteScheme,
} from "./api";
import {
  addItem,
  calculate,
  createEnrollment,
  deleteItem,
  type EnrollmentCreateInput,
  type GradeComponentMode,
  getGradebook,
  listEnrollments,
  patchComponent,
  patchItem,
  projection,
} from "./gradebook";

export const evaluationKeys = {
  suggest: (params: SchemeSuggestParams) => ["evaluation", "suggest", params] as const,
  scheme: (id: string) => ["evaluation", "scheme", id] as const,
  enrollments: ["evaluation", "enrollments"] as const,
  gradebook: (enrollmentId: string) => ["evaluation", "gradebook", enrollmentId] as const,
  calculate: (enrollmentId: string) => ["evaluation", "calculate", enrollmentId] as const,
  projection: (enrollmentId: string) => ["evaluation", "projection", enrollmentId] as const,
};

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
  return useMutation({ mutationFn: (input: SchemeCreateInput) => createScheme(input) });
}

export function useVoteScheme() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => voteScheme(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["evaluation", "suggest"] });
    },
  });
}

export function useCopyScheme() {
  return useMutation({ mutationFn: (id: string) => copySchemeToPersonal(id) });
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

/** Invalidate the gradebook and its derived calculation/projection after an edit. */
function useGradebookInvalidator(enrollmentId: string) {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: evaluationKeys.gradebook(enrollmentId) });
    void queryClient.invalidateQueries({ queryKey: evaluationKeys.calculate(enrollmentId) });
    void queryClient.invalidateQueries({ queryKey: evaluationKeys.projection(enrollmentId) });
  };
}

export function usePatchComponent(enrollmentId: string) {
  const invalidate = useGradebookInvalidator(enrollmentId);
  return useMutation({
    mutationFn: ({
      componentStateId,
      mode,
      direct_score,
    }: {
      componentStateId: string;
      mode?: GradeComponentMode;
      direct_score?: string | null;
    }) => patchComponent(componentStateId, { mode, direct_score }),
    onSuccess: invalidate,
  });
}

export function useAddItem(enrollmentId: string) {
  const invalidate = useGradebookInvalidator(enrollmentId);
  return useMutation({
    mutationFn: ({
      componentStateId,
      name,
      score,
      internal_weight_percent,
    }: {
      componentStateId: string;
      name: string;
      score?: string | null;
      internal_weight_percent?: string | null;
    }) => addItem(componentStateId, { name, score, internal_weight_percent }),
    onSuccess: invalidate,
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
      internal_weight_percent?: string | null;
    }) => patchItem(itemId, payload),
    onSuccess: invalidate,
  });
}

export function useDeleteItem(enrollmentId: string) {
  const invalidate = useGradebookInvalidator(enrollmentId);
  return useMutation({
    mutationFn: (itemId: string) => deleteItem(itemId),
    onSuccess: invalidate,
  });
}
