// Polish has three plural forms, not two:
//   1                          -> "1 lead"
//   2-4, 22-24, 32-34, ...     -> "2 leady"      (but NOT 12-14)
//   0, 5-21, 25-31, ..., 12-14 -> "5 leadów"
// Written as explicit arithmetic so it does not depend on the runtime's ICU data; plural.test.ts
// cross-checks it against Intl.PluralRules("pl") for 0..2000. Presentation only.
export type PolishPlural = { one: string; few: string; many: string };

export function pluralPl(n: number, forms: PolishPlural): string {
  if (!Number.isInteger(n)) return forms.many; // counts are integers; anything else reads as the genitive plural
  const abs = Math.abs(n);
  if (abs === 1) return forms.one;
  const last = abs % 10;
  const lastTwo = abs % 100;
  return last >= 2 && last <= 4 && !(lastTwo >= 12 && lastTwo <= 14) ? forms.few : forms.many;
}
