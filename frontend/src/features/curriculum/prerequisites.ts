import type { CourseState } from "@/features/student/api";

import type { CurriculumCourse } from "./api";

/** A prerequisite counts as met when the required course has been PASSED. */
function isMet(state: CourseState | undefined): boolean {
  return state === "PASSED";
}

/** Map every course code in the curriculum to the student's current state for it. */
export function buildCodeStateMap(
  courses: CurriculumCourse[],
  stateByCourse: Map<string, CourseState>,
): Map<string, CourseState> {
  const map = new Map<string, CourseState>();
  for (const course of courses) {
    const state = stateByCourse.get(course.id);
    if (state) map.set(course.code, state);
  }
  return map;
}

/** Prerequisite codes for `course` that the student has not yet passed. */
export function unmetPrerequisites(
  course: CurriculumCourse,
  codeState: Map<string, CourseState>,
): string[] {
  return course.prerequisite_codes.filter((code) => !isMet(codeState.get(code)));
}

/**
 * Ids of courses the student marked as taking/taken while still missing
 * prerequisites — a flag that they were (or are being) taken out of order.
 */
export function coursesWithUnmetPrereqs(
  courses: CurriculumCourse[],
  stateByCourse: Map<string, CourseState>,
): Set<string> {
  const codeState = buildCodeStateMap(courses, stateByCourse);
  const flagged = new Set<string>();
  for (const course of courses) {
    const state = stateByCourse.get(course.id);
    if ((state === "IN_PROGRESS" || state === "PASSED") && unmetPrerequisites(course, codeState).length > 0) {
      flagged.add(course.id);
    }
  }
  return flagged;
}
