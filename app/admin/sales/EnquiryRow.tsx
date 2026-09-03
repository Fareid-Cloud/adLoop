"use client";

// app/admin/sales/EnquiryRow.tsx - تغييرُ حالة الطلب وملاحظتُه الداخلية
//
// الحالةُ بتتحفظ بالدوسة، والملاحظةُ بزرارٍ صريح: التاني نصٌّ طويل بيتكتب
// على مرّات، وحفظُه مع كلّ حرف بيبعت عشرين طلباً للجملة الواحدة.

import { useState } from "react";
import { Loader2, Check } from "lucide-react";
import { getCsrfHeader } from "@/lib/csrfClient";
import { ENQUIRY_STATUSES } from "@/lib/salesEnquiry";
import { useRouter } from "next/navigation";

export function EnquiryRow({
  id, status, note, handledBy, handledAt,
}: {
  id: string;
  status: string;
  note: string;
  handledBy: string | null;
  handledAt: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState(note);
  const [saved, setSaved] = useState(false);

  async function patch(body: Record<string, unknown>) {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/sales/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getCsrfHeader() },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 1800);
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3 border-t border-border pt-3">
      <div className="flex flex-wrap items-center gap-1.5">
        {ENQUIRY_STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => patch({ status: s })}
            disabled={busy || s === status}
            className={`rounded-lg px-2.5 py-1 text-[12px] transition-colors disabled:cursor-default ${
              s === status
                ? "bg-critical/12 text-critical"
                : "border border-border-visible text-text-muted hover:bg-surface-raised hover:text-text-primary"
            }`}
          >
            {s[0] + s.slice(1).toLowerCase()}
          </button>
        ))}
        {busy && <Loader2 size={13} className="animate-spin text-text-faint" />}
        {saved && !busy && <Check size={13} className="text-success" />}
        {handledBy && (
          // مين لمس الطلب وإمتى: من غيره اتنين بيتّصلوا بنفس العميل في
          // نفس اليوم، والعميلُ بيسمع نفس الأسئلة مرّتين.
          <span className="ms-auto text-[11.5px] text-text-faint">
            {handledBy}
            {handledAt ? ` · ${handledAt}` : ""}
          </span>
        )}
      </div>

      <div className="mt-2 flex items-start gap-2">
        <textarea
          rows={2}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Call notes, agreed price, next step…"
          className="field field-sm min-w-0 flex-1 resize-none text-[12.5px]"
        />
        <button
          onClick={() => patch({ internalNote: draft })}
          disabled={busy || draft === note}
          className="btn btn-sm shrink-0 disabled:opacity-50"
        >
          Save
        </button>
      </div>
    </div>
  );
}
