import { Check, Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

import { type CourseOption, searchCourses } from "../api";

interface Props {
  value: CourseOption | null;
  onChange: (course: CourseOption | null) => void;
  placeholder?: string;
}

/** Debounced search combobox over catalog courses (materias). */
export function CoursePicker({ value, onChange, placeholder }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CourseOption[]>([]);
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    const handle = setTimeout(() => {
      void searchCourses(query).then(setResults);
    }, 250);
    return () => clearTimeout(handle);
  }, [query]);

  useEffect(() => {
    const onClickOutside = (event: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  if (value) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-lg border border-input bg-transparent px-3 py-2">
        <span className="min-w-0 truncate text-sm">
          <span className="font-medium">{value.code}</span> · {value.name}
        </span>
        <button
          type="button"
          onClick={() => onChange(null)}
          className="shrink-0 text-muted-foreground hover:text-foreground"
          aria-label="Cambiar materia"
        >
          <X className="size-4" />
        </button>
      </div>
    );
  }

  return (
    <div ref={boxRef} className="relative">
      <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder ?? "Buscar materia por código o nombre"}
        className="h-9 pl-8"
      />
      {open && results.length > 0 && (
        <ul className="absolute z-50 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-border bg-popover p-1 shadow-lg">
          {results.map((course) => (
            <li key={course.id}>
              <button
                type="button"
                onClick={() => {
                  onChange(course);
                  setOpen(false);
                  setQuery("");
                }}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm transition-colors hover:bg-muted",
                )}
              >
                <Check className="size-3.5 shrink-0 opacity-0" />
                <span className="min-w-0 truncate">
                  <span className="font-medium">{course.code}</span> · {course.name}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
