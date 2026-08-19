"use client";

// app/components/GuidedTourGate.tsx
//
// بوابة الجولة التعريفية — بيظهر لأول مستخدم يفتح الداشبورد
// لو ما خلّصهاش قبل كده. الحالة بتتخزن في localStorage.

import { useState, useEffect } from "react";
import { GuidedTour } from "./GuidedTour";
import type { Locale } from "@/lib/i18n/dictionary";

const STORAGE_KEY = "adloop_guided_tour_seen";

interface GuidedTourGateProps {
  locale: Locale;
}

export function GuidedTourGate({ locale }: GuidedTourGateProps) {
  const [show, setShow] = useState(false);

  // 🔴 القراءة محاطةٌ كالكتابة. كانت الكتابة وحدها محروسة، والقراءة مكشوفة -
  // وفي التصفّح الخاصّ أو حين تُمنع ملفّات الارتباط يرمي `getItem` نفسُه،
  // فينهار التأثير قبل أن يبلغ الكتابةَ المحروسة أصلاً.
  function seenBefore(): boolean {
    try {
      return localStorage.getItem(STORAGE_KEY) !== null;
    } catch {
      // تعذّر القراءة: نعرض المحتوى مرّةً بدل أن نمنعه أبداً
      return false;
    }
  }

  useEffect(() => {
    if (!seenBefore()) {
      // تأخير عشان العناصر المستهدفة تتحمّل الأول
      const timer = setTimeout(() => setShow(true), 800);
      return () => clearTimeout(timer);
    }
  }, []);

  if (!show) return null;

  return (
    <GuidedTour
      locale={locale}
      onDismiss={() => {
        setShow(false);
        try {
          localStorage.setItem(STORAGE_KEY, "1");
        } catch {
          // localStorage محظور — لا بأس
        }
      }}
    />
  );
}
