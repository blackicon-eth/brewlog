// Pure lookup helpers over the dictionaries. No React, no Expo.
import type { Dict } from "./en";

export type Locale = "en" | "it";

type PluralLeaf = { one: string; other: string };

// Dot-path unions derived from the dictionary shape: TranslationKey addresses string
// leaves, PluralKey addresses { one, other } leaves.
type StringPaths<T, P extends string = ""> = {
  [K in keyof T & string]: T[K] extends string
    ? `${P}${K}`
    : T[K] extends PluralLeaf
      ? never
      : StringPaths<T[K], `${P}${K}.`>;
}[keyof T & string];
type PluralPaths<T, P extends string = ""> = {
  [K in keyof T & string]: T[K] extends string
    ? never
    : T[K] extends PluralLeaf
      ? `${P}${K}`
      : PluralPaths<T[K], `${P}${K}.`>;
}[keyof T & string];

export type TranslationKey = StringPaths<Dict>;
export type PluralKey = PluralPaths<Dict>;

function lookup(dict: Dict, key: string): unknown {
  return key.split(".").reduce<unknown>(
    (node, part) => (node != null && typeof node === "object" ? (node as Record<string, unknown>)[part] : undefined),
    dict,
  );
}

function interpolate(s: string, vars?: Record<string, string | number>): string {
  if (!vars) return s;
  let out = s;
  for (const [name, v] of Object.entries(vars)) out = out.split(`{${name}}`).join(String(v));
  return out;
}

// Missing keys return the key itself — a visible-but-harmless fallback that never
// throws mid-render.
export function t(dict: Dict, key: TranslationKey, vars?: Record<string, string | number>): string {
  const raw = lookup(dict, key);
  return interpolate(typeof raw === "string" ? raw : key, vars);
}

export function tn(dict: Dict, key: PluralKey, n: number): string {
  const raw = lookup(dict, key) as PluralLeaf | undefined;
  if (!raw || typeof raw.one !== "string") return key;
  return interpolate(n === 1 ? raw.one : raw.other, { n });
}

// Device locale ("it-IT", "en-US", …) → supported app locale.
export function resolveLocale(deviceLocale: string | null | undefined): Locale {
  return deviceLocale?.toLowerCase().split("-")[0] === "it" ? "it" : "en";
}
