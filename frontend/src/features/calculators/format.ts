/** Remove insignificant decimal zeroes without converting an API decimal string to float. */
export function formatScore(value: string): string {
  if (!value.includes(".")) return value;
  return value.replace(/0+$/, "").replace(/\.$/, "");
}
