import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";

import type { CourseState } from "@/features/student/api";
import { cn } from "@/lib/utils";

import type { CurriculumCourse } from "../api";
import { COURSE_STATE_META, UNIT_META, courseHours } from "../constants";
import { subjectIcon } from "../subjectIcons";

/**
 * Poster-style curriculum map: courses laid out in a fixed grid (one row per semester) with an SVG
 * overlay that draws the prerequisite (blue) and corequisite (orange) connectors between cards,
 * mirroring the official EPN malla. Arrows are recomputed from live DOM measurements so they track
 * the real card positions on resize.
 *
 * Clicking a course "focuses" it: the course and its whole prerequisite chain stay in color while
 * everything else dims, so the student can see at a glance what a subject depends on. Clicking the
 * focused course again opens its state dialog; clicking the empty background clears the focus.
 */
type Edge = { key: string; d: string; kind: "prereq" | "coreq"; from: string; to: string };

export function CurriculumMap({
  courses,
  stateByCourse,
  onSelect,
  prereqWarnings,
}: {
  courses: CurriculumCourse[];
  stateByCourse: Map<string, CourseState>;
  onSelect: (course: CurriculumCourse) => void;
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
  const maxCols = useMemo(
    () => Math.max(1, ...terms.map(([, list]) => list.length)),
    [terms],
  );

  const containerRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef(new Map<string, HTMLElement>());
  const [edges, setEdges] = useState<Edge[]>([]);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [focusedCode, setFocusedCode] = useState<string | null>(null);

  // Only draw an arrow when the target course is present (search may filter cards out).
  const present = useMemo(() => new Set(courses.map((c) => c.code)), [courses]);

  // The focused course plus its transitive prerequisites (the "keep in color" set). Null = no focus.
  const chain = useMemo(() => {
    if (!focusedCode || !present.has(focusedCode)) return null;
    const byCode = new Map(courses.map((c) => [c.code, c]));
    const keep = new Set<string>([focusedCode]);
    const stack = [focusedCode];
    while (stack.length > 0) {
      const current = byCode.get(stack.pop() as string);
      if (!current) continue;
      for (const code of current.prerequisite_codes) {
        if (!keep.has(code)) {
          keep.add(code);
          stack.push(code);
        }
      }
    }
    return keep;
  }, [focusedCode, courses, present]);

  const recompute = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const base = container.getBoundingClientRect();
    const next: Edge[] = [];
    for (const course of courses) {
      const toEl = cardRefs.current.get(course.code);
      if (!toEl) continue;
      const to = toEl.getBoundingClientRect();
      const tx = to.left - base.left + to.width / 2;
      const ty = to.top - base.top;
      const draw = (fromCode: string, kind: Edge["kind"]) => {
        if (!present.has(fromCode)) return;
        const fromEl = cardRefs.current.get(fromCode);
        if (!fromEl) return;
        const f = fromEl.getBoundingClientRect();
        const fx = f.left - base.left + f.width / 2;
        const fy = f.bottom - base.top;
        const midY = (fy + ty) / 2;
        next.push({
          key: `${kind}:${fromCode}->${course.code}`,
          d: `M ${fx} ${fy} C ${fx} ${midY}, ${tx} ${midY}, ${tx} ${ty}`,
          kind,
          from: fromCode,
          to: course.code,
        });
      };
      course.prerequisite_codes.forEach((c) => draw(c, "prereq"));
      course.corequisite_codes.forEach((c) => draw(c, "coreq"));
    }
    setEdges(next);
    setSize({ w: container.scrollWidth, h: container.scrollHeight });
  }, [courses, present]);

  useLayoutEffect(() => {
    recompute();
    const container = containerRef.current;
    if (!container) return;
    const ro = new ResizeObserver(() => recompute());
    ro.observe(container);
    window.addEventListener("resize", recompute);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", recompute);
    };
  }, [recompute]);

  function activate(course: CurriculumCourse) {
    if (focusedCode === course.code) onSelect(course);
    else setFocusedCode(course.code);
  }

  return (
    <div
      className="overflow-x-auto p-3 scrollbar-thin sm:p-4"
      onClick={() => setFocusedCode(null)}
    >
      <div ref={containerRef} className="relative min-w-max">
        <svg
          className="pointer-events-none absolute inset-0"
          width={size.w}
          height={size.h}
          fill="none"
        >
          <defs>
            <marker
              id="malla-arrow-prereq"
              viewBox="0 0 8 8"
              refX="6"
              refY="4"
              markerWidth="5"
              markerHeight="5"
              orient="auto-start-reverse"
            >
              <path d="M0,0 L8,4 L0,8 z" fill="#3b82f6" />
            </marker>
            <marker
              id="malla-arrow-coreq"
              viewBox="0 0 8 8"
              refX="6"
              refY="4"
              markerWidth="5"
              markerHeight="5"
              orient="auto-start-reverse"
            >
              <path d="M0,0 L8,4 L0,8 z" fill="#f59e0b" />
            </marker>
          </defs>
          {edges.map((edge) => {
            const active = !chain || (chain.has(edge.from) && chain.has(edge.to));
            return (
              <path
                key={edge.key}
                d={edge.d}
                stroke={edge.kind === "prereq" ? "#3b82f6" : "#f59e0b"}
                strokeWidth={active && chain ? 2 : 1.5}
                strokeOpacity={0.7}
                opacity={active ? 1 : 0.08}
                markerEnd={`url(#malla-arrow-${edge.kind})`}
              />
            );
          })}
        </svg>

        <div className="relative flex flex-col gap-6">
          {terms.map(([term, termCourses]) => (
            <div key={term} className="flex items-stretch gap-3">
              <div className="flex w-9 shrink-0 flex-col items-center justify-center">
                <span className="text-[9px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                  Sem
                </span>
                <span className="text-xl font-semibold tabular-nums">{term}</span>
              </div>
              <div
                className="grid flex-1 items-stretch gap-3"
                style={{ gridTemplateColumns: `repeat(${maxCols}, 11rem)` }}
              >
                {termCourses.map((course) => (
                  <MapCard
                    key={course.id}
                    course={course}
                    state={stateByCourse.get(course.id) ?? "NOT_TAKEN"}
                    hasPrereqWarning={prereqWarnings?.has(course.id) ?? false}
                    dimmed={chain !== null && !chain.has(course.code)}
                    focused={focusedCode === course.code}
                    onActivate={activate}
                    registerRef={(el) => {
                      if (el) cardRefs.current.set(course.code, el);
                      else cardRefs.current.delete(course.code);
                    }}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function MapCard({
  course,
  state,
  hasPrereqWarning,
  dimmed,
  focused,
  onActivate,
  registerRef,
}: {
  course: CurriculumCourse;
  state: CourseState;
  hasPrereqWarning: boolean;
  dimmed: boolean;
  focused: boolean;
  onActivate: (course: CurriculumCourse) => void;
  registerRef: (el: HTMLElement | null) => void;
}) {
  const stateMeta = COURSE_STATE_META[state];
  const unitMeta = UNIT_META[course.organization_unit];
  const Icon = subjectIcon(course.name, course.organization_unit);
  return (
    <button
      ref={registerRef}
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onActivate(course);
      }}
      title={
        focused
          ? "Toca de nuevo para cambiar el estado"
          : hasPrereqWarning
            ? "Te faltan prerrequisitos para esta materia"
            : stateMeta.label
      }
      className={cn(
        "group relative z-10 flex min-h-36 flex-col overflow-hidden rounded-lg border text-left transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring",
        stateMeta.card,
        dimmed && "opacity-30 grayscale",
        focused && "ring-2 ring-primary ring-offset-1 ring-offset-background",
      )}
    >
      <div className="flex shrink-0 items-center justify-between border-b border-current/10 px-2.5 py-1.5 text-[10px] text-muted-foreground">
        <span>{Number(course.credits)} créditos</span>
        <span>{courseHours(course)} h</span>
      </div>
      <div className="flex flex-1 flex-col gap-1 px-2.5 py-2">
        <Icon className="size-3.5 shrink-0 text-muted-foreground" />
        <span className="line-clamp-3 text-[11px] font-semibold uppercase leading-[1.3]">
          {course.name}
        </span>
        {course.prerequisite_codes.length > 0 && (
          <span
            className={cn(
              "mt-auto truncate text-[9px]",
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
          "flex h-5 shrink-0 items-center justify-between px-2.5 text-[9px] font-semibold text-white",
          unitMeta.stripe,
        )}
      >
        <span>{course.code}</span>
        <span className="size-1.5 rounded-full bg-white/90" />
      </div>
    </button>
  );
}
