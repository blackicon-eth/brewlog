import React, { createContext, useContext, useMemo } from "react";
import { en, type Dict } from "../lib/i18n/en";
import { it } from "../lib/i18n/it";
import {
  t as tBase, tn as tnBase, resolveLocale,
  type Locale, type TranslationKey, type PluralKey,
} from "../lib/i18n/t";
import { usePersistedState } from "../hooks/usePersistedState";

const DICTS: Record<Locale, Dict> = { en, it };

export type I18n = {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string;
  tn: (key: PluralKey, n: number) => string;
  dict: Dict;
};

const I18nContext = createContext<I18n | null>(null);

// App language: persisted choice, first launch follows the device (Hermes ships Intl
// on Android — no expo-localization). Changing it re-renders the whole mounted tree,
// so the always-mounted tabs pick the new language up live.
export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocale] = usePersistedState<Locale>(
    "settings:locale",
    resolveLocale(Intl.DateTimeFormat().resolvedOptions().locale),
  );
  const value = useMemo<I18n>(() => ({
    locale,
    setLocale,
    t: (key, vars) => tBase(DICTS[locale], key, vars),
    tn: (key, n) => tnBase(DICTS[locale], key, n),
    dict: DICTS[locale],
  }), [locale, setLocale]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18n {
  const v = useContext(I18nContext);
  if (!v) throw new Error("useI18n must be used inside LocaleProvider");
  return v;
}
