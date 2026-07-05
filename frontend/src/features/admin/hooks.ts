import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  addRequirement,
  type CreateUserInput,
  createProfessor,
  createUser,
  type CurriculumCourseUpdate,
  deleteProfessor,
  deleteUser,
  listCourseRequirements,
  listInstitutions,
  listProfessors,
  listUsers,
  type RequirementCreate,
  removeRequirement,
  updateProfessor,
  type UserRole,
  updateCourseName,
  updateCurriculumCourse,
  updateUserRole,
  updateUserStatus,
} from "./api";

export const adminKeys = {
  users: ["admin", "users"] as const,
  professors: ["admin", "professors"] as const,
  requirements: (curriculumCourseId: string) =>
    ["admin", "requirements", curriculumCourseId] as const,
};

export function useCourseRequirements(curriculumCourseId: string | null) {
  return useQuery({
    queryKey: adminKeys.requirements(curriculumCourseId ?? ""),
    queryFn: () => listCourseRequirements(curriculumCourseId as string),
    enabled: Boolean(curriculumCourseId),
  });
}

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

// Content edits refresh the malla (and the per-course requirement list) so changes show at once.
function useCurriculumRefetch() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: ["curriculum-courses"] });
    void queryClient.invalidateQueries({ queryKey: ["admin", "requirements"] });
  };
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

// --- Professors ---------------------------------------------------------------------------------

export function useInstitutions() {
  return useQuery({ queryKey: ["institutions"], queryFn: listInstitutions });
}

export function useProfessors() {
  return useQuery({ queryKey: adminKeys.professors, queryFn: listProfessors });
}

function useProfessorsRefetch() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: adminKeys.professors });
}

export function useCreateProfessor() {
  const refetch = useProfessorsRefetch();
  return useMutation({
    mutationFn: (input: { institution_id: string; full_name: string; email?: string | null }) =>
      createProfessor(input),
    onSuccess: refetch,
  });
}

export function useUpdateProfessor() {
  const refetch = useProfessorsRefetch();
  return useMutation({
    mutationFn: ({
      id,
      patch,
    }: {
      id: string;
      patch: { full_name?: string; email?: string | null; is_active?: boolean };
    }) => updateProfessor(id, patch),
    onSuccess: refetch,
  });
}

export function useDeleteProfessor() {
  const refetch = useProfessorsRefetch();
  return useMutation({
    mutationFn: (id: string) => deleteProfessor(id),
    onSuccess: refetch,
  });
}
