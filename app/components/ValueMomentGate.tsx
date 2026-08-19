"use client";

// app/components/ValueMomentGate.tsx
//
// بوابة "اللحظة الأولى" — بيظهر بعد أول مزامنة ناجحة لو المستخدم
// ماشافهاش قبل كده. الحالة بتتخزن في localStorage مش عشان نمنع
// العرض نهائياً، بس عشان ما نزّعجش المستخدم في كل تحميل.

import { useState, useEffect } from "react";
import { ValueMoment } from "./ValueMoment";
import type { Locale } from "@/lib/i18n/dictionary";

interface ValueMomentGateProps {
  reportedConversions: number;
  verifiedConversions: number;
  currency?: string;
  locale: Locale;
}

const STORAGE_KEY = "adloop_value_moment_seen";

export function ValueMomentGate({
  reportedConversions,
  verifiedConversions,
  currency,
  locale,
}: ValueMomentGateProps) {
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
    // ما نعرضهاش لو المستخدم شافها قبل كده أو مفيش فجوة حقيقية
    const hasGap = reportedConversions > verifiedConversions && verifiedConversions > 0;

    if (!seenBefore() && hasGap) {
      // تأخير بسيط عشان الصفحة تحمّل الأول
      const timer = setTimeout(() => setShow(true), 1200);
      return () => clearTimeout(timer);
    }
  }, [reportedConversions, verifiedConversions]);

  if (!show) return null;

  return (
    <ValueMoment
      reportedConversions={reportedConversions}
      verifiedConversions={verifiedConversions}
      currency={currency}
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
