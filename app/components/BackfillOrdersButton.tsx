"use client";

// app/components/BackfillOrdersButton.tsx
//
// **زرٌّ يجلب تاريخ الطلبات السابق على الربط.**
//
// من ربط متجره اليوم يرى صفراً في كلّ صفحة حتى يصل أوّل طلبٍ جديد -
// والمنتج كلّه يقيس ماضياً: الربح، المرتجعات، العميل المتكرّر، اتّجاه
// التكلفة. فالأسبوع الأوّل يجعله يبدو أعمى وهو سليم.
//
// وهو زرٌّ بقرارٍ لا بضغطة: العملية تلمس تاريخ الحساب كلّه، فيُختار
// مداها أوّلاً ثمّ تُبدأ.

import { useState } from "react";
import { History, Loader2 } from "lucide-react";
import { getCsrfHeader } from "@/lib/csrfClient";
import { Select } from "@/app/components/ui/Select";
import { t, type Locale } from "@/lib/i18n/dictionary";

const WINDOWS = [30, 90, 180, 365];

export function BackfillOrdersButton({
  workspaceId,
  locale,
}: {
  workspaceId: string;
  locale: Locale;
}) {
  const [days, setDays] = useState("90");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const tr = (k: string, v?: Record<string, string | number>) => t(locale, `orderBackfill.${k}`, v);

  async function run() {
    setBusy(true);
    setNote(null);
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/order-backfill`, {
        method: "POST",
        headers: { ...getCsrfHeader(), "Content-Type": "application/json" },
        body: JSON.stringify({ windowDays: Number(days) }),
      });
      const data = await res.json().catch(() => null);

      const failed = (data?.stores_detail ?? []).find((s: { ok: boolean }) => !s.ok);
      if (failed?.reasonKey) {
        setNote(tr(failed.reasonKey, failed.reasonVars ?? {}));
      } else if (!res.ok || !data?.ok) {
        setNote(tr("obPullFailed"));
      } else if ((data.imported ?? 0) + (data.duplicates ?? 0) + (data.updated ?? 0) === 0) {
        setNote(tr("none"));
      } else {
        // الحدّ يُقال حين يُبلَغ: «تمّ» على سحبٍ مبتور تُخفي تاريخاً باقياً
        const done = tr("done", {
          imported: data.imported ?? 0,
          duplicates: data.duplicates ?? 0,
          updated: data.updated ?? 0,
        });
        setNote(data.reachedCap ? `${done} — ${tr("cappedNote")}` : done);
        if (data.imported > 0 || data.updated > 0) {
          setTimeout(() => window.location.reload(), 1400);
        }
      }
    } catch {
      setNote(tr("obPullFailed"));
    }
    setBusy(false);
  }

  return (
    <div className="flex flex-col items-start gap-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <Select
          locale={locale}
          value={days}
          onChange={setDays}
          ariaLabel={tr("button", { days })}
          size="sm"
          className="w-36"
          options={WINDOWS.map((d) => ({ value: String(d), label: String(d) }))}
        />
        <button onClick={run} disabled={busy} className="btn btn-secondary">
          {busy ? <Loader2 size={14} className="animate-spin" /> : <History size={14} />}
          {busy ? tr("running") : tr("button", { days })}
        </button>
      </div>
      <p className="max-w-md text-[11.5px] leading-relaxed text-text-faint">
        {note ?? tr("hint")}
      </p>
    </div>
  );
}
