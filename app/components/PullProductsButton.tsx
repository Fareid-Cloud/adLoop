"use client";

// app/components/PullProductsButton.tsx
//
// **زرٌّ يجلب منتجات المتجر الآن.**
//
// الحاجة إليه من مشهدٍ واحد: تاجرٌ ربط متجره للتوّ، ففتح «المنتجات»
// فوجدها فارغةً ودعوةً لإضافة منتجٍ يدوياً - وفي متجره مئة صنف. الدورة
// الليلية ستملؤها، لكنّه لا يعرف ذلك، فيقرأ الفراغ عطلاً في الربط.
//
// ويقول الزرّ ما لا يفعله كذلك: التكلفة والشحن والرسوم التي أدخلها هنا
// لا يمسّها السحب. ومن غير هذه الجملة يتردّد قبل الضغط - وهو محقّ.

import { useState } from "react";
import { DownloadCloud, Loader2 } from "lucide-react";
import { getCsrfHeader } from "@/lib/csrfClient";
import { t, type Locale } from "@/lib/i18n/dictionary";

export function PullProductsButton({
  workspaceId,
  locale,
  variant = "secondary",
}: {
  workspaceId: string;
  locale: Locale;
  variant?: "primary" | "secondary";
}) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const tr = (k: string, v?: Record<string, string | number>) => t(locale, `productSync.${k}`, v);

  async function run() {
    setBusy(true);
    setNote(null);
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/product-sync`, {
        method: "POST",
        headers: getCsrfHeader(),
      });
      const data = await res.json().catch(() => null);

      // 🔴 **الفشل يُقال بسببه لا بكلمة «فشل».** المسار يُعيد سبب كلّ متجرٍ
      // مفتاحاً، وهنا تُعرَف اللغة فيُترجَم - فيعرف التاجر أنّ التوكن بلا
      // صلاحية قراءة مثلاً، وهي خطوةٌ يقدر عليها.
      const failed = (data?.stores_detail ?? []).find((s: { ok: boolean }) => !s.ok);
      if (failed?.reasonKey) {
        setNote(tr(failed.reasonKey, failed.reasonVars ?? {}));
      } else if (!res.ok || !data?.ok) {
        setNote(tr("psPullFailed"));
      } else if ((data.created ?? 0) + (data.updated ?? 0) === 0) {
        setNote(tr("noneFound"));
      } else {
        setNote(tr("done", { created: data.created ?? 0, updated: data.updated ?? 0 }));
        // الصفحة تُصيَّر في الخادم، فالتحديث هو ما يُظهر ما وصل للتوّ.
        setTimeout(() => window.location.reload(), 900);
      }
    } catch {
      setNote(tr("psPullFailed"));
    }
    setBusy(false);
  }

  return (
    <div className="flex flex-col items-start gap-1.5">
      <button
        onClick={run}
        disabled={busy}
        className={`btn ${variant === "primary" ? "btn-primary" : "btn-secondary"}`}
      >
        {busy ? <Loader2 size={14} className="animate-spin" /> : <DownloadCloud size={14} />}
        {busy ? tr("running") : tr("button")}
      </button>
      <p className="max-w-md text-[11.5px] leading-relaxed text-text-faint">
        {note ?? tr("hint")}
      </p>
    </div>
  );
}
