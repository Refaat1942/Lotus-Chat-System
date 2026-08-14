import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { en, type TranslationDict } from "./en";
import { ar } from "./ar";

export type Lang = "en" | "ar";

const STORAGE_KEY = "fratelanza_lang";

const dictionaries: Record<Lang, TranslationDict> = { en, ar };

function getNested(obj: Record<string, unknown>, path: string): string | undefined {
  const parts = path.split(".");
  let cur: unknown = obj;
  for (const p of parts) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[p];
  }
  return typeof cur === "string" ? cur : undefined;
}

interface LocaleContextValue {
  lang: Lang;
  dir: "ltr" | "rtl";
  setLang: (lang: Lang) => void;
  t: (key: string, params?: Record<string, string>) => string;
  localized: (enText: string, arText: string) => string;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    if (typeof window === "undefined") return "en";
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === "ar" ? "ar" : "en";
  });

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    localStorage.setItem(STORAGE_KEY, next);
  }, []);

  const dir = lang === "ar" ? "rtl" : "ltr";

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = dir;
  }, [lang, dir]);

  const t = useCallback(
    (key: string, params?: Record<string, string>) => {
      let text =
        getNested(dictionaries[lang] as unknown as Record<string, unknown>, key) ??
        getNested(en as unknown as Record<string, unknown>, key) ??
        key;
      if (params) {
        for (const [k, v] of Object.entries(params)) {
          text = text.replace(new RegExp(`\\{\\{${k}\\}\\}`, "g"), v);
        }
      }
      return text;
    },
    [lang],
  );

  const localized = useCallback(
    (enText: string, arText: string) => (lang === "ar" && arText.trim() ? arText : enText),
    [lang],
  );

  const value = useMemo(
    () => ({ lang, dir, setLang, t, localized }),
    [lang, dir, setLang, t, localized],
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error("useLocale must be used within LocaleProvider");
  return ctx;
}

export function useT() {
  return useLocale().t;
}
