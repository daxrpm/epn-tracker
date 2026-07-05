import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  addRequirement,
  type CreateUserInput,
  createUser,
  type CurriculumCourseUpdate,
  deleteUser,
  listUsers,
  type RequirementCreate,
  removeRequirement,
  type UserRole,
  updateCourseName,
  updateCurriculumCourse,
  updateUserRole,
  updateUserStatus,
} from "./api";

export const adminKeys = {
  users: ["admin", "users"] as const,
};

export function useUsers() {
  return useQuery({ queryKey: adminKeys.users, queryFn: listUsers });
}

export function useCreateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateUserInput) => createUser(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: adminKeys.users }),
  });
}

export function useUpdateUserRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, role }: { id: string; role: UserRole }) => updateUserRole(id, role),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: adminKeys.users }),
  });
}

export function useUpdateUserStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: "ACTIVE" | "SUSPENDED" }) =>
      updateUserStatus(id, status),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: adminKeys.users }),
  });
}

export function useDeleteUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteUser(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: adminKeys.users }),
  });
}

// Content edits refresh the malla so the change (and its arrows) show immediately.
function useCurriculumRefetch() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ["curriculum-courses"] });
}

export function useUpdateCurriculumCourse() {
  const refetch = useCurriculumRefetch();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: CurriculumCourseUpdate }) =>
      updateCurriculumCourse(id, patch),
    onSuccess: refetch,
  });
}

export function useUpdateCourseName() {
  const refetch = useCurriculumRefetch();
  return useMutation({
    mutationFn: ({ courseId, name }: { courseId: string; name: string }) =>
      updateCourseName(courseId, name),
    onSuccess: refetch,
  });
}

export function useAddRequirement() {
  const refetch = useCurriculumRefetch();
  return useMutation({
    mutationFn: (payload: RequirementCreate) => addRequirement(payload),
    onSuccess: refetch,
  });
}

export function useRemoveRequirement() {
  const refetch = useCurriculumRefetch();
  return useMutation({
    mutationFn: (id: string) => removeRequirement(id),
    onSuccess: refetch,
  });
}
