// Form helpers: text field → stored value.
export function parseRecipeNumber(input: string): number | null {
  const t = input.trim();
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export function normalizeRecipeText(input: string): string | null {
  const t = input.trim();
  return t === "" ? null : t;
}
