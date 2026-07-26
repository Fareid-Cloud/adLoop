"use client";

// مبدّل مساحات العمل: عنصر أساسي في أسفل القائمة الجانبية، لا شريط رفيع.
// التبديل يمرّ بشاشة انتقالية قصيرة لأن كل بيانات اللوحة تُعاد من الخادم -
// بدونها تبدو الصفحة جامدة ثم تتغيّر فجأة.

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ChevronsUpDown, Plus, Check, ShieldCheck, X, Loader2, Sparkles } from "lucide-react";

export interface WorkspaceOption {
  id: string;
  name: string;
  currency: string;
}

export function WorkspaceSwitcher({
  current, workspaces, canAddMore, limit, collapsed = false, locale = "ar",
}: {
  current: WorkspaceOption;
  workspaces: WorkspaceOption[];
  canAddMore: boolean;
  limit: number;
  collapsed?: boolean;
  locale?: "ar" | "en";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [switching, setSwitching] = useState(false);

  useEffect(() => {
    if (!open) { setCreating(false); setError(null); }
  }, [open]);

  async function switchTo(id: string) {
    if (id === current.id) { setOpen(false); return; }
    setSwitching(true);
    setOpen(false);
    await fetch("/api/workspaces/active", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspaceId: id }),
    }).catch(() => {});
    // مهلة قصيرة ليكتمل الانتقال بصرياً قبل إعادة التحميل
    setTimeout(() => { router.refresh(); router.push("/dashboard"); }, 700);
  }

  async function create() {
    if (!name.trim()) return;
    setBusy(true);
    setError(null);
    const res = await fetch("/api/workspaces", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim() }),
    }).catch(() => null);
    setBusy(false);

    if (!res) { setError("تعذّر الاتصال بالخادم."); return; }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { setError(data.error ?? "تعذّر إنشاء مساحة العمل."); return; }

    setName("");
    setCreating(false);
    setOpen(false);
    if (data.workspace?.id) switchTo(data.workspace.id);
  }

  return (
    <>
      {/* شاشة الانتقال */}
      {switching && (
        <div className="fixed inset-0 z-[95] flex flex-col items-center justify-center gap-4 bg-bg/95 backdrop-blur-sm">
          <div className="relative">
            <ShieldCheck size={40} className="text-verified" />
            <Sparkles size={16} className="absolute -end-1 -top-1 animate-pulse text-accent" />
          </div>
          <div className="text-center">
            <p className="text-[15px] font-medium text-text-primary">نكشف الحقيقة…</p>
            <p className="mt-1 text-[12.5px] text-text-muted">نُحضّر أرقام مساحة العمل الجديدة</p>
          </div>
          <Loader2 size={18} className="animate-spin text-accent" />
        </div>
      )}

      <div className="relative">
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center gap-2.5 rounded-xl border border-border bg-surface-raised p-3 text-start"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent/12 font-mono text-[13px] font-semibold text-accent">
            {current.name.charAt(0).toUpperCase()}
          </span>
          {!collapsed && (
            <>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium text-text-primary">{current.name}</span>
                <span className="block text-[11px] text-text-muted">مساحة العمل</span>
              </span>
              <ChevronsUpDown size={14} className="shrink-0 text-text-muted" />
            </>
          )}
        </button>

        {open && !collapsed && (
          <div className="pop-shadow absolute bottom-full mb-2 w-full overflow-hidden rounded-xl border border-border bg-surface">
            <div className="max-h-56 overflow-y-auto p-1.5">
              {workspaces.map((w) => (
                <button key={w.id} onClick={() => switchTo(w.id)}
                        className={`flex w-full items-center gap-2 rounded-lg p-2.5 text-start text-[12.5px] ${
                          w.id === current.id ? "bg-accent/10 text-accent" : "text-text-primary hover:bg-surface-raised"
                        }`}>
                  <span className="min-w-0 flex-1 truncate">{w.name}</span>
                  {w.id === current.id && <Check size={13} className="shrink-0" />}
                </button>
              ))}
            </div>

            <div className="border-t border-border p-1.5">
              {creating ? (
                <div className="p-1.5">
                  <input
                    value={name} onChange={(e) => setName(e.target.value)} autoFocus
                    onKeyDown={(e) => e.key === "Enter" && create()}
                    placeholder="اسم مساحة العمل"
                    className="mb-2 w-full rounded-lg border border-border bg-surface-raised px-2.5 py-2 text-[12.5px] text-text-primary outline-none focus:border-accent"
                  />
                  {error && <p className="mb-2 text-[11.5px] leading-relaxed text-critical">{error}</p>}
                  <div className="flex gap-1.5">
                    <button onClick={create} disabled={busy || !name.trim()}
                            className="flex-1 rounded-lg bg-accent px-2 py-1.5 text-[12px] font-medium text-white disabled:opacity-45">
                      {busy ? "جارٍ الإنشاء..." : "إنشاء"}
                    </button>
                    <button onClick={() => { setCreating(false); setError(null); }}
                            className="rounded-lg border border-border bg-surface-raised p-1.5 text-text-muted">
                      <X size={13} />
                    </button>
                  </div>
                </div>
              ) : canAddMore ? (
                <button onClick={() => setCreating(true)}
                        className="flex w-full items-center gap-2 rounded-lg p-2.5 text-[12.5px] text-text-primary hover:bg-surface-raised">
                  <Plus size={14} /> مساحة عمل جديدة
                </button>
              ) : (
                <div className="p-2.5">
                  <p className="mb-2 text-[11.5px] leading-relaxed text-text-muted">
                    وصلت إلى حدّ باقتك ({limit === 1 ? "مساحة واحدة" : `${limit} مساحات`}).
                  </p>
                  <a href="/dashboard/billing"
                     className="block rounded-lg bg-accent px-2.5 py-1.5 text-center text-[12px] font-medium text-white no-underline">
                    ترقية الباقة
                  </a>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
