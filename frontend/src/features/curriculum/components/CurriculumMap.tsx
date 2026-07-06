import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

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
 * Two interaction modes:
 *  - **View** (default): clicking a course "focuses" it — the course and its whole prerequisite
 *    chain stay in color while everything else dims; clicking it again opens its state dialog;
 *    clicking the empty background clears the focus.
 *  - **Edit** (admins/superadmin): draw the graph visually. Click a source course to "arm" it — a
 *    live connector follows the cursor — then click a target course to create the requirement arrow.
 *    Click an existing arrow to delete it. The current arrow kind (prereq/coreq) comes from `drawKind`.
 */
type EdgeKind = "prereq" | "coreq";
type Edge = { key: string; d: string; kind: EdgeKind; from: string; to: string };
type Rubber = { x1: number; y1: number; x2: number; y2: number };

const KIND_COLOR: Record<EdgeKind, string> = { prereq: "#3b82f6", coreq: "#f59e0b" };

export function CurriculumMap({
  courses,
  stateByCourse,
  onSelect,
  prereqWarnings,
  editMode = false,
  edgeIndex,
  drawKind = "prereq",
  busy = false,
  onCreateEdge,
  onDeleteEdge,
}: {
  courses: CurriculumCourse[];
  stateByCourse: Map<string, CourseState>;
  onSelect: (course: CurriculumCourse) => void;
  prereqWarnings?: Set<string>;
  /** When true, clicking cards draws/removes requirement arrows instead of focusing. */
  editMode?: boolean;
  /** Maps an edge key (`${kind}:${fromCode}->${toCode}`) to its requirement id, for deletion. */
  edgeIndex?: Map<string, string>;
  /** The kind of arrow drawn on the next connection. */
  drawKind?: EdgeKind;
  /** A create/delete mutation is in flight; blocks further edits to avoid races. */
  busy?: boolean;
  onCreateEdge?: (from: CurriculumCourse, to: CurriculumCourse) => void;
  onDeleteEdge?: (requirementId: string) => void;
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

  // Edit-mode state: the armed source card, the live cursor connector, and the hovered arrow.
  const [armed, setArmed] = useState<string | null>(null);
  const [rubber, setRubber] = useState<Rubber | null>(null);
  const [hoverEdge, setHoverEdge] = useState<string | null>(null);

  // Only draw an arrow when the target course is present (search may filter cards out).
  const present = useMemo(() => new Set(courses.map((c) => c.code)), [courses]);

  // The focused course plus its transitive prerequisites (the "keep in color" set). Null = no focus.
  const chain = useMemo(() => {
    if (editMode || !focusedCode || !present.has(focusedCode)) return null;
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
  }, [editMode, focusedCode, courses, present]);

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
      const draw = (fromCode: string, kind: EdgeKind) => {
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

  // Leaving edit mode (or losing the armed card to a filter) resets the transient drawing state.
  useEffect(() => {
    if (!editMode || (armed && !present.has(armed))) {
      setArmed(null);
      setRubber(null);
    }
  }, [editMode, armed, present]);

  // Escape cancels an in-progress connection.
  useEffect(() => {
    if (!editMode) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setArmed(null);
        setRubber(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editMode]);

  function handleCardClick(course: CurriculumCourse) {
    if (editMode) {
      if (busy) return;
      if (!armed) {
        setArmed(course.code);
        return;
      }
      if (armed === course.code) {
        setArmed(null);
        setRubber(null);
        return;
      }
      const from = courses.find((c) => c.code === armed);
      if (from) onCreateEdge?.(from, course);
      // Keep the source armed so one prerequisite can be wired to several courses in a row.
      return;
    }
    if (focusedCode === course.code) onSelect(course);
    else setFocusedCode(course.code);
  }

  function handleMove(event: React.MouseEvent<HTMLDivElement>) {
    if (!editMode || !armed) return;
    const container = containerRef.current;
    const fromEl = cardRefs.current.get(armed);
    if (!container || !fromEl) return;
    const base = container.getBoundingClientRect();
    const f = fromEl.getBoundingClientRect();
    setRubber({
      x1: f.left - base.left + f.width / 2,
      y1: f.bottom - base.top,
      x2: event.clientX - base.left,
      y2: event.clientY - base.top,
    });
  }

  function clearInteraction() {
    if (editMode) {
      setArmed(null);
      setRubber(null);
    } else {
      setFocusedCode(null);
    }
  }

  return (
    <div className="overflow-x-auto p-3 scrollbar-thin sm:p-4" onClick={clearInteraction}>
      <div
        ref={containerRef}
        className="relative min-w-max"
        onMouseMove={handleMove}
      >
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
            <marker
              id="malla-arrow-delete"
              viewBox="0 0 8 8"
              refX="6"
              refY="4"
              markerWidth="5"
              markerHeight="5"
              orient="auto-start-reverse"
            >
              <path d="M0,0 L8,4 L0,8 z" fill="#ef4444" />
            </marker>
          </defs>
          {edges.map((edge) => {
            const active = !chain || (chain.has(edge.from) && chain.has(edge.to));
            const hovered = editMode && hoverEdge === edge.key;
            return (
              <path
                key={edge.key}
                d={edge.d}
                stroke={hovered ? "#ef4444" : KIND_COLOR[edge.kind]}
                strokeWidth={hovered ? 2.5 : active && chain ? 2 : 1.5}
                strokeOpacity={0.75}
                opacity={active ? 1 : 0.08}
                markerEnd={`url(#malla-arrow-${hovered ? "delete" : edge.kind})`}
              />
            );
          })}

          {/* Wide, invisible hit targets so thin arrows are easy to click-to-delete in edit mode. */}
          {editMode &&
            edges.map((edge) => {
              const id = edgeIndex?.get(edge.key);
              if (!id) return null;
              return (
                <path
                  key={`hit:${edge.key}`}
                  d={edge.d}
                  stroke="transparent"
                  strokeWidth={14}
                  style={{ pointerEvents: "stroke", cursor: "pointer" }}
                  onMouseEnter={() => setHoverEdge(edge.key)}
                  onMouseLeave={() => setHoverEdge((k) => (k === edge.key ? null : k))}
                  onClick={(event) => {
                    event.stopPropagation();
                    if (!busy) onDeleteEdge?.(id);
                  }}
                >
                  <title>Eliminar conexión</title>
                </path>
              );
            })}

          {/* Live connector that follows the cursor while a source card is armed. */}
          {editMode && rubber && (
            <path
              d={`M ${rubber.x1} ${rubber.y1} C ${rubber.x1} ${(rubber.y1 + rubber.y2) / 2}, ${rubber.x2} ${(rubber.y1 + rubber.y2) / 2}, ${rubber.x2} ${rubber.y2}`}
              stroke={KIND_COLOR[drawKind]}
              strokeWidth={2}
              strokeDasharray="5 4"
              opacity={0.9}
              markerEnd={`url(#malla-arrow-${drawKind})`}
            />
          )}
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
                    editMode={editMode}
                    armed={armed === course.code}
                    onActivate={handleCardClick}
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
  editMode,
  armed,
  onActivate,
  registerRef,
}: {
  course: CurriculumCourse;
  state: CourseState;
  hasPrereqWarning: boolean;
  dimmed: boolean;
  focused: boolean;
  editMode: boolean;
  armed: boolean;
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
        editMode
          ? armed
            ? "Toca otra materia para conectar, o esta de nuevo para cancelar"
            : "Toca para empezar una conexión desde esta materia"
          : focused
            ? "Toca de nuevo para cambiar el estado"
            : hasPrereqWarning
              ? "Te faltan prerrequisitos para esta materia"
              : stateMeta.label
      }
      className={cn(
        "group relative z-10 flex min-h-36 flex-col overflow-hidden rounded-lg border text-left transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring",
        stateMeta.card,
        editMode && "cursor-copy",
        dimmed && "opacity-30 grayscale",
        focused && "ring-2 ring-primary ring-offset-1 ring-offset-background",
        armed && "ring-2 ring-emerald-500 ring-offset-1 ring-offset-background",
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
