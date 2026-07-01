import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  bulkCourseStates,
  type CourseStateBulkItem,
  getCourseStates,
  getGradRequirements,
  getProfile,
  type GradRequirementState,
  type ProfileUpdate,
  updateGradRequirement,
  updateProfile,
} from "./api";

export const studentKeys = {
  profile: ["student", "profile"] as const,
  courseStates: ["student", "course-states"] as const,
  gradRequirements: ["student", "graduation-requirements"] as const,
};

export function useProfile() {
  return useQuery({ queryKey: studentKeys.profile, queryFn: getProfile });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: ProfileUpdate) => updateProfile(payload),
    onSuccess: (profile) => {
      queryClient.setQueryData(studentKeys.profile, profile);
    },
  });
}

export function useCourseStates() {
  return useQuery({ queryKey: studentKeys.courseStates, queryFn: getCourseStates });
}

export function useBulkCourseStates() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (items: CourseStateBulkItem[]) => bulkCourseStates(items),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: studentKeys.courseStates });
    },
  });
}

export function useGradRequirements() {
  return useQuery({
    queryKey: studentKeys.gradRequirements,
    queryFn: getGradRequirements,
  });
}

export function useUpdateGradRequirement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ stateId, state }: { stateId: string; state: GradRequirementState }) =>
      updateGradRequirement(stateId, state),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: studentKeys.gradRequirements });
    },
  });
}
