import { Loader2, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

import type { ComponentState, GradeComponentMode, GradeItem } from "../gradebook";
import { useAddItem, useDeleteItem, usePatchComponent, usePatchItem } from "../hooks";

const MODE_LABELS: Record<GradeComponentMode, string> = {
  DIRECT_SCORE: "Nota directa",
  EQUAL_AVERAGE: "Promedio de elementos",
  CUSTOM_WEIGHTS: "Elementos con pesos",
};

export function GradeComponentCard({
  component,
  enrollmentId,
}: {
  component: ComponentState;
  enrollmentId: string;
}) {
  const patchComponent = usePatchComponent(enrollmentId);
  const addItem = useAddItem(enrollmentId);

  const [directScore, setDirectScore] = useState(component.direct_score ?? "");
  useEffect(() => setDirectScore(component.direct_score ?? ""), [component.direct_score]);

  function changeMode(mode: GradeComponentMode) {
    patchComponent.mutate({ componentStateId: component.id, mode });
  }

  function commitDirect() {
    const value = directScore.trim();
    if (value === (component.direct_score ?? "")) return;
    patchComponent.mutate({
      componentStateId: component.id,
      mode: "DIRECT_SCORE",
      direct_score: value === "" ? null : value,
    });
  }

  const score = component.calculated_score;
  const showItems = component.mode !== "DIRECT_SCORE";
  const showWeights = component.mode === "CUSTOM_WEIGHTS";

  return (
    <div className="rounded-xl border border-border/70 bg-background/40 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{component.name}</span>
          <span className="rounded-md bg-muted px-1.5 py-0.5 text-xs tabular-nums text-muted-foreground">
            {Number(component.weight_percent)}%
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Nota</span>
          <span className="min-w-12 rounded-md bg-primary/10 px-2 py-1 text-center text-sm font-semibold tabular-nums text-primary">
            {score ? Number(score).toFixed(2) : "—"}
          </span>
        </div>
      </div>

      <div className="mt-3 flex flex-col gap-3">
        <Select value={component.mode} onValueChange={(v) => changeMode(v as GradeComponentMode)}>
          <SelectTrigger className="h-8 w-full max-w-56 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(MODE_LABELS) as GradeComponentMode[]).map((mode) => (
              <SelectItem key={mode} value={mode}>
                {MODE_LABELS[mode]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {!showItems ? (
          <div className="flex items-end gap-2">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-muted-foreground" htmlFor={`direct-${component.id}`}>
                Nota /20
              </label>
              <Input
                id={`direct-${component.id}`}
                inputMode="decimal"
                value={directScore}
                onChange={(e) => setDirectScore(e.target.value)}
                onBlur={commitDirect}
                placeholder="0.00"
                className="h-9 w-28 tabular-nums"
              />
            </div>
            {patchComponent.isPending && (
              <Loader2 className="mb-2 size-4 animate-spin text-muted-foreground" />
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {component.items.map((item) => (
              <ItemRow
                key={item.id}
                item={item}
                enrollmentId={enrollmentId}
                showWeight={showWeights}
              />
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-fit"
              onClick={() =>
                addItem.mutate({
                  componentStateId: component.id,
                  name: `${component.name} ${component.items.length + 1}`,
                })
              }
              disabled={addItem.isPending}
            >
              {addItem.isPending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
              Agregar elemento
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function ItemRow({
  item,
  enrollmentId,
  showWeight,
}: {
  item: GradeItem;
  enrollmentId: string;
  showWeight: boolean;
}) {
  const patchItem = usePatchItem(enrollmentId);
  const deleteItem = useDeleteItem(enrollmentId);

  const [name, setName] = useState(item.name);
  const [scoreValue, setScoreValue] = useState(item.score ?? "");
  const [weight, setWeight] = useState(item.internal_weight_percent ?? "");

  useEffect(() => setName(item.name), [item.name]);
  useEffect(() => setScoreValue(item.score ?? ""), [item.score]);
  useEffect(() => setWeight(item.internal_weight_percent ?? ""), [item.internal_weight_percent]);

  function commit(patch: { name?: string; score?: string | null; internal_weight_percent?: string | null }) {
    patchItem.mutate({ itemId: item.id, ...patch });
  }

  return (
    <div className="flex items-center gap-2">
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={() => name !== item.name && commit({ name })}
        className={cn("h-9 flex-1")}
        placeholder="Nombre"
      />
      <Input
        inputMode="decimal"
        value={scoreValue}
        onChange={(e) => setScoreValue(e.target.value)}
        onBlur={() =>
          scoreValue !== (item.score ?? "") &&
          commit({ score: scoreValue === "" ? null : scoreValue })
        }
        className="h-9 w-20 tabular-nums"
        placeholder="/20"
      />
      {showWeight && (
        <Input
          inputMode="decimal"
          value={weight}
          onChange={(e) => setWeight(e.target.value)}
          onBlur={() =>
            weight !== (item.internal_weight_percent ?? "") &&
            commit({ internal_weight_percent: weight === "" ? null : weight })
          }
          className="h-9 w-16 tabular-nums"
          placeholder="%"
        />
      )}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-9"
        onClick={() => deleteItem.mutate(item.id)}
        aria-label="Eliminar elemento"
      >
        <Trash2 className="size-4" />
      </Button>
    </div>
  );
}
