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

export interface RequirementDetail {
  id: string;
  required_curriculum_course_id: string;
  required_code: string;
  requirement_type: "PREREQUISITE" | "COREQUISITE";
}

/** Every requirement edge in a malla, with its id — powers the visual vector editor. */
export interface RequirementEdge {
  id: string;
  curriculum_course_id: string;
  required_curriculum_course_id: string;
  requirement_type: "PREREQUISITE" | "COREQUISITE";
}

export async function listCurriculumRequirements(
  curriculumId: string,
): Promise<RequirementEdge[]> {
  const { data } = await apiClient.get<RequirementEdge[]>(
    `/admin/curricula/${curriculumId}/requirements`,
  );
  return data;
}

export async function listCourseRequirements(
  curriculumCourseId: string,
): Promise<RequirementDetail[]> {
  const { data } = await apiClient.get<RequirementDetail[]>(
    `/admin/curriculum-courses/${curriculumCourseId}/requirements`,
  );
  return data;
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

// --- System management (careers, academic periods) — superadmin ---------------------------------

export interface Career {
  id: string;
  faculty_id: string;
  name: string;
  degree_title: string;
}

export async function updateCareer(
  id: string,
  patch: { name?: string; degree_title?: string },
): Promise<Career> {
  const { data } = await apiClient.patch<Career>(`/admin/careers/${id}`, patch);
  return data;
}

export interface AcademicPeriod {
  id: string;
  institution_id: string;
  code: string;
  name: string;
  starts_on: string | null;
  ends_on: string | null;
  is_current: boolean;
}

export interface AcademicPeriodInput {
  code: string;
  name: string;
  starts_on?: string | null;
  ends_on?: string | null;
  is_current?: boolean;
}

export async function listAcademicPeriods(): Promise<AcademicPeriod[]> {
  const { data } = await apiClient.get<AcademicPeriod[]>("/academic-periods");
  return data;
}

export async function createAcademicPeriod(
  input: AcademicPeriodInput & { institution_id: string },
): Promise<AcademicPeriod> {
  const { data } = await apiClient.post<AcademicPeriod>("/admin/academic-periods", input);
  return data;
}

export async function updateAcademicPeriod(
  id: string,
  patch: Partial<AcademicPeriodInput>,
): Promise<AcademicPeriod> {
  const { data } = await apiClient.patch<AcademicPeriod>(`/admin/academic-periods/${id}`, patch);
  return data;
}

// --- Professors -----------------------------------------------------------------------------------

export interface Professor {
  id: string;
  institution_id: string;
  full_name: string;
  email: string | null;
  is_active: boolean;
}

export interface Institution {
  id: string;
  name: string;
  acronym: string;
}

export async function listInstitutions(): Promise<Institution[]> {
  const { data } = await apiClient.get<Institution[]>("/institutions");
  return data;
}

export async function listProfessors(): Promise<Professor[]> {
  const { data } = await apiClient.get<Professor[]>("/professors");
  return data;
}

export async function createProfessor(input: {
  institution_id: string;
  full_name: string;
  email?: string | null;
}): Promise<Professor> {
  const { data } = await apiClient.post<Professor>("/admin/professors", input);
  return data;
}

export async function updateProfessor(
  id: string,
  patch: { full_name?: string; email?: string | null; is_active?: boolean },
): Promise<Professor> {
  const { data } = await apiClient.patch<Professor>(`/admin/professors/${id}`, patch);
  return data;
}

export async function deleteProfessor(id: string): Promise<void> {
  await apiClient.delete(`/admin/professors/${id}`);
}
