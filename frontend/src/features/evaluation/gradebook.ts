import { apiClient } from "@/lib/api/client";

import type { Contribution } from "./api";

/** Student enrollment + gradebook contract (ERS §17.5, §17.6). Decimals arrive as strings. */

export type GradeComponentMode = "DIRECT_SCORE" | "EQUAL_AVERAGE" | "CUSTOM_WEIGHTS";

export type CourseFinalStatus =
  | "APPROVED"
  | "RECOVERY_ELIGIBLE"
  | "FAILED_DIRECT"
  | "IN_PROGRESS";

export interface Enrollment {
  id: string;
  curriculum_course_id: string;
  evaluation_scheme_id: string | null;
}

export interface EnrollmentCreateInput {
  curriculum_course_id: string;
  academic_period_id?: string | null;
  section_id?: string | null;
  professor_id?: string | null;
  evaluation_scheme_id: string;
}

export interface GradeItem {
  id: string;
  name: string;
  score: string | null;
  internal_weight_percent: string | null;
}

export interface ComponentState {
  id: string;
  evaluation_component_id: string;
  name: string;
  contribution: Contribution;
  weight_percent: string;
  mode: GradeComponentMode;
  direct_score: string | null;
  calculated_score: string | null;
  items: GradeItem[];
}

export interface Gradebook {
  enrollment_id: string;
  components: ComponentState[];
}

export interface ContributionResult {
  contribution: Contribution;
  score_20: string;
  evaluated_weight_percent: string;
  is_complete: boolean;
}

export interface CalculateResult {
  aporte_1: ContributionResult;
  aporte_2: ContributionResult;
  final_40: string;
  final_20: string;
  display_final_20: string;
  status: CourseFinalStatus;
  is_complete: boolean;
  required_recovery_score_40: string | null;
}

export interface ProjectionResult {
  target_final_40: string;
  current_points_40: string;
  evaluated_weight_percent: string;
  remaining_weight_percent: string;
  required_avg_score_20: string | null;
  already_reached: boolean;
  is_reachable: boolean;
}

export async function listEnrollments(): Promise<Enrollment[]> {
  const { data } = await apiClient.get<Enrollment[]>("/student/enrollments");
  return data;
}

export async function createEnrollment(input: EnrollmentCreateInput): Promise<Enrollment> {
  const { data } = await apiClient.post<Enrollment>("/student/enrollments", input);
  return data;
}

export async function getGradebook(enrollmentId: string): Promise<Gradebook> {
  const { data } = await apiClient.get<Gradebook>(
    `/student/enrollments/${enrollmentId}/gradebook`,
  );
  return data;
}

export async function calculate(enrollmentId: string): Promise<CalculateResult> {
  const { data } = await apiClient.post<CalculateResult>(
    `/student/enrollments/${enrollmentId}/calculate`,
  );
  return data;
}

export async function projection(
  enrollmentId: string,
  targetFinal40?: string,
): Promise<ProjectionResult> {
  const { data } = await apiClient.get<ProjectionResult>(
    `/student/enrollments/${enrollmentId}/projection`,
    { params: targetFinal40 ? { target_final_40: targetFinal40 } : undefined },
  );
  return data;
}

export async function patchComponent(
  componentStateId: string,
  payload: { mode?: GradeComponentMode; direct_score?: string | null },
): Promise<{ id: string; calculated_score: string }> {
  const { data } = await apiClient.patch<{ id: string; calculated_score: string }>(
    `/student/grade-components/${componentStateId}`,
    payload,
  );
  return data;
}

export async function addItem(
  componentStateId: string,
  payload: { name: string; score?: string | null; internal_weight_percent?: string | null },
): Promise<GradeItem> {
  const { data } = await apiClient.post<GradeItem>(
    `/student/grade-components/${componentStateId}/items`,
    payload,
  );
  return data;
}

export async function patchItem(
  itemId: string,
  payload: { name?: string; score?: string | null; internal_weight_percent?: string | null },
): Promise<GradeItem> {
  const { data } = await apiClient.patch<GradeItem>(`/student/grade-items/${itemId}`, payload);
  return data;
}

export async function deleteItem(itemId: string): Promise<void> {
  await apiClient.delete(`/student/grade-items/${itemId}`);
}
