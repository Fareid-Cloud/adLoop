"use client";

// قاعدة اللغة في شاشات الحساب: **الإنجليزية هي الافتراضية دائماً**، ولا
// نتحوّل للعربية إلا إذا اختارها المستخدم صراحةً (محفوظة في localStorage،
// ولاحقاً من تفضيلات حسابه بعد الدخول).
//
// سبب المشكلة سابقاً: كنا نستنتج اللغة من navigator.language، فيظهر عربي
// لمستخدم واجهته إنجليزية = خلط لغتين. الاستنتاج أُلغي نهائياً.

import { useEffect, useState } from "react";
import type { Locale } from "@/lib/i18n/dictionary";

export const LOCALE_STORAGE_KEY = "adloop-locale";

export function useAuthLocale(): [Locale, (l: Locale) => void] {
  const [locale, setLocale] = useState<Locale>("en");

  useEffect(() => {
    try {
      if (localStorage.getItem(LOCALE_STORAGE_KEY) === "ar") setLocale("ar");
    } catch { /* ignore */ }
  }, []);

  function change(l: Locale) {
    setLocale(l);
    try { localStorage.setItem(LOCALE_STORAGE_KEY, l); } catch { /* ignore */ }
  }

  return [locale, change];
}
