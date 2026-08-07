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

/**
 * 🔴 كان الخطّاف يبدّل النصّ ويترك `<html dir>` كما صيّره الخادم.
 *
 * وشاشات الحساب لا جلسة فيها، فيقع الخادم على الافتراضي `dir="rtl" lang="ar"`
 * ثمّ يعرض الخطّاف نصّاً إنجليزياً داخله. النتيجة صفحة إنجليزية مبنيّة يميناً
 * إلى يسار: البطاقة منزاحة عن مركزها، و`rtl:rotate-180` تنقلب على كلّ سهم
 * فيشير «إرسال» إلى الخلف - وهذا بالضبط ما ظهر في زرّ `Send reset link`.
 *
 * الاتّجاه من خصائص اللغة لا زينةً فوقها: من يملك تبديل اللغة يملك تبديل
 * الاتّجاه معها، وإلا انفصل الاثنان حتماً.
 */
function applyDirection(l: Locale) {
  if (typeof document === "undefined") return;
  document.documentElement.dir = l === "ar" ? "rtl" : "ltr";
  document.documentElement.lang = l;
}

export function useAuthLocale(): [Locale, (l: Locale) => void] {
  const [locale, setLocale] = useState<Locale>("en");

  useEffect(() => {
    let next: Locale = "en";
    try {
      if (localStorage.getItem(LOCALE_STORAGE_KEY) === "ar") next = "ar";
    } catch { /* ignore */ }
    setLocale(next);
    applyDirection(next);
  }, []);

  function change(l: Locale) {
    setLocale(l);
    applyDirection(l);
    try { localStorage.setItem(LOCALE_STORAGE_KEY, l); } catch { /* ignore */ }
  }

  return [locale, change];
}
