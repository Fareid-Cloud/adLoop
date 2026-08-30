"use client";

// **زرّ «ارجع لمساحتك» - يبدّل المساحة فعلاً.**
//
// كان الرابط في شارة الديمو يشير إلى `/dashboard` مباشرةً، والمساحة النشطة
// كوكي على الخادم لا مسار: فالضغطة تنتقل إلى الصفحة نفسها التي هو فيها،
// وتُقرأ المساحة التجريبية من جديد، ولا يتغيّر شيء على الشاشة. زرٌّ يقول
// إنّه يُخرجك ولا يُخرجك.
//
// التبديل هنا يمرّ بـ`/api/workspaces/active` (وهو يتحقّق من الملكية)، ثمّ
// **تحميلٌ كامل لا تنقّلٌ داخل العميل**: الكوكي تُقرأ على الخادم عند بناء
// الصفحة، والتنقّل داخل العميل قد يعيد استعمال ما صُيِّر بالمساحة القديمة.

import { useState } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { t, type Locale } from "@/lib/i18n/dictionary";

export function SwitchWorkspaceButton({
  workspaceId,
  label,
  locale,
  className = "btn btn-primary",
}: {
  workspaceId: string;
  label: string;
  locale: Locale;
  className?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function go() {
    if (busy) return;
    setBusy(true);
    setError(null);

    const res = await fetch("/api/workspaces/active", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspaceId }),
    }).catch(() => null);

    // 🔴 لا انتقال إلّا بعد نجاحٍ مؤكَّد: الانتقال على كلّ حال يعيد المستخدم
    // إلى المساحة نفسها بلا تفسير، فيبدو الزرّ معطّلاً وهو يعمل - والسبب
    // (شبكة، أو مساحة حُذفت) لا يظهر له أبداً.
    if (!res?.ok) {
      setBusy(false);
      setError(t(locale, "setup.syncFailed"));
      return;
    }

    window.location.assign("/dashboard");
  }

  return (
    <>
      <button type="button" onClick={go} disabled={busy} className={className}>
        {busy ? (
          <Loader2 size={14} className="animate-spin" />
        ) : (
          <ArrowLeft size={14} className="ltr:rotate-180" />
        )}
        {label}
      </button>
      {error && (
        <p className="mt-1.5 text-[11.5px] leading-relaxed text-critical">{error}</p>
      )}
    </>
  );
}
