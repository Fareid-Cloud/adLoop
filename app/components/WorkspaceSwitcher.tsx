"use client";

// مبدّل مساحات العمل: عنصر أساسي في أسفل القائمة الجانبية، لا شريط رفيع.
// التبديل يمرّ بشاشة انتقالية قصيرة لأن كل بيانات اللوحة تُعاد من الخادم -
// بدونها تبدو الصفحة جامدة ثم تتغيّر فجأة.

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ChevronsUpDown, Plus, Check, ShieldCheck, X, Loader2, Sparkles , FlaskConical } from "lucide-react";
import { t, type Locale } from "@/lib/i18n/dictionary";

export interface WorkspaceOption {
  id: string;
  name: string;
  currency: string;
  /** مساحة عرض تجريبية: أرقامها أمثلة لا بيانات حقيقية */
  isDemo?: boolean;
}

export function WorkspaceSwitcher({
  current, workspaces, canAddMore, limit, collapsed = false, locale,
}: {
  current: WorkspaceOption;
  workspaces: WorkspaceOption[];
  canAddMore: boolean;
  limit: number;
  collapsed?: boolean;
  locale: "ar" | "en";
}) {
  const tr = (k: string, vars?: Record<string, string | number>) =>
    t(locale, `wsSwitch.${k}`, vars);
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
    // تحميل كامل لا تنقّل داخل العميل. `router.push` يُبقي المكوّن حيّاً،
    // فتبقى `switching` صحيحة إلى الأبد وتظلّ الشاشة معلّقة - وهو ما كان
    // يبدو "تحميلاً لا ينتهي". التحميل الكامل يقرأ الكوكي من جديد ويصفّر
    // كل حالة العميل، والشاشة تبقى ظاهرة حتى ترسم الصفحة الجديدة.
    window.location.assign("/dashboard");
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

    if (!res) { setError(t(locale, "setup.syncNoServer")); return; }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { setError(data.error ?? t(locale, "setup.syncFailed")); return; }

    setName("");
    setCreating(false);
    setOpen(false);
    if (data.workspace?.id) switchTo(data.workspace.id);
  }

  return (
    <>
      {/* شاشة الانتقال - معتمة تماماً: خمسة بالمئة من الشفافية كانت تكفي
          لظهور الصفحة السابقة خلفها عند التمرير، فيبدو المشهد نصفين */}
      {switching && (
        <div className="fixed inset-0 z-[95] flex flex-col items-center justify-center gap-4 overflow-hidden bg-bg">
          <div className="relative">
            <ShieldCheck size={40} className="text-verified" />
            <Sparkles size={16} className="absolute -end-1 -top-1 animate-pulse text-accent" />
          </div>
          <div className="text-center">
            <p className="text-[15px] font-medium text-text-primary">{tr("title")}</p>
            <p className="mt-1 text-[12.5px] text-text-muted">{tr("body")}</p>
          </div>
          <Loader2 size={18} className="animate-spin text-accent" />
        </div>
      )}

      <div className="relative">
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center gap-2.5 card-inset pad-sm text-start"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent/12 font-mono text-[13px] font-semibold text-accent">
            {current.name.charAt(0).toUpperCase()}
          </span>
          {!collapsed && (
            <>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium text-text-primary">{current.name}</span>
                <span className="block text-[11px] text-text-muted">{tr("label")}</span>
              </span>
              <ChevronsUpDown size={14} className="shrink-0 text-text-muted" />
            </>
          )}
        </button>

        {open && !collapsed && (
          <div className="pop-shadow absolute bottom-full mb-2 w-full overflow-hidden card">
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
                    placeholder={tr("namePlaceholder")}
                    className="field field-sm mb-2 w-full"
                  />
                  {error && <p className="mb-2 text-[11.5px] leading-relaxed text-critical">{error}</p>}
                  <div className="flex gap-1.5">
                    <button onClick={create} disabled={busy || !name.trim()}
                            className="btn btn-primary btn-sm flex-1">
                      {busy ? tr("creating") : tr("create")}
                    </button>
                    <button onClick={() => { setCreating(false); setError(null); }}
                            className="card-inset p-1.5 text-text-muted">
                      <X size={13} />
                    </button>
                  </div>
                </div>
              ) : canAddMore ? (
                <button onClick={() => setCreating(true)}
                        className="flex w-full items-center gap-2 rounded-lg p-2.5 text-[12.5px] text-text-primary hover:bg-surface-raised">
                  <Plus size={14} /> {tr("newWorkspace")}
                </button>
              ) : (
                <div className="p-2.5">
                  <p className="mb-2 text-[11.5px] leading-relaxed text-text-muted">
                    {tr("limitReached", { limit: limit === 1 ? tr("limitOne") : tr("limitN", { n: limit }) })}
                  </p>
                  <a href="/dashboard/billing"
                     className="btn btn-primary btn-sm block text-center">
                    {tr("upgrade")}
                  </a>
                </div>
              )}

              {/* 🔴 مدخل الديمو: الآلية كاملةً موجودة (`/demo` وبذرتها) ولا
                  رابط إليها من أيّ موضع في المنتج، فكانت ميزةً مبنيّةً لا
                  يصل إليها أحد. تظهر لمن لا يملك مساحة عرض بعد فقط: مَن
                  جرّبها لا يحتاج الرابط، ووجوده يزدحم عليه بلا فائدة.
                  وهي خارج حدّ الباقة لأنّها ليست مساحة عمل يُنتَج فيها. */}
              {!workspaces.some((w) => w.isDemo) && (
                <a
                  href="/demo"
                  className="flex items-center gap-2 border-t border-border p-2.5 text-[12.5px] text-text-muted no-underline hover:bg-surface-raised hover:text-text-primary"
                >
                  <FlaskConical size={14} className="shrink-0 text-accent" />
                  <span className="min-w-0">
                    <span className="block truncate">{tr("tryDemo")}</span>
                    <span className="block truncate text-[11px] text-text-faint">{tr("tryDemoHint")}</span>
                  </span>
                </a>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
