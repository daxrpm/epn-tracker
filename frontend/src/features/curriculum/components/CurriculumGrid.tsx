import { Check, Play } from "lucide-react";
import { useMemo, type ReactNode } from "react";

import type { CourseState } from "@/features/student/api";
import { cn } from "@/lib/utils";

import type { CurriculumCourse } from "../api";
import { COURSE_STATE_META, UNIT_META, courseHours } from "../constants";

/**
 * Interactive semester grid of curriculum courses. Each course is a card button
 * whose color reflects its academic state. Shared by the malla and onboarding —
 * the parent decides what happens on click (open a dialog, apply a "brush" mode, …).
 *
 * `layout="scroll"` (default) is the dense malla view: cards sit in a single
 * horizontally-scrolling row per semester, styled to show the organization unit.
 * `layout="wrap"` instead lays cards out in a fixed-column grid (always several
 * rows, never a single wide line) with a bolder, icon-based state indicator —
 * used by onboarding, where telling "aprobada" apart from "cursando" at a glance
 * matters more than density or unit info.
 */
export function CurriculumGrid({
  courses,
  stateByCourse,
  onSelect,
  prereqWarnings,
  layout = "scroll",
  renderTermExtra,
}: {
  courses: CurriculumCourse[];
  stateByCourse: Map<string, CourseState>;
  onSelect: (course: CurriculumCourse) => void;
  /** Optional set of curriculum_course ids with unmet prerequisites. */
  prereqWarnings?: Set<string>;
  layout?: "scroll" | "wrap";
  /** Wrap layout only: slot next to the semester title, e.g. a "select whole term" action. */
  renderTermExtra?: (term: number, courseIds: string[]) => ReactNode;
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
          layout={layout}
          renderTermExtra={renderTermExtra}
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
  layout,
  renderTermExtra,
}: {
  term: number;
  courses: CurriculumCourse[];
  stateByCourse: Map<string, CourseState>;
  onSelect: (course: CurriculumCourse) => void;
  prereqWarnings?: Set<string>;
  layout: "scroll" | "wrap";
  renderTermExtra?: (term: number, courseIds: string[]) => ReactNode;
}) {
  const variant = layout === "scroll" ? "browse" : "pick";
  const cards = courses.map((course) => (
    <CourseCard
      key={course.id}
      course={course}
      state={stateByCourse.get(course.id) ?? "NOT_TAKEN"}
      hasPrereqWarning={prereqWarnings?.has(course.id) ?? false}
      onSelect={onSelect}
      variant={variant}
    />
  ));

  if (layout === "wrap") {
    return (
      <div className="flex flex-col gap-3 bg-background/25 p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-baseline gap-2">
            <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Semestre
            </span>
            <span className="text-lg font-semibold tabular-nums">{term}</span>
          </div>
          {renderTermExtra?.(
            term,
            courses.map((c) => c.id),
          )}
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {cards}
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-[4.5rem_minmax(0,1fr)] bg-background/25">
      <div className="flex flex-col items-center justify-center border-r border-border/70 px-2 py-5">
        <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
          Sem
        </span>
        <span className="text-2xl font-semibold tabular-nums">{term}</span>
      </div>
      <div className="overflow-x-auto p-3 scrollbar-thin">
        <div className="flex min-w-max gap-3">{cards}</div>
      </div>
    </div>
  );
}

/** Icon + solid accent classes for the bold "pick" badge, keyed by state. */
const PICK_BADGE_META: Partial<Record<CourseState, { icon: typeof Check; classes: string }>> = {
  PASSED: { icon: Check, classes: "bg-emerald-500 text-white" },
  IN_PROGRESS: { icon: Play, classes: "bg-sky-500 text-white" },
};

/** Card border/background per state, bold enough to read without relying on the badge. */
const PICK_CARD_META: Record<CourseState, string> = {
  PASSED: "border-emerald-500 bg-emerald-500/10 hover:bg-emerald-500/15",
  IN_PROGRESS: "border-sky-500 bg-sky-500/10 hover:bg-sky-500/15",
  FAILED: "border-red-500 bg-red-500/10 hover:bg-red-500/15",
  ANNULLED: "border-amber-500 bg-amber-500/10 hover:bg-amber-500/15",
  NOT_TAKEN: "border-dashed border-border bg-card hover:border-primary/50 hover:bg-accent",
};

function CourseCard({
  course,
  state,
  hasPrereqWarning,
  onSelect,
  variant,
}: {
  course: CurriculumCourse;
  state: CourseState;
  hasPrereqWarning: boolean;
  onSelect: (course: CurriculumCourse) => void;
  variant: "browse" | "pick";
}) {
  if (variant === "pick") {
    const stateMeta = COURSE_STATE_META[state];
    const badge = PICK_BADGE_META[state];
    return (
      <button
        type="button"
        onClick={() => onSelect(course)}
        aria-pressed={state !== "NOT_TAKEN"}
        className={cn(
          "group relative flex h-32 flex-col justify-between rounded-xl border-2 p-3 text-left transition-all hover:-translate-y-0.5 hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring",
          PICK_CARD_META[state],
        )}
      >
        <div className="flex items-start justify-between gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            {course.code}
          </span>
          <span
            className={cn(
              "grid size-6 shrink-0 place-items-center rounded-full border-2 border-current/20 text-transparent transition-colors",
              badge?.classes,
            )}
          >
            {badge && <badge.icon className="size-3.5" strokeWidth={3} />}
          </span>
        </div>
        <span className="line-clamp-2 text-xs font-semibold uppercase leading-snug">
          {course.name}
        </span>
        <div className="flex items-center justify-between gap-2 text-[10px]">
          <span className="text-muted-foreground">{Number(course.credits)} créditos</span>
          <span
            className={cn(
              "font-semibold",
              state === "NOT_TAKEN" ? "text-muted-foreground/70" : undefined,
              hasPrereqWarning && "text-amber-600 dark:text-amber-400",
            )}
          >
            {hasPrereqWarning ? "Falta req." : stateMeta.label}
          </span>
        </div>
      </button>
    );
  }

  const stateMeta = COURSE_STATE_META[state];
  const unitMeta = UNIT_META[course.organization_unit];
  return (
    <button
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
        <span className="size-1.5 rounded-full bg-white/90" title={stateMeta.label} />
      </div>
    </button>
  );
}
