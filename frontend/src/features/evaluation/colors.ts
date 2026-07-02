/**
 * Heat-map color scale for a /20 grade, mirroring how gradebooks commonly signal performance
 * (red -> tomato -> amber -> green -> bright green). Bands align with the EPN pass threshold
 * (14/20 = 7/10): anything below it reads as red/tomato, at or above trends green.
 */
export interface ScoreTone {
  text: string;
  bg: string;
  border: string;
}

const NO_SCORE: ScoreTone = {
  text: "text-muted-foreground",
  bg: "bg-muted",
  border: "border-border",
};

const BANDS: { max: number; tone: ScoreTone }[] = [
  {
    max: 10, // < 5/10
    tone: { text: "text-red-700 dark:text-red-400", bg: "bg-red-500/15", border: "border-red-500/40" },
  },
  {
    max: 14, // 5-7/10
    tone: {
      text: "text-[#e0532f] dark:text-[#ff8566]",
      bg: "bg-[#ff6347]/15",
      border: "border-[#ff6347]/40",
    },
  },
  {
    max: 16, // 7-8/10
    tone: {
      text: "text-amber-600 dark:text-amber-400",
      bg: "bg-amber-500/15",
      border: "border-amber-500/40",
    },
  },
  {
    max: 18, // 8-9/10
    tone: {
      text: "text-green-700 dark:text-green-400",
      bg: "bg-green-600/15",
      border: "border-green-600/40",
    },
  },
];

const TOP_TONE: ScoreTone = {
  // 9-10/10
  text: "text-emerald-600 dark:text-emerald-400",
  bg: "bg-emerald-500/15",
  border: "border-emerald-500/40",
};

export function scoreTone(score20: number | null): ScoreTone {
  if (score20 === null || Number.isNaN(score20)) return NO_SCORE;
  for (const band of BANDS) {
    if (score20 < band.max) return band.tone;
  }
  return TOP_TONE;
}
