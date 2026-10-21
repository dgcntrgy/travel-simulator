"use client";

import { useMemo } from "react";
import { translate, type Locale, type TranslateVars, type TranslationKey } from "@/lib/i18n";
import { useTripStore } from "@/store/useTripStore";

export type T = ((key: TranslationKey, vars?: TranslateVars) => string) & { locale: Locale };

/** Seçili dile bağlı çeviri fonksiyonu: `const t = useT(); t("landing.start")`, `t.locale` */
export function useT(): T {
  const locale = useTripStore((s) => s.locale);
  return useMemo(() => Object.assign((key: TranslationKey, vars?: TranslateVars) => translate(locale, key, vars), { locale }), [locale]);
}
