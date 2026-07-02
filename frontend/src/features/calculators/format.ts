/** Remove insignificant decimal zeroes without converting an API decimal string to float. */
export function formatScore(value: string): string {
  if (!value.includes(".")) return value;
  return value.replace(/0+$/, "").replace(/\.$/, "");
}

/**
 * Rounds a numeric value/string to at most `maxDecimals` places and trims trailing zeroes.
 * Unlike ``formatScore``, this actually rounds — use it for anything that might arrive
 * un-rounded (e.g. a division result), not just server-formatted decimal strings.
 */
export function formatDecimal(value: string | number | null, maxDecimals = 2): string {
  if (value === null) return "—";
  const num = typeof value === "string" ? Number(value) : value;
  if (Number.isNaN(num)) return "—";
  return num.toFixed(maxDecimals).replace(/\.?0+$/, "");
}
