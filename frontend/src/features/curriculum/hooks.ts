import { useQuery } from "@tanstack/react-query";

import { listCareers, listCurricula, listCurriculumCourses } from "./api";

export const curriculumKeys = {
  careers: ["careers"] as const,
  curricula: ["curricula"] as const,
  courses: (curriculumId: string) => ["curriculum-courses", curriculumId] as const,
};

export function useCareers() {
  return useQuery({ queryKey: curriculumKeys.careers, queryFn: listCareers });
}

export function useCurricula() {
  return useQuery({ queryKey: curriculumKeys.curricula, queryFn: listCurricula });
}

export function useCurriculumCourses(curriculumId: string | null | undefined) {
  return useQuery({
    queryKey: curriculumKeys.courses(curriculumId ?? ""),
    queryFn: () => listCurriculumCourses(curriculumId as string),
    enabled: Boolean(curriculumId),
  });
}
