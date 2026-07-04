import { apiClient } from "@/lib/api/client";
import type { CourseState, EnglishLevel } from "@/features/student/api";

/** Enrollment simulator contract (ERS §17.10, §18.3). Decimal fields arrive as strings. */

export interface EnglishStateInput {
  level: EnglishLevel;
  sufficiency: boolean;
  last_required_level_enrolled: boolean;
  has_exception_authorization: boolean;
}

export interface Assumption {
  curriculum_course_id: string;
  state: CourseState;
}

export interface SimulationRunPayload {
  assumptions?: Assumption[];
  selected_course_ids?: string[];
  has_special_credit_authorization?: boolean;
  english_override?: EnglishStateInput | null;
}

export interface SimReason {
  code: string;
  message: string;
}

export interface SimCourse {
  code: string;
  name: string;
  credits: string;
  curriculum_course_id: string | null;
  reference_term: number | null;
}

export interface SimBlockedCourse extends SimCourse {
  reasons: SimReason[];
}

export interface SimulationResult {
  max_credits: string;
  selected_credits: string;
  selected_valid: boolean;
  eligible_courses: SimCourse[];
  blocked_courses: SimBlockedCourse[];
  restriction_reasons: SimReason[];
}

export interface SavedSimulationListItem {
  id: string;
  name: string;
  curriculum_id: string;
  created_at: string;
  max_credits: string;
  selected_credits: string;
  selected_valid: boolean;
}

export interface SavedSimulationInput {
  assumptions: Assumption[];
  selected_course_ids: string[];
  has_special_credit_authorization: boolean;
  english_override: EnglishStateInput | null;
}

export interface SavedSimulation {
  id: string;
  name: string;
  curriculum_id: string;
  created_at: string;
  input_snapshot: SavedSimulationInput;
  result: SimulationResult;
}

export interface SaveSimulationPayload extends SimulationRunPayload {
  name: string;
}

export async function runSimulation(payload: SimulationRunPayload): Promise<SimulationResult> {
  const { data } = await apiClient.post<SimulationResult>("/student/simulations/run", payload);
  return data;
}

export async function saveSimulation(payload: SaveSimulationPayload): Promise<SavedSimulation> {
  const { data } = await apiClient.post<SavedSimulation>("/student/simulations", payload);
  return data;
}

export async function listSimulations(): Promise<SavedSimulationListItem[]> {
  const { data } = await apiClient.get<SavedSimulationListItem[]>("/student/simulations");
  return data;
}

export async function getSimulation(id: string): Promise<SavedSimulation> {
  const { data } = await apiClient.get<SavedSimulation>(`/student/simulations/${id}`);
  return data;
}

export async function deleteSimulation(id: string): Promise<void> {
  await apiClient.delete(`/student/simulations/${id}`);
}
