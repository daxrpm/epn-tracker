import { Loader2, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
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
import { ApiError } from "@/lib/api/types";
import { cn } from "@/lib/utils";

import type { Contribution, EvaluationType, SchemeComponentInput, SchemeVisibility } from "../api";
import { CONTRIBUTION_LABELS, CONTRIBUTION_ORDER } from "../constants";
import { useCreateScheme } from "../hooks";

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

/** Default rows so a new scheme starts with a sensible, valid-ish shape per bimestre. */
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
  const [title, setTitle] = useState(defaultTitle);
  const [visibility, setVisibility] = useState<SchemeVisibility>("COMMUNITY");
  const [rows, setRows] = useState<Record<Contribution, Row[]>>(defaultRows);

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

  const bothSumTo100 = CONTRIBUTION_ORDER.every((c) => Math.round(sums[c]) === 100);

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

  async function submit() {
    const components: SchemeComponentInput[] = CONTRIBUTION_ORDER.flatMap((c) =>
      rows[c]
        .filter((r) => r.name.trim() !== "")
        .map((r, index) => ({
          contribution: c,
          name: r.name.trim(),
          weight_percent: r.weight_percent || "0",
          evaluation_type: r.evaluation_type,
          display_order: index,
        })),
    );
    try {
      const result = await createScheme.mutateAsync({
        course_id: courseId,
        title: title.trim() || defaultTitle,
        visibility,
        components,
      });
      if (result.warnings.length > 0) {
        toast.warning(result.warnings[0].message);
      }
      toast.success("Esquema creado.");
      onCreated(result.id);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "No se pudo crear el esquema.");
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="scheme-title">Nombre del esquema</Label>
          <Input
            id="scheme-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ej. GR1 · Ing. Pérez · 2026-A"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Visibilidad</Label>
          <Select value={visibility} onValueChange={(v) => setVisibility(v as SchemeVisibility)}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="COMMUNITY">Comunidad (requiere 3 aprobaciones)</SelectItem>
              <SelectItem value="PRIVATE">Privado (solo para ti)</SelectItem>
            </SelectContent>
          </Select>
        </div>
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
                    onChange={(e) => updateRow(c, row.key, { weight_percent: e.target.value })}
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
                  Math.round(sums[c]) === 100 ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400",
                )}
              >
                Suma: {sums[c]}%
              </span>
            </div>
          </TabsContent>
        ))}
      </Tabs>

      <div className="flex items-center justify-end gap-3">
        {!bothSumTo100 && (
          <span className="text-xs text-muted-foreground">
            Cada bimestre debe sumar 100%.
          </span>
        )}
        <Button onClick={() => void submit()} disabled={!bothSumTo100 || createScheme.isPending}>
          {createScheme.isPending && <Loader2 className="size-4 animate-spin" />}
          Crear esquema
        </Button>
      </div>
    </div>
  );
}
