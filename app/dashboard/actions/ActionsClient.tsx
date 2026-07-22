// app/dashboard/actions/ActionsClient.tsx

"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Check, X } from "lucide-react";

export interface ActionItemData {
  id: string;
  type: string;
  severity: string;
  title: string;
  description: string | null;
  createdAt: string;
}

// مدة انتظار التأكيد الثاني - كافية إنه يشوف ويقرر، مش قصيرة تحسّها
// مستعجل ولا طويلة تنسى إنك في وضع تأكيد أصلاً
const CONFIRM_WINDOW_MS = 4000;

export function ActionsClient({ items }: { items: ActionItemData[] }) {
  const router = useRouter();
  const [processing, setProcessing] = useState<string | null>(null);
  const [handled, setHandled] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  // درجة تأكيد ثانية - أي اقتراح أتمتة (مش بس بند المزايدة) لازم يتدوس
  // عليه مرتين، مش دوسة واحدة ممكن تحصل بالغلط
  const [pendingConfirm, setPendingConfirm] = useState<string | null>(null);
  const confirmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function handle(id: string, action: "apply" | "dismiss") {
    setProcessing(id);
    setError(null);
    const res = await fetch(`/api/action-feed/${id}/${action}`, { method: "POST" });
    setProcessing(null);

    if (!res.ok) {
      // فشل حقيقي (زي فشل استدعاء API عند المنصة) - لازم يبان للمستخدم،
      // مش نخفي الاقتراح كإنه اتنفّذ بنجاح وهو معملش حاجة
      const data = await res.json().catch(() => ({ error: "فشل التنفيذ" }));
      setError(data.error ?? "فشل التنفيذ");
      return;
    }

    setHandled((prev) => new Set(prev).add(id));
    router.refresh();
  }

  function handleApplyClick(id: string) {
    if (pendingConfirm === id) {
      // الدوسة التانية - التنفيذ الفعلي
      if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
      setPendingConfirm(null);
      handle(id, "apply");
      return;
    }

    // الدوسة الأولى - نطلب تأكيد بس، مفيش تنفيذ حقيقي لسه
    if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
    setPendingConfirm(id);
    confirmTimerRef.current = setTimeout(() => setPendingConfirm(null), CONFIRM_WINDOW_MS);
  }

  const visibleItems = items.filter((i) => !handled.has(i.id));

  if (visibleItems.length === 0) {
    return (
      <div className="rounded-card border border-dashed border-border bg-surface px-8 py-12 text-center">
        <div className="text-text-muted">مفيش قرارات معلّقة دلوقتي</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {error && (
        <div className="rounded-2xl bg-critical/10 p-3 text-xs text-critical">
          فشل التنفيذ: {error}
        </div>
      )}
      {visibleItems.map((item) => (
        <div key={item.id} className="rounded-2xl bg-surface p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <div className="mb-1 flex items-center gap-2">
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                    item.type === "SUGGESTION" ? "bg-accent/15 text-accent" : "bg-gap/15 text-gap"
                  }`}
                >
                  {item.type === "SUGGESTION" ? "اقتراح" : "تنبيه"}
                </span>
                <SeverityDot severity={item.severity} />
              </div>
              <div className="text-sm text-text-primary">{item.title}</div>
              {item.description && (
                <div className="mt-1 text-xs text-text-faint">{item.description}</div>
              )}
            </div>

            {item.type === "SUGGESTION" && (
              <div className="flex shrink-0 items-center gap-1.5">
                {pendingConfirm === item.id ? (
                  <button
                    onClick={() => handleApplyClick(item.id)}
                    disabled={processing === item.id}
                    className="flex h-8 items-center gap-1 rounded-full bg-critical/15 px-3 text-xs font-medium text-critical disabled:opacity-40"
                  >
                    <Check size={13} /> تأكيد؟
                  </button>
                ) : (
                  <button
                    onClick={() => handleApplyClick(item.id)}
                    disabled={processing === item.id}
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-verified/15 text-verified disabled:opacity-40"
                    title="تنفيذ"
                  >
                    <Check size={15} />
                  </button>
                )}
                <button
                  onClick={() => handle(item.id, "dismiss")}
                  disabled={processing === item.id}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-raised text-text-muted disabled:opacity-40"
                  title="تجاهل"
                >
                  <X size={15} />
                </button>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function SeverityDot({ severity }: { severity: string }) {
  const colorClass =
    severity === "URGENT" ? "bg-critical" : severity === "HIGH" ? "bg-gap" : "bg-text-faint";
  return <span className={`h-1.5 w-1.5 rounded-full ${colorClass}`} />;
}
