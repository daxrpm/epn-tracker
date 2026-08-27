import { formatScore } from "@/features/calculators/format";

/**
 * Grade entry accepts "8/10", "14/24" or a bare number.
 *
 * A bare number is resolved against the scale the component already carries, not a hardcoded
 * one: typing "14" into a component graded over 20 used to be rejected as "greater than its
 * scale" because the invisible default was /10.
 */
export const FALLBACK_SCORE_SCALE = "10";

export interface ParsedScore {
  score: string;
  scale: string;
}

const DECIMAL_PATTERN = /^\d+(?:[.,]\d{1,2})?$/;
const SCORE_DRAFT_PATTERN = /^\d*(?:[.,]\d{0,2})?(?:\/\d*(?:[.,]\d{0,2})?)?$/;

/** Allows only a non-negative decimal draft with at most two decimal places. */
export function isDecimalDraft(value: string): boolean {
  return /^\d*(?:[.,]\d{0,2})?$/.test(value);
}

/** Allows a score draft such as `9.25/10` while limiting both values to two decimals. */
export function isScoreInputDraft(value: string): boolean {
  return SCORE_DRAFT_PATTERN.test(value);
}

function toNumber(value: string): number {
  return Number(value.replace(",", "."));
}

/**
 * User-facing validation for a score and its scale.
 *
 * An empty string is valid and means "no grade yet": clearing a field has to be a way back to
 * ungraded, not an error the user cannot escape.
 */
export function scoreInputError(
  text: string,
  defaultScale: string = FALLBACK_SCORE_SCALE,
): string | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  const parts = trimmed.split("/");
  if (parts.length > 2 || !DECIMAL_PATTERN.test(parts[0])) {
    return "Usa números positivos con máximo 2 decimales.";
  }
  const rawScale = parts[1];
  if (rawScale !== undefined && !DECIMAL_PATTERN.test(rawScale)) {
    return "La escala debe ser un número positivo con máximo 2 decimales.";
  }

  const score = toNumber(parts[0]);
  const scale = toNumber(rawScale ?? defaultScale);
  if (!(scale > 0)) return "La escala debe ser mayor que 0.";
  if (score > scale) return `La nota no puede ser mayor que ${formatScore(String(scale))}.`;
  return null;
}

/**
 * Parses "9/10", "14/24" or a bare "14" into a score/scale pair.
 * Returns null for empty input, which the caller should send as an explicit `null` score.
 */
export function parseScoreInput(
  text: string,
  defaultScale: string = FALLBACK_SCORE_SCALE,
): ParsedScore | null {
  const trimmed = text.trim();
  if (!trimmed || scoreInputError(trimmed, defaultScale)) return null;

  const [rawScore, rawScale] = trimmed.split("/");
  return {
    score: rawScore.trim().replace(",", "."),
    scale: (rawScale?.trim() ?? defaultScale).replace(",", "."),
  };
}

/** Renders a score/scale pair as "9/10", trimming trailing decimal zeroes on both sides. */
export function formatScoreScale(score: string | null, scale: string | null): string {
  if (score === null || score === "") return "";
  return `${formatScore(score)}/${formatScore(scale ?? FALLBACK_SCORE_SCALE)}`;
}

/**
 * Mirrors the backend's normalization: rescales a raw score onto the standard /20 scale.
 *
 * A zero scale returns null rather than silently falling back to /20 — `Number(scale) || 20`
 * treated "0" as "unset" and reported a wrong grade with no warning, which is the same defect
 * the domain layer had in `normalize_score`.
 */
export function normalizeTo20(score: string | null, scale: string | null): number | null {
  if (score === null || score === "") return null;
  const raw = Number(score);
  const resolved = scale === null || scale === "" ? 20 : Number(scale);
  if (Number.isNaN(raw) || Number.isNaN(resolved) || resolved <= 0) return null;
  return (raw * 20) / resolved;
}
