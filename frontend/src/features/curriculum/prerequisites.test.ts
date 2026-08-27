import { describe, expect, it } from "vitest";

import type { CourseState } from "@/features/student/api";

import type { CurriculumCourse } from "./api";
import {
  buildCodeStateMap,
  coursesWithUnmetPrereqs,
  unmetPrerequisites,
} from "./prerequisites";

/**
 * The malla flags a course the student marked as taken while its prerequisites are not. Getting
 * this wrong either nags about a valid plan or stays silent about a real ordering mistake.
 */

function course(id: string, code: string, prerequisites: string[] = []): CurriculumCourse {
  return {
    id,
    course_id: `catalog-${id}`,
    code,
    name: code,
    reference_term: 1,
    credits: "3",
    organization_unit: "PROFESSIONAL",
    is_required: true,
    prerequisite_codes: prerequisites,
    corequisite_codes: [],
  };
}

const CALC1 = course("1", "MAT100");
const CALC2 = course("2", "MAT200", ["MAT100"]);
const CALC3 = course("3", "MAT300", ["MAT200"]);
const ALL = [CALC1, CALC2, CALC3];

function states(entries: Record<string, CourseState>): Map<string, CourseState> {
  return new Map(Object.entries(entries));
}

describe("unmetPrerequisites", () => {
  it("is empty when the prerequisite is passed", () => {
    const codeState = buildCodeStateMap(ALL, states({ "1": "PASSED" }));
    expect(unmetPrerequisites(CALC2, codeState)).toEqual([]);
  });

  it("lists a prerequisite that is merely in progress", () => {
    // "En curso" is not "aprobada": the requirement is not met yet.
    const codeState = buildCodeStateMap(ALL, states({ "1": "IN_PROGRESS" }));
    expect(unmetPrerequisites(CALC2, codeState)).toEqual(["MAT100"]);
  });

  it("lists a prerequisite that was failed or annulled", () => {
    expect(
      unmetPrerequisites(CALC2, buildCodeStateMap(ALL, states({ "1": "FAILED" }))),
    ).toEqual(["MAT100"]);
    expect(
      unmetPrerequisites(CALC2, buildCodeStateMap(ALL, states({ "1": "ANNULLED" }))),
    ).toEqual(["MAT100"]);
  });

  it("lists a prerequisite with no state at all", () => {
    expect(unmetPrerequisites(CALC2, buildCodeStateMap(ALL, states({})))).toEqual(["MAT100"]);
  });
});

describe("coursesWithUnmetPrereqs", () => {
  it("flags nothing for a valid progression", () => {
    const flagged = coursesWithUnmetPrereqs(
      ALL,
      states({ "1": "PASSED", "2": "PASSED", "3": "IN_PROGRESS" }),
    );
    expect(flagged.size).toBe(0);
  });

  it("flags a course taken out of order", () => {
    const flagged = coursesWithUnmetPrereqs(ALL, states({ "3": "IN_PROGRESS" }));
    expect([...flagged]).toEqual(["3"]);
  });

  it("does not flag an untouched course", () => {
    // Not having started MAT300 is not a mistake, just a plan.
    const flagged = coursesWithUnmetPrereqs(ALL, states({ "1": "PASSED" }));
    expect(flagged.size).toBe(0);
  });

  it("flags a passed course whose prerequisite was never passed", () => {
    const flagged = coursesWithUnmetPrereqs(ALL, states({ "2": "PASSED" }));
    expect([...flagged]).toEqual(["2"]);
  });
});
