import { apiClient } from "@/lib/api/client";

/** Superadmin user & role management (ERS §5.4). Guarded server-side by require_super_admin. */

export type UserRole = "STUDENT" | "ADMIN" | "SUPER_ADMIN";
export type UserStatus = "ACTIVE" | "SUSPENDED" | "DELETED";

export interface AdminUser {
  id: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  is_verified: boolean;
  created_at: string;
}

export interface CreateUserInput {
  email: string;
  password: string;
  role: UserRole;
}

export async function listUsers(): Promise<AdminUser[]> {
  const { data } = await apiClient.get<AdminUser[]>("/admin/users");
  return data;
}

export async function createUser(input: CreateUserInput): Promise<AdminUser> {
  const { data } = await apiClient.post<AdminUser>("/admin/users", input);
  return data;
}

export async function updateUserRole(id: string, role: UserRole): Promise<AdminUser> {
  const { data } = await apiClient.patch<AdminUser>(`/admin/users/${id}/role`, { role });
  return data;
}

export async function updateUserStatus(
  id: string,
  status: Exclude<UserStatus, "DELETED">,
): Promise<AdminUser> {
  const { data } = await apiClient.patch<AdminUser>(`/admin/users/${id}/status`, { status });
  return data;
}

export async function deleteUser(id: string): Promise<void> {
  await apiClient.delete(`/admin/users/${id}`);
}

// --- Admin content editing (courses, mallas, requisitos) ----------------------------------------

export interface CurriculumCourseUpdate {
  reference_term?: number;
  credits?: string;
  hours?: number;
  is_required?: boolean;
}

export interface RequirementCreate {
  curriculum_course_id: string;
  required_curriculum_course_id: string;
  requirement_type: "PREREQUISITE" | "COREQUISITE";
}

export async function updateCurriculumCourse(
  id: string,
  patch: CurriculumCourseUpdate,
): Promise<void> {
  await apiClient.patch(`/admin/curriculum-courses/${id}`, patch);
}

export async function updateCourseName(courseId: string, name: string): Promise<void> {
  await apiClient.patch(`/admin/courses/${courseId}`, { name });
}

export async function addRequirement(payload: RequirementCreate): Promise<{ id: string }> {
  const { data } = await apiClient.post<{ id: string }>("/admin/course-requirements", payload);
  return data;
}

export async function removeRequirement(id: string): Promise<void> {
  await apiClient.delete(`/admin/course-requirements/${id}`);
}
