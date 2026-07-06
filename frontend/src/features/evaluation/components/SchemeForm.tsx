import { Copy, Loader2, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { findOrCreateProfessor, type Professor } from "@/features/offering/api";
import { useSearchProfessors } from "@/features/offering/hooks";
import { ApiError } from "@/lib/api/types";
import { cn } from "@/lib/utils";

import type { Contribution, EvaluationType, SchemeComponentInput, SchemeVisibility } from "../api";
import { CONTRIBUTION_LABELS, CONTRIBUTION_ORDER } from "../constants";
import { useCreateScheme } from "../hooks";
import { isDecimalDraft } from "../scoreInput";

interface Row {
  key: string;
  name: string;
  weight_percent: string;
  evaluation_type: EvaluationType;
}

let rowCounter = 0;
function newRow(name = "", weight = ""): Row {
  rowCounter += 1;
  return { key: `row-${rowCounter}`, name, weight_percent: weight, evaluation_type: "SUMMATIVE" };
}

/** Default rows so a new course starts with a sensible, valid-ish shape per bimestre. */
function defaultRows(): Record<Contribution, Row[]> {
  return {
    APORTE_1: [newRow("Deberes", "30"), newRow("Pruebas", "35"), newRow("Examen", "35")],
    APORTE_2: [newRow("Deberes", "30"), newRow("Pruebas", "35"), newRow("Examen", "35")],
  };
}

export function SchemeForm({
  courseId,
  defaultTitle,
  onCreated,
}: {
  courseId: string;
  defaultTitle: string;
  onCreated: (schemeId: string) => void;
}) {
  const createScheme = useCreateScheme();
  const [code, setCode] = useState("");
  const [professorQuery, setProfessorQuery] = useState("");
  const [professorId, setProfessorId] = useState<string | null>(null);
  const [visibility, setVisibility] = useState<SchemeVisibility>("COMMUNITY");
  const [rows, setRows] = useState<Record<Contribution, Row[]>>(defaultRows);
  const [resolvingProfessor, setResolvingProfessor] = useState(false);

  const sums = useMemo(
    () =>
      Object.fromEntries(
        CONTRIBUTION_ORDER.map((c) => [
          c,
          rows[c].reduce((sum, r) => sum + (Number(r.weight_percent) || 0), 0),
        ]),
      ) as Record<Contribution, number>,
    [rows],
  );

  const sumIsComplete = (value: number) => value >= 99.99 - Number.EPSILON && value <= 100;
  const bothSumTo100 = CONTRIBUTION_ORDER.every((c) => sumIsComplete(sums[c]));
  const validRows = CONTRIBUTION_ORDER.every((c) =>
    rows[c].every(
      (row) =>
        row.name.trim() !== "" &&
        Number(row.weight_percent.replace(",", ".")) >= 0 &&
        Number(row.weight_percent.replace(",", ".")) <= 35,
    ),
  );
  const canSubmit =
    bothSumTo100 && validRows && code.trim() !== "" && professorQuery.trim() !== "";

  function updateRow(c: Contribution, key: string, patch: Partial<Row>) {
    setRows((prev) => ({
      ...prev,
      [c]: prev[c].map((r) => (r.key === key ? { ...r, ...patch } : r)),
    }));
  }
  function addRow(c: Contribution) {
    setRows((prev) => ({ ...prev, [c]: [...prev[c], newRow()] }));
  }
  function removeRow(c: Contribution, key: string) {
    setRows((prev) => ({ ...prev, [c]: prev[c].filter((r) => r.key !== key) }));
  }
  function copyFirstBimestre() {
    setRows((prev) => ({
      ...prev,
      APORTE_2: prev.APORTE_1.map((row) => ({
        ...newRow(row.name, row.weight_percent),
        evaluation_type: row.evaluation_type,
      })),
    }));
    toast.success("Se copió la configuración del primer bimestre.");
  }

  function selectProfessor(professor: Professor) {
    setProfessorId(professor.id);
    setProfessorQuery(professor.full_name);
  }

  function changeProfessorQuery(value: string) {
    setProfessorQuery(value);
    setProfessorId(null);
  }

  async function submit() {
    const components: SchemeComponentInput[] = CONTRIBUTION_ORDER.flatMap((c) =>
      rows[c]
        .filter((r) => r.name.trim() !== "")
        .map((r, index) => ({
          contribution: c,
          name: r.name.trim(),
          weight_percent: r.weight_percent.replace(",", ".") || "0",
          evaluation_type: r.evaluation_type,
          display_order: index,
        })),
    );
    try {
      let resolvedProfessorId = professorId;
      if (!resolvedProfessorId) {
        setResolvingProfessor(true);
        const professor = await findOrCreateProfessor({
          course_id: courseId,
          full_name: professorQuery.trim(),
        });
        resolvedProfessorId = professor.id;
      }
      const result = await createScheme.mutateAsync({
        course_id: courseId,
        title: code.trim() || defaultTitle,
        professor_id: resolvedProfessorId,
        visibility,
        components,
      });
      if (result.warnings.length > 0) {
        toast.warning(result.warnings[0].message);
      }
      toast.success("Curso creado.");
      onCreated(result.id);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "No se pudo crear el curso.");
    } finally {
      setResolvingProfessor(false);
    }
  }

  const submitting = createScheme.isPending || resolvingProfessor;

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="scheme-code">Código del curso</Label>
          <Input
            id="scheme-code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Ej. GRCC1"
          />
        </div>
        <ProfessorField
          query={professorQuery}
          professorId={professorId}
          onQueryChange={changeProfessorQuery}
          onSelect={selectProfessor}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>Visibilidad</Label>
        <Select value={visibility} onValueChange={(v) => setVisibility(v as SchemeVisibility)}>
          <SelectTrigger className="w-full sm:w-64">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="COMMUNITY">Comunidad (requiere 3 aprobaciones)</SelectItem>
            <SelectItem value="PRIVATE">Privado (solo para ti)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Tabs defaultValue="APORTE_1">
        <TabsList>
          {CONTRIBUTION_ORDER.map((c) => (
            <TabsTrigger key={c} value={c}>
              {CONTRIBUTION_LABELS[c]}
            </TabsTrigger>
          ))}
        </TabsList>
        {CONTRIBUTION_ORDER.map((c) => (
          <TabsContent key={c} value={c} className="mt-4 flex flex-col gap-3">
            {c === "APORTE_2" && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-fit"
                onClick={copyFirstBimestre}
              >
                <Copy className="size-4" /> Copiar primer bimestre
              </Button>
            )}
            {rows[c].map((row) => (
              <div key={row.key} className="flex items-end gap-2">
                <div className="flex flex-1 flex-col gap-1.5">
                  <Label className="text-xs text-muted-foreground">Componente</Label>
                  <Input
                    value={row.name}
                    onChange={(e) => updateRow(c, row.key, { name: e.target.value })}
                    placeholder="Ej. Deberes"
                  />
                </div>
                <div className="flex w-20 flex-col gap-1.5">
                  <Label className="text-xs text-muted-foreground">Peso %</Label>
                  <Input
                    inputMode="decimal"
                    value={row.weight_percent}
                    onChange={(e) =>
                      isDecimalDraft(e.target.value) &&
                      updateRow(c, row.key, { weight_percent: e.target.value })
                    }
                    className="tabular-nums"
                  />
                </div>
                <div className="flex w-32 flex-col gap-1.5">
                  <Label className="text-xs text-muted-foreground">Tipo</Label>
                  <Select
                    value={row.evaluation_type}
                    onValueChange={(v) => updateRow(c, row.key, { evaluation_type: v as EvaluationType })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="FORMATIVE">Formativa</SelectItem>
                      <SelectItem value="SUMMATIVE">Sumativa</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeRow(c, row.key)}
                  aria-label="Eliminar componente"
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
            <div className="flex items-center justify-between">
              <Button type="button" variant="outline" size="sm" onClick={() => addRow(c)}>
                <Plus className="size-4" /> Agregar componente
              </Button>
              <span
                className={cn(
                  "text-sm font-medium tabular-nums",
                  sumIsComplete(sums[c]) ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400",
                )}
              >
                Suma: {sumIsComplete(sums[c]) ? 100 : sums[c]}%
              </span>
            </div>
          </TabsContent>
        ))}
      </Tabs>

      <div className="flex items-center justify-end gap-3">
        {!canSubmit && (
          <span className="text-xs text-muted-foreground">
            {bothSumTo100 && validRows
              ? "Ingresa el código del curso y el profesor."
              : "Cada peso debe estar entre 0 y 35%, con máximo 2 decimales, y cada bimestre debe sumar 100%."}
          </span>
        )}
        <Button onClick={() => void submit()} disabled={!canSubmit || submitting}>
          {submitting && <Loader2 className="size-4 animate-spin" />}
          Crear curso
        </Button>
      </div>
    </div>
  );
}

function ProfessorField({
  query,
  professorId,
  onQueryChange,
  onSelect,
}: {
  query: string;
  professorId: string | null;
  onQueryChange: (value: string) => void;
  onSelect: (professor: Professor) => void;
}) {
  const [debouncedQuery, setDebouncedQuery] = useState(query);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedQuery(query), 250);
    return () => clearTimeout(timeout);
  }, [query]);

  const searchQuery = useSearchProfessors(debouncedQuery);
  const suggestions = professorId ? [] : (searchQuery.data ?? []);

  return (
    <div className="relative flex flex-col gap-1.5">
      <Label htmlFor="scheme-professor">Profesor</Label>
      <Input
        id="scheme-professor"
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="Ej. Enrique Mafla"
        autoComplete="off"
      />
      {open && suggestions.length > 0 && (
        <div className="absolute top-full z-10 mt-1 w-full overflow-hidden rounded-lg border border-border bg-popover shadow-md">
          {suggestions.map((professor) => (
            <button
              key={professor.id}
              type="button"
              className="block w-full px-3 py-2 text-left text-sm hover:bg-accent"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onSelect(professor);
                setOpen(false);
              }}
            >
              {professor.full_name}
            </button>
          ))}
        </div>
      )}
      {!professorId && query.trim() !== "" && !open && (
        <p className="text-[11px] text-muted-foreground">
          Se registrará como un profesor nuevo si no existe todavía.
        </p>
      )}
    </div>
  );
}
