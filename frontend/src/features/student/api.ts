import { apiClient } from "@/lib/api/client";

/** Student profile, course states and graduation requirements (ERS §17.5). */

export type CourseState = "NOT_TAKEN" | "IN_PROGRESS" | "PASSED" | "FAILED" | "ANNULLED";

export type EnglishLevel =
  | "NONE"
  | "BASIC_1"
  | "BASIC_2"
  | "INTERMEDIATE_1"
  | "ADVANCED_1"
  | "ADVANCED_2"
  | "SUFFICIENCY_B1";

export type GradRequirementState =
  | "PENDING"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "NOT_APPLICABLE";

export interface StudentProfile {
  id: string;
  display_name: string | null;
  current_curriculum_id: string | null;
  english_level: EnglishLevel;
  english_sufficiency: boolean;
}

export interface ProfileUpdate {
  display_name?: string | null;
  current_curriculum_id?: string | null;
  english_level?: EnglishLevel;
  english_sufficiency?: boolean;
}

export interface CourseStateRecord {
  id: string;
  curriculum_course_id: string;
  state: CourseState;
  final_score_40: string | null;
}

export interface CourseStateBulkItem {
  curriculum_course_id: string;
  state: CourseState;
  final_score_40?: string | null;
}

export type GradRequirementType =
  | "ENGLISH"
  | "SPORTS"
  | "CLUBS"
  | "SOCIAL"
  | "ENTREPRENEURSHIP"
  | "ENVIRONMENT"
  | "PROJECTS"
  | "OTHER";

export interface GradRequirementRecord {
  id: string;
  graduation_requirement_id: string;
  code: string;
  name: string;
  requirement_type: GradRequirementType;
  state: GradRequirementState;
}

export async function getProfile(): Promise<StudentProfile> {
  const { data } = await apiClient.get<StudentProfile>("/student/profile");
  return data;
}

export async function updateProfile(payload: ProfileUpdate): Promise<StudentProfile> {
  const { data } = await apiClient.put<StudentProfile>("/student/profile", payload);
  return data;
}

export async function getCourseStates(): Promise<CourseStateRecord[]> {
  const { data } = await apiClient.get<CourseStateRecord[]>("/student/course-states");
  return data;
}

export async function bulkCourseStates(
  items: CourseStateBulkItem[],
): Promise<CourseStateRecord[]> {
  const { data } = await apiClient.put<CourseStateRecord[]>("/student/course-states/bulk", {
    items,
  });
  return data;
}

export async function getGradRequirements(): Promise<GradRequirementRecord[]> {
  const { data } = await apiClient.get<GradRequirementRecord[]>(
    "/student/graduation-requirements",
  );
  return data;
}

export async function updateGradRequirement(
  stateId: string,
  state: GradRequirementState,
): Promise<GradRequirementRecord> {
  const { data } = await apiClient.put<GradRequirementRecord>(
    `/student/graduation-requirements/${stateId}`,
    { state },
  );
  return data;
}
