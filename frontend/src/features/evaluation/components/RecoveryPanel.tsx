import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDecimal } from "@/features/calculators/format";
import { cn } from "@/lib/utils";

import { useSetRecoveryScore } from "../hooks";
import { isDecimalDraft } from "../scoreInput";

/**
 * The makeup exam ("suple"), scored over 40.
 *
 * This is the flow the landing page advertises and the app could not complete: it told you the
 * minimum you needed and then had nowhere to record what you actually got.
 */
export function RecoveryPanel({
  enrollmentId,
  recoveryScore,
  required,
  passed,
  effectiveFinal40,
}: {
  enrollmentId: string;
  recoveryScore: string | null;
  required: string | null;
  passed: boolean | null;
  effectiveFinal40: string;
}) {
  const setRecovery = useSetRecoveryScore(enrollmentId);
  const [text, setText] = useState(recoveryScore ?? "");

  useEffect(() => setText(recoveryScore ?? ""), [recoveryScore]);

  async function save() {
    const trimmed = text.trim();
    if (!trimmed) {
      toast.error("Escribe la nota que sacaste, sobre 40.");
      return;
    }
    const value = Number(trimmed.replace(",", "."));
    if (Number.isNaN(value) || value < 0 || value > 40) {
      toast.error("La nota de recuperación va de 0 a 40.");
      return;
    }
    await setRecovery.mutateAsync(trimmed.replace(",", "."));
    toast.success("Nota de recuperación guardada.");
  }

  async function clear() {
    await setRecovery.mutateAsync(null);
    toast.success("Se quitó la nota de recuperación.");
  }

  const decided = recoveryScore != null && passed != null;

  return (
    <section
      aria-labelledby="recuperacion"
      className={cn(
        "flex flex-col gap-3 rounded-md border p-4",
        decided
          ? passed
            ? "border-state-passed/40 bg-state-passed-soft"
            : "border-state-failed/40 bg-state-failed-soft"
          : "border-state-annulled/40 bg-state-annulled-soft",
      )}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="recuperacion" className="font-heading text-base font-semibold">
          Recuperación (suple)
        </h2>
        {required && !decided && (
          <p className="text-sm">
            Necesitas al menos{" "}
            <span className="grade font-semibold">{formatDecimal(required)}/40</span>
          </p>
        )}
      </div>

      {decided ? (
        <p className="text-sm">
          {passed ? (
            <>
              Aprobaste con{" "}
              <span className="grade font-semibold">{formatDecimal(recoveryScore)}/40</span> en
              el suple. Tu nota final es{" "}
              <span className="grade font-semibold">{formatDecimal(effectiveFinal40)}/40</span>.
            </>
          ) : (
            <>
              Con <span className="grade font-semibold">{formatDecimal(recoveryScore)}/40</span>{" "}
              no alcanza: hace falta 24/40 en el suple y un promedio de 24/40.
            </>
          )}
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">
          Tu nota ordinaria quedó entre 18 y 28 sobre 40, así que vas a recuperación. Anota aquí
          la nota cuando la tengas.
        </p>
      )}

      <div className="flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1">
          <label htmlFor="recovery-score" className="text-xs text-muted-foreground">
            Nota del suple (sobre 40)
          </label>
          <Input
            id="recovery-score"
            inputMode="decimal"
            value={text}
            onChange={(event) =>
              isDecimalDraft(event.target.value) && setText(event.target.value)
            }
            onKeyDown={(event) => {
              if (event.key === "Enter") void save();
            }}
            placeholder="26"
            className="grade w-24"
          />
        </div>
        <Button size="sm" onClick={() => void save()} disabled={setRecovery.isPending}>
          {setRecovery.isPending && <Loader2 className="animate-spin" />}
          Guardar
        </Button>
        {recoveryScore != null && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void clear()}
            disabled={setRecovery.isPending}
          >
            Quitar
          </Button>
        )}
      </div>
    </section>
  );
}
