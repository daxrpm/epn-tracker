import { formatScore } from "@/features/calculators/format";

/** Default scale used when a student types a bare number with no "/scale" (ERS §17.6). */
export const DEFAULT_SCORE_SCALE = "10";

export interface ParsedScore {
  score: string;
  scale: string;
}

/**
 * Parses "9/10", "14/24" or a bare "14" (defaults to /10) into a score/scale pair.
 * Returns null for empty or unparsable input.
 */
export function parseScoreInput(text: string): ParsedScore | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  const [rawScore, rawScale] = trimmed.split("/");
  const score = rawScore?.trim() ?? "";
  if (score === "" || Number.isNaN(Number(score))) return null;

  const scale = rawScale?.trim();
  if (scale && !Number.isNaN(Number(scale)) && Number(scale) > 0) {
    return { score, scale };
  }
  return { score, scale: DEFAULT_SCORE_SCALE };
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
