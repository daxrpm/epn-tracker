import { ChevronRight, Loader2, Plus, Trash2 } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatDecimal } from "@/features/calculators/format";
import { cn } from "@/lib/utils";

import type { ComponentState, GradeComponentMode, GradeItem } from "../gradebook";
import { useAddItem, useDeleteItem, usePatchComponent, usePatchItem } from "../hooks";
import {
  formatScoreScale,
  isDecimalDraft,
  isScoreInputDraft,
  normalizeTo20,
  parseScoreInput,
  scoreInputError,
} from "../scoreInput";

const MODE_LABELS: Record<GradeComponentMode, string> = {
  DIRECT_SCORE: "Nota directa",
  EQUAL_AVERAGE: "Promedio de insumos",
  CUSTOM_WEIGHTS: "Insumos con pesos",
};

/**
 * One evaluation component, as a row in a ruled list.
 *
 * This was a clickable `<tr>`, so the expand affordance could not be reached with the keyboard
 * at all. The disclosure is now a real button and the row is a list item.
 */
export function ComponentRow({
  component,
  enrollmentId,
}: {
  component: ComponentState;
  enrollmentId: string;
}) {
  const patchComponent = usePatchComponent(enrollmentId);
  const [expanded, setExpanded] = useState(false);
  const panelId = useId();
  const usesItems = component.mode !== "DIRECT_SCORE";
  const score = component.calculated_score ? Number(component.calculated_score) : null;

  function changeMode(mode: GradeComponentMode) {
    patchComponent.mutate({ componentStateId: component.id, mode });
    if (mode !== "DIRECT_SCORE") setExpanded(true);
  }

  function commitDirect(text: string): boolean {
    const error = scoreInputError(text, component.direct_score_scale);
    if (error) {
      toast.error(error);
      return false;
    }
    // An empty field clears the grade rather than being rejected.
    const parsed = parseScoreInput(text, component.direct_score_scale);
    patchComponent.mutate({
      componentStateId: component.id,
      mode: "DIRECT_SCORE",
      direct_score: parsed?.score ?? null,
      direct_score_scale: parsed?.scale ?? null,
    });
    return true;
  }

  return (
    <li className="bg-card">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3 p-3">
        <div className="flex min-w-48 flex-1 items-center gap-2">
          {usesItems ? (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              aria-expanded={expanded}
              aria-controls={panelId}
              className="flex min-w-0 flex-1 items-center gap-2 rounded-sm text-left"
            >
              <ChevronRight
                className={cn(
                  "size-4 shrink-0 text-muted-foreground transition-transform",
                  expanded && "rotate-90",
                )}
                aria-hidden
              />
              <ComponentLabel component={component} />
            </button>
          ) : (
            <div className="flex min-w-0 flex-1 items-center gap-2 pl-6">
              <ComponentLabel component={component} />
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Select
            value={component.mode}
            onValueChange={(v) => changeMode(v as GradeComponentMode)}
          >
            <SelectTrigger
              className="h-8 w-44 text-xs"
              aria-label={`Modo de cálculo de ${component.name}`}
            >
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

          {usesItems ? (
            <span className="w-24 text-xs text-muted-foreground">
              {component.items.length === 0
                ? "Sin insumos"
                : `${component.items.length} insumo${component.items.length === 1 ? "" : "s"}`}
            </span>
          ) : (
            <DirectScoreInput
              componentName={component.name}
              value={component.direct_score}
              scale={component.direct_score_scale}
              onCommit={commitDirect}
              pending={patchComponent.isPending}
            />
          )}

          <span
            className={cn(
              "grade inline-flex min-w-14 justify-center rounded-sm border border-border px-2 py-1 text-sm",
              score === null && "text-muted-foreground",
            )}
          >
            {score === null ? "—" : formatDecimal(component.calculated_score)}
          </span>
        </div>
      </div>

      {usesItems && expanded && (
        <div id={panelId} className="border-t border-border bg-muted/40 p-3">
          <ItemsPanel component={component} enrollmentId={enrollmentId} />
        </div>
      )}
    </li>
  );
}

function ComponentLabel({ component }: { component: ComponentState }) {
  return (
    <span className="min-w-0">
      <span className="block truncate text-sm font-medium">{component.name}</span>
      <span className="grade block text-xs text-muted-foreground">
        {Number(component.weight_percent)}% del bimestre
      </span>
    </span>
  );
}

function DirectScoreInput({
  componentName,
  value,
  scale,
  onCommit,
  pending,
}: {
  componentName: string;
  value: string | null;
  scale: string;
  onCommit: (text: string) => boolean;
  pending: boolean;
}) {
  const [text, setText] = useState(formatScoreScale(value, scale));
  const id = useId();
  useEffect(() => setText(formatScoreScale(value, scale)), [value, scale]);

  return (
    <div className="flex items-center gap-1.5">
      <label htmlFor={id} className="sr-only">
        Nota de {componentName}
      </label>
      <Input
        id={id}
        inputMode="decimal"
        value={text}
        onChange={(e) => isScoreInputDraft(e.target.value) && setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
        }}
        onBlur={() => {
          if (text.trim() !== formatScoreScale(value, scale) && !onCommit(text)) {
            setText(formatScoreScale(value, scale));
          }
        }}
        placeholder="8/10"
        className="grade h-8 w-24"
      />
      {pending && (
        <Loader2 className="size-3.5 animate-spin text-muted-foreground" aria-hidden />
      )}
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

  function add() {
    // Number from the highest existing suffix rather than the count, so deleting the second of
    // three does not make the next one a duplicate.
    const used = component.items
      .map((item) => Number(item.name.match(/(\d+)$/)?.[1] ?? 0))
      .filter((n) => Number.isFinite(n));
    const next = Math.max(0, ...used) + 1;
    addItem.mutate({
      componentStateId: component.id,
      name: `${component.name} ${next}`,
    });
  }

  return (
    <div className="flex flex-col gap-2">
      {component.items.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Sin insumos todavía. Agrega uno por cada deber, prueba o taller de este componente.
        </p>
      )}
      {component.items.map((item) => (
        <ItemRow
          key={item.id}
          item={item}
          enrollmentId={enrollmentId}
          showWeight={showWeights}
        />
      ))}
      <Button
        variant="outline"
        size="sm"
        className="w-fit"
        onClick={add}
        disabled={addItem.isPending}
      >
        {addItem.isPending ? <Loader2 className="animate-spin" /> : <Plus />}
        Agregar insumo
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
  const ids = { name: useId(), score: useId(), weight: useId() };

  const [name, setName] = useState(item.name);
  const [scoreText, setScoreText] = useState(formatScoreScale(item.score, item.score_scale));
  const [weight, setWeight] = useState(item.internal_weight_percent ?? "");

  useEffect(() => setName(item.name), [item.name]);
  useEffect(
    () => setScoreText(formatScoreScale(item.score, item.score_scale)),
    [item.score, item.score_scale],
  );
  useEffect(
    () => setWeight(item.internal_weight_percent ?? ""),
    [item.internal_weight_percent],
  );

  const normalized20 = normalizeTo20(item.score, item.score_scale);

  function commitScore() {
    if (scoreText.trim() === formatScoreScale(item.score, item.score_scale)) return;
    const error = scoreInputError(scoreText, item.score_scale);
    if (error) {
      toast.error(error);
      setScoreText(formatScoreScale(item.score, item.score_scale));
      return;
    }
    const parsed = parseScoreInput(scoreText, item.score_scale);
    patchItem.mutate({
      itemId: item.id,
      score: parsed?.score ?? null,
      score_scale: parsed?.scale ?? undefined,
    });
  }

  function remove() {
    deleteItem.mutate(item.id, {
      onSuccess: () =>
        // Reversible, so an undo beats a modal: the row comes straight back.
        toast.success(`Se eliminó “${item.name}”.`, {
          action: {
            label: "Deshacer",
            onClick: () =>
              patchItem.mutate({
                itemId: item.id,
                name: item.name,
                score: item.score,
                score_scale: item.score_scale ?? undefined,
              }),
          },
        }),
    });
  }

  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="flex min-w-40 flex-1 flex-col gap-1">
        <label htmlFor={ids.name} className="sr-only">
          Nombre del insumo
        </label>
        <Input
          id={ids.name}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => name !== item.name && patchItem.mutate({ itemId: item.id, name })}
          className="h-8"
          placeholder="Deber 1"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={ids.score} className="sr-only">
          Nota de {item.name}
        </label>
        <Input
          id={ids.score}
          inputMode="decimal"
          value={scoreText}
          onChange={(e) => isScoreInputDraft(e.target.value) && setScoreText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
          }}
          onBlur={commitScore}
          className="grade h-8 w-24"
          placeholder="8/10"
        />
      </div>

      {showWeight && (
        <div className="flex flex-col gap-1">
          <label htmlFor={ids.weight} className="sr-only">
            Peso de {item.name} dentro del componente
          </label>
          <Input
            id={ids.weight}
            inputMode="decimal"
            value={weight}
            onChange={(e) => isDecimalDraft(e.target.value) && setWeight(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
            }}
            onBlur={() => {
              if (weight === (item.internal_weight_percent ?? "")) return;
              if (weight !== "" && Number(weight.replace(",", ".")) > 100) {
                toast.error("El peso de un insumo no puede pasar de 100%.");
                setWeight(item.internal_weight_percent ?? "");
                return;
              }
              patchItem.mutate({
                itemId: item.id,
                internal_weight_percent: weight === "" ? null : weight.replace(",", "."),
              });
            }}
            className="grade h-8 w-16"
            placeholder="%"
          />
        </div>
      )}

      <span
        className={cn(
          "grade inline-flex h-8 min-w-12 items-center justify-center rounded-sm border border-border px-1.5 text-xs",
          normalized20 === null && "text-muted-foreground",
        )}
        title="Nota equivalente sobre 20"
      >
        {normalized20 === null ? "—" : formatDecimal(normalized20)}
      </span>

      <Button
        variant="ghost"
        size="icon-sm"
        onClick={remove}
        disabled={deleteItem.isPending}
        aria-label={`Eliminar ${item.name}`}
      >
        <Trash2 className="size-4" />
      </Button>
    </div>
  );
}
