/** Spanish pluralisation for the few countable nouns this app shows. */
export function plural(count: number, singular: string, pluralForm = `${singular}s`): string {
  return count === 1 ? singular : pluralForm;
}

/** "3 créditos" / "1 crédito" — the numeral is rendered by the caller so it can be styled. */
export function creditsLabel(credits: number | string): string {
  const value = Number(credits);
  return `${value} ${plural(value, "crédito")}`;
}
