// ═══════════════════════════════════════════════════════════
//  I18nProvider — React context for language switching (FEAT-012)
// ═══════════════════════════════════════════════════════════

"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { locales, localeNames, type Locale, type LocaleMessages } from "./locales";

const STORAGE_KEY = "evon_locale";

interface I18nContextValue {
  locale: Locale;
  t: LocaleMessages;
  setLocale: (locale: Locale) => void;
}

const I18nContext = createContext<I18nContextValue>({
  locale: "en",
  t: locales.en,
  setLocale: () => {},
});

export function useI18n() {
  return useContext(I18nContext);
}

function detectBrowserLocale(): Locale {
  if (typeof navigator === "undefined") return "en";
  const lang = navigator.language.split("-")[0];
  return (lang as Locale) in locales ? (lang as Locale) : "en";
}

function loadPersistedLocale(): Locale {
  if (typeof window === "undefined") return "en";
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && stored in locales) return stored as Locale;
  } catch {}
  return detectBrowserLocale();
}

export default function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(loadPersistedLocale);

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    try {
      localStorage.setItem(STORAGE_KEY, newLocale);
    } catch {}
    document.documentElement.lang = newLocale;
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const value: I18nContextValue = {
    locale,
    t: locales[locale],
    setLocale,
  };

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export { localeNames };
export type { Locale };
