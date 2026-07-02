import { apiClient } from "@/lib/api/client";

/** Professors contract (ERS §12.10). */

export interface Professor {
  id: string;
  full_name: string;
}

export async function searchProfessors(query: string): Promise<Professor[]> {
  const q = query.trim();
  if (!q) return [];
  const { data } = await apiClient.get<Professor[]>("/professors/search", {
    params: { q },
  });
  return data;
}

/** Finds a professor by name (case-insensitive) within a course's institution, or creates one. */
export async function findOrCreateProfessor(input: {
  course_id: string;
  full_name: string;
}): Promise<Professor> {
  const { data } = await apiClient.post<Professor>("/professors", input);
  return data;
}
