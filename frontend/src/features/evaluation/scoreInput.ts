import { formatScore } from "@/features/calculators/format";

/** Default scale used when a student types a bare number with no "/scale" (ERS §17.6). */
export const DEFAULT_SCORE_SCALE = "10";

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

/** User-facing validation for a score and its scale. */
export function scoreInputError(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed) return "Ingresa una nota.";
  const parts = trimmed.split("/");
  if (parts.length > 2 || !DECIMAL_PATTERN.test(parts[0])) {
    return "Usa números positivos con máximo 2 decimales.";
  }
  const rawScale = parts[1];
  if (rawScale !== undefined && !DECIMAL_PATTERN.test(rawScale)) {
    return "La escala debe ser un número positivo con máximo 2 decimales.";
  }
  const score = Number(parts[0].replace(",", "."));
  const scale = Number((rawScale ?? DEFAULT_SCORE_SCALE).replace(",", "."));
  if (scale <= 0) return "La escala debe ser mayor que 0.";
  if (score > scale) return "La nota no puede ser mayor que su escala.";
  return null;
}

/**
 * Parses "9/10", "14/24" or a bare "14" (defaults to /10) into a score/scale pair.
 * Returns null for empty or unparsable input.
 */
export function parseScoreInput(text: string): ParsedScore | null {
  const trimmed = text.trim();
  if (scoreInputError(trimmed)) return null;

  const [rawScore, rawScale] = trimmed.split("/");
  const score = rawScore.trim().replace(",", ".");

  const scale = rawScale?.trim().replace(",", ".") ?? DEFAULT_SCORE_SCALE;
  return { score, scale };
}

/** Renders a score/scale pair as "9/10", trimming trailing decimal zeros on both sides. */
export function formatScoreScale(score: string | null, scale: string | null): string {
  if (score === null || score === "") return "";
  return `${formatScore(score)}/${formatScore(scale ?? DEFAULT_SCORE_SCALE)}`;
}

/** Mirrors the backend's normalization: rescales a raw score to the standard /20 scale. */
export function normalizeTo20(score: string | null, scale: string | null): number | null {
  if (score === null || score === "") return null;
  const raw = Number(score);
  const sc = Number(scale) || 20;
  if (Number.isNaN(raw) || sc === 0) return null;
  return (raw * 20) / sc;
}
