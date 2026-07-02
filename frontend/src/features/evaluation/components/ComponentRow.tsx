import { ChevronDown, ChevronRight, Loader2, Plus, Trash2 } from "lucide-react";
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
import { TableCell, TableRow } from "@/components/ui/table";
import { formatScore } from "@/features/calculators/format";
import { cn } from "@/lib/utils";

import { scoreTone } from "../colors";
import type { ComponentState, GradeComponentMode, GradeItem } from "../gradebook";
import { useAddItem, useDeleteItem, usePatchComponent, usePatchItem } from "../hooks";
import { formatScoreScale, normalizeTo20, parseScoreInput } from "../scoreInput";

const MODE_LABELS: Record<GradeComponentMode, string> = {
  DIRECT_SCORE: "Nota directa",
  EQUAL_AVERAGE: "Promedio",
  CUSTOM_WEIGHTS: "Con pesos",
};

/** A single evaluation component as a table row; item details expand below on demand. */
export function ComponentRow({
  component,
  enrollmentId,
}: {
  component: ComponentState;
  enrollmentId: string;
}) {
  const patchComponent = usePatchComponent(enrollmentId);
  const [expanded, setExpanded] = useState(false);
  const usesItems = component.mode !== "DIRECT_SCORE";

  const notaValue = component.calculated_score ? Number(component.calculated_score) : null;
  const tone = scoreTone(notaValue);

  function changeMode(mode: GradeComponentMode) {
    patchComponent.mutate({ componentStateId: component.id, mode });
    if (mode !== "DIRECT_SCORE") setExpanded(true);
  }

  function commitDirect(text: string) {
    const parsed = parseScoreInput(text);
    patchComponent.mutate({
      componentStateId: component.id,
      mode: "DIRECT_SCORE",
      direct_score: parsed?.score ?? null,
      direct_score_scale: parsed?.scale ?? null,
    });
  }

  return (
    <>
      <TableRow className={usesItems ? "cursor-pointer" : undefined} onClick={usesItems ? () => setExpanded((v) => !v) : undefined}>
        <TableCell className="max-w-48 whitespace-normal">
          <div className="flex items-center gap-2">
            {usesItems ? (
              expanded ? (
                <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
              ) : (
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
              )
            ) : (
              <span className="size-4 shrink-0" />
            )}
            <div>
              <p className="text-sm font-medium leading-tight">{component.name}</p>
              <p className="text-xs text-muted-foreground">{Number(component.weight_percent)}%</p>
            </div>
          </div>
        </TableCell>
        <TableCell onClick={(e) => e.stopPropagation()}>
          <Select value={component.mode} onValueChange={(v) => changeMode(v as GradeComponentMode)}>
            <SelectTrigger className="h-8 w-36 text-xs">
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
        </TableCell>
        <TableCell onClick={(e) => e.stopPropagation()}>
          {usesItems ? (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
            >
              {component.items.length === 0
                ? "Agregar elementos"
                : `${component.items.length} elemento${component.items.length === 1 ? "" : "s"}`}
            </button>
          ) : (
            <DirectScoreInput
              value={component.direct_score}
              scale={component.direct_score_scale}
              onCommit={commitDirect}
              pending={patchComponent.isPending}
            />
          )}
        </TableCell>
        <TableCell>
          <span
            className={cn(
              "inline-flex min-w-14 items-center justify-center rounded-md border px-2 py-1 text-sm font-semibold tabular-nums",
              tone.bg,
              tone.text,
              tone.border,
            )}
          >
            {component.calculated_score ? formatScore(component.calculated_score) : "—"}
          </span>
        </TableCell>
      </TableRow>

      {usesItems && expanded && (
        <TableRow className="hover:bg-transparent">
          <TableCell colSpan={4} className="whitespace-normal bg-background/40 p-3">
            <ItemsPanel component={component} enrollmentId={enrollmentId} />
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

function DirectScoreInput({
  value,
  scale,
  onCommit,
  pending,
}: {
  value: string | null;
  scale: string;
  onCommit: (text: string) => void;
  pending: boolean;
}) {
  const [text, setText] = useState(formatScoreScale(value, scale));
  useEffect(() => setText(formatScoreScale(value, scale)), [value, scale]);

  return (
    <div className="flex items-center gap-1.5">
      <Input
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => {
          if (text.trim() !== formatScoreScale(value, scale)) onCommit(text);
        }}
        placeholder="Ej. 8/10"
        className="h-8 w-24 tabular-nums"
      />
      {pending && <Loader2 className="size-3.5 animate-spin text-muted-foreground" />}
    </div>
  );
}

function ItemsPanel({
  component,
  enrollmentId,
}: {
  component: ComponentState;
  enrollmentId: string;
}) {
  const addItem = useAddItem(enrollmentId);
  const showWeights = component.mode === "CUSTOM_WEIGHTS";

  return (
    <div className="flex flex-col gap-2">
      {component.items.map((item) => (
        <ItemRow key={item.id} item={item} enrollmentId={enrollmentId} showWeight={showWeights} />
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
  const [scoreText, setScoreText] = useState(formatScoreScale(item.score, item.score_scale));
  const [weight, setWeight] = useState(item.internal_weight_percent ?? "");

  useEffect(() => setName(item.name), [item.name]);
  useEffect(
    () => setScoreText(formatScoreScale(item.score, item.score_scale)),
    [item.score, item.score_scale],
  );
  useEffect(() => setWeight(item.internal_weight_percent ?? ""), [item.internal_weight_percent]);

  const normalized20 = normalizeTo20(item.score, item.score_scale);
  const tone = scoreTone(normalized20);

  function commitScore() {
    if (scoreText.trim() === formatScoreScale(item.score, item.score_scale)) return;
    const parsed = parseScoreInput(scoreText);
    patchItem.mutate({
      itemId: item.id,
      score: parsed?.score ?? null,
      score_scale: parsed?.scale ?? undefined,
    });
  }

  return (
    <div className="flex items-center gap-2">
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={() => name !== item.name && patchItem.mutate({ itemId: item.id, name })}
        className="h-8 flex-1"
        placeholder="Nombre"
      />
      <Input
        value={scoreText}
        onChange={(e) => setScoreText(e.target.value)}
        onBlur={commitScore}
        className="h-8 w-20 tabular-nums"
        placeholder="Ej. 8/10"
      />
      {showWeight && (
        <Input
          inputMode="decimal"
          value={weight}
          onChange={(e) => setWeight(e.target.value)}
          onBlur={() =>
            weight !== (item.internal_weight_percent ?? "") &&
            patchItem.mutate({
              itemId: item.id,
              internal_weight_percent: weight === "" ? null : weight,
            })
          }
          className="h-8 w-14 tabular-nums"
          placeholder="%"
        />
      )}
      <span
        className={cn(
          "inline-flex min-w-12 items-center justify-center rounded-md border px-1.5 py-1 text-xs font-semibold tabular-nums",
          tone.bg,
          tone.text,
          tone.border,
        )}
      >
        {normalized20 !== null ? normalized20.toFixed(2) : "—"}
      </span>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-8"
        onClick={() => deleteItem.mutate(item.id)}
        aria-label="Eliminar elemento"
      >
        <Trash2 className="size-4" />
      </Button>
    </div>
  );
}
