import { apiClient } from "@/lib/api/client";

/** Academic catalog contract (ERS §17.2/§17.3). Decimal fields arrive as strings from the API. */

export type CurriculumStatus = "DRAFT" | "ACTIVE" | "ARCHIVED";
export type OrganizationUnit = "BASIC" | "PROFESSIONAL" | "CAPSTONE" | "OTHER";

export interface Career {
  id: string;
  faculty_id: string;
  name: string;
  degree_title: string;
}

export interface Curriculum {
  id: string;
  career_id: string;
  name: string;
  pensum_year: number;
  total_credits: string;
  total_hours?: number;
  total_terms: number;
  total_courses_reported?: number | null;
  status: CurriculumStatus;
}

export interface CurriculumCourse {
  id: string;
  course_id: string;
  code: string;
  name: string;
  reference_term: number;
  credits: string;
  hours?: number;
  organization_unit: OrganizationUnit;
  is_required: boolean;
  prerequisite_codes: string[];
  corequisite_codes: string[];
}

export async function listCareers(): Promise<Career[]> {
  const { data } = await apiClient.get<Career[]>("/careers");
  return data;
}

export async function listCurricula(): Promise<Curriculum[]> {
  const { data } = await apiClient.get<Curriculum[]>("/curricula");
  return data;
}

export async function listCurriculumCourses(curriculumId: string): Promise<CurriculumCourse[]> {
  const { data } = await apiClient.get<CurriculumCourse[]>(
    `/curricula/${curriculumId}/courses`,
  );
  return data;
}
