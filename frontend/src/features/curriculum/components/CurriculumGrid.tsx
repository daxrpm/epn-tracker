import { useMemo } from "react";

import type { CourseState } from "@/features/student/api";
import { cn } from "@/lib/utils";

import type { CurriculumCourse } from "../api";
import { COURSE_STATE_META, UNIT_META, courseHours } from "../constants";

/**
 * Interactive semester grid of curriculum courses. Each course is a card button
 * whose color reflects its academic state. Shared by the malla and onboarding —
 * the parent decides what happens on click (open a dialog, cycle the state, …).
 */
export function CurriculumGrid({
  courses,
  stateByCourse,
  onSelect,
  prereqWarnings,
}: {
  courses: CurriculumCourse[];
  stateByCourse: Map<string, CourseState>;
  onSelect: (course: CurriculumCourse) => void;
  /** Optional set of curriculum_course ids with unmet prerequisites. */
  prereqWarnings?: Set<string>;
}) {
  const terms = useMemo(() => {
    const grouped = new Map<number, CurriculumCourse[]>();
    for (const course of courses) {
      const list = grouped.get(course.reference_term) ?? [];
      list.push(course);
      grouped.set(course.reference_term, list);
    }
    return [...grouped.entries()].sort((a, b) => a[0] - b[0]);
  }, [courses]);

  return (
    <div className="divide-y divide-border/70">
      {terms.map(([term, termCourses]) => (
        <TermRow
          key={term}
          term={term}
          courses={termCourses}
          stateByCourse={stateByCourse}
          onSelect={onSelect}
          prereqWarnings={prereqWarnings}
        />
      ))}
    </div>
  );
}

function TermRow({
  term,
  courses,
  stateByCourse,
  onSelect,
  prereqWarnings,
}: {
  term: number;
  courses: CurriculumCourse[];
  stateByCourse: Map<string, CourseState>;
  onSelect: (course: CurriculumCourse) => void;
  prereqWarnings?: Set<string>;
}) {
  return (
    <div className="grid grid-cols-[4.5rem_minmax(0,1fr)] bg-background/25">
      <div className="flex flex-col items-center justify-center border-r border-border/70 px-2 py-5">
        <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
          Sem
        </span>
        <span className="text-2xl font-semibold tabular-nums">{term}</span>
      </div>
      <div className="overflow-x-auto p-3 scrollbar-thin">
        <div className="flex min-w-max gap-3">
          {courses.map((course) => {
            const state = stateByCourse.get(course.id) ?? "NOT_TAKEN";
            const stateMeta = COURSE_STATE_META[state];
            const unitMeta = UNIT_META[course.organization_unit];
            const hasPrereqWarning = prereqWarnings?.has(course.id) ?? false;
            return (
              <button
                key={course.id}
                type="button"
                onClick={() => onSelect(course)}
                className={cn(
                  "group relative flex h-36 w-44 shrink-0 flex-col overflow-hidden rounded-lg border text-left transition-all hover:-translate-y-0.5 hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring",
                  stateMeta.card,
                )}
              >
                <div className="flex items-center justify-between border-b border-current/10 px-3 py-2 text-[10px] text-muted-foreground">
                  <span>{Number(course.credits)} créditos</span>
                  <span>{courseHours(course)} h</span>
                </div>
                <div className="flex flex-1 flex-col px-3 py-2.5">
                  <span className="line-clamp-3 text-xs font-semibold uppercase leading-[1.35]">
                    {course.name}
                  </span>
                  {course.prerequisite_codes.length > 0 && (
                    <span
                      className={cn(
                        "mt-auto truncate text-[10px]",
                        hasPrereqWarning
                          ? "font-medium text-amber-600 dark:text-amber-400"
                          : "text-muted-foreground",
                      )}
                    >
                      Req. {course.prerequisite_codes.join(", ")}
                    </span>
                  )}
                </div>
                <div
                  className={cn(
                    "flex h-6 items-center justify-between px-3 text-[10px] font-semibold text-white",
                    unitMeta.stripe,
                  )}
                >
                  <span>{course.code}</span>
                  <span
                    className="size-1.5 rounded-full bg-white/90"
                    title={stateMeta.label}
                  />
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
