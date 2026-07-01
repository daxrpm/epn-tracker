import { apiClient } from "@/lib/api/client";
import { ApiError } from "@/lib/api/types";

/** Evaluation schemes (weighting templates) contract (ERS §17.x). Decimal fields arrive as strings. */

export type Contribution = "APORTE_1" | "APORTE_2";
export type EvaluationType = "FORMATIVE" | "SUMMATIVE" | "UNKNOWN";
export type SchemeVisibility = "PRIVATE" | "COMMUNITY" | "PUBLIC";

export interface SchemeListItem {
  id: string;
  course_id: string;
  title: string;
  status: string;
  approval_count: number;
}

/** Unified option shape consumed by the picker (suggest + plain list normalise to this). */
export interface SchemeOption {
  id: string;
  title: string;
  status: string;
  approval_count: number;
  match: string | null;
  warning: string | null;
}

export interface SchemeComponent {
  id: string;
  contribution: Contribution;
  name: string;
  weight_percent: string;
  evaluation_type: EvaluationType;
  score_scale: string | null;
  display_order: number;
}

export interface SchemeDetail {
  id: string;
  course_id: string;
  title: string;
  status: string;
  visibility: SchemeVisibility;
  approval_count: number;
  components: SchemeComponent[];
}

export interface SchemeComponentInput {
  contribution: Contribution;
  name: string;
  weight_percent: string;
  evaluation_type: EvaluationType;
  score_scale?: string | null;
  display_order?: number;
}

export interface SchemeCreateInput {
  course_id: string;
  academic_period_id?: string | null;
  section_id?: string | null;
  professor_id?: string | null;
  title: string;
  visibility: SchemeVisibility;
  components: SchemeComponentInput[];
}

export interface SchemeWarning {
  field: string;
  message: string;
}

export interface SchemeCreateResult {
  id: string;
  status: string;
  is_valid: boolean;
  warnings: SchemeWarning[];
}

export interface SchemeSuggestParams {
  course_id: string;
  academic_period_id?: string | null;
  section_id?: string | null;
  professor_id?: string | null;
}

export async function listSchemes(params: {
  course_id: string;
  professor_id?: string | null;
  section_id?: string | null;
}): Promise<SchemeListItem[]> {
  const { data } = await apiClient.get<SchemeListItem[]>("/evaluation-schemes", { params });
  return data;
}

interface SchemeSuggestRaw {
  id: string;
  title: string;
  status: string;
  approval_count: number;
  match: string | null;
  warning: string | null;
}

/**
 * Suggests schemes for a course, falling back to the plain list when the
 * suggest endpoint is not yet available (404).
 */
export async function suggestSchemes(params: SchemeSuggestParams): Promise<SchemeOption[]> {
  try {
    const { data } = await apiClient.get<SchemeSuggestRaw[]>("/evaluation-schemes/suggest", {
      params,
    });
    return data.map((item) => ({
      id: item.id,
      title: item.title,
      status: item.status,
      approval_count: item.approval_count,
      match: item.match ?? null,
      warning: item.warning ?? null,
    }));
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      const list = await listSchemes({
        course_id: params.course_id,
        section_id: params.section_id,
        professor_id: params.professor_id,
      });
      return list.map((item) => ({
        id: item.id,
        title: item.title,
        status: item.status,
        approval_count: item.approval_count,
        match: null,
        warning: null,
      }));
    }
    throw error;
  }
}

export async function getScheme(id: string): Promise<SchemeDetail> {
  const { data } = await apiClient.get<SchemeDetail>(`/evaluation-schemes/${id}`);
  return data;
}

export async function createScheme(input: SchemeCreateInput): Promise<SchemeCreateResult> {
  const { data } = await apiClient.post<SchemeCreateResult>("/evaluation-schemes", input);
  return data;
}

export async function copySchemeToPersonal(id: string): Promise<{ id: string; status: string }> {
  const { data } = await apiClient.post<{ id: string; status: string }>(
    `/evaluation-schemes/${id}/copy-to-personal`,
  );
  return data;
}
