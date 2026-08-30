"use client";

// app/dashboard/diagnostics/tracking-coverage/TrackingCoverageClient.tsx
//
// تغطية التتبّع. الصفحات المُضافة هنا تُفحص تلقائياً وتؤثّر على درجة
// التشخيص، لذلك يُذكر ذلك صراحةً وتتوفّر إمكانية الحذف.
//
// **الإصلاح الجوهري:** كانت الصفحة تقول "وسم AdLoop غير موجود" وتتوقّف.
// لا تعرض الوسم، ولا تقول من أين يأتي، ولا ما الخطوة التالية. أي حالة
// تمنع المستخدم يجب أن تحمل معها الحلّ لا التشخيص وحده.

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Plus, CheckCircle2, XCircle, RefreshCw, Trash2, Info,
  AlertTriangle, Loader2, ShieldCheck, ArrowLeft, Clock,
} from "lucide-react";
import { InstallTagPanel } from "./InstallTagPanel";
import { t, type Locale } from "@/lib/i18n/dictionary";
// من الملفّ المستقلّ لا من `trackingCoverage`: ذاك يجرّ `safeFetch` وهو
// خادميّ، واستيراده هنا يكسر البناء.
import { trackingErrorText } from "@/lib/trackingErrorText";

export interface PageRow {
  id: string;
  url: string;
  label: string | null;
  trackingDetected: boolean | null;
  adloopDetected: boolean | null;
  detectedSystems: string[];
  lastCheckedAt: string | null;
  lastError: string | null;
}

const SYSTEM_LABEL: Record<string, string> = {
  adloop: "AdLoop", gtm: "Tag Manager", gtag: "Google gtag", ga4: "Analytics 4",
  meta_pixel: "Meta Pixel", tiktok_pixel: "TikTok Pixel", snap_pixel: "Snap Pixel",
  x_pixel: "X Pixel", linkedin: "LinkedIn", hotjar: "Hotjar", clarity: "Clarity",
};

type PageState = "ok" | "partial" | "missing" | "error" | "pending";

/** الحالة تُشتقّ مرّة واحدة، فلا تتباعد الرسالة عن اللون عن الأيقونة */
function stateOf(p: PageRow): PageState {
  if (p.lastError) return "error";
  if (p.adloopDetected === true) return "ok";
  if (p.trackingDetected === true) return "partial";
  if (p.trackingDetected === false) return "missing";
  return "pending";
}

const STATE_TONE: Record<PageState, string> = {
  ok: "var(--verified)",
  partial: "var(--gap)",
  missing: "var(--critical)",
  error: "var(--text-muted)",
  pending: "var(--text-faint)",
};

export function TrackingCoverageClient({
  workspaceId, appUrl, pages, locale,
}: {
  workspaceId: string;
  appUrl: string;
  pages: PageRow[];
  locale: Locale;
}) {
  const tr = (k: string, v?: Record<string, string | number>) => t(locale, `tagInstall.${k}`, v);
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [label, setLabel] = useState("");
  const [adding, setAdding] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // اللوحة تُفتح تلقائياً لمن لا وسم لديه على أي صفحة - هو بالضبط من
  // يحتاجها، ولا معنى لأن يبحث عنها بنفسه.
  const anyInstalled = pages.some((p) => p.adloopDetected === true);
  const needsTag = pages.length > 0 && !anyInstalled;

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;
    setAdding(true);
    setError(null);
    const res = await fetch(`/api/workspaces/${workspaceId}/monitored-pages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: url.trim(), label: label.trim() }),
    }).catch(() => null);
    setAdding(false);
    if (!res || !res.ok) {
      const d = res ? await res.json().catch(() => ({})) : {};
      setError((d as { error?: string }).error ?? tr("covAddFailed"));
      return;
    }
    setUrl(""); setLabel("");
    router.refresh();
  }

  async function recheck(id: string) {
    setBusyId(id);
    await fetch(`/api/monitored-pages/${id}/check`, { method: "POST" }).catch(() => {});
    setBusyId(null);
    router.refresh();
  }

  async function recheckAll() {
    setBusyId("all");
    await fetch("/api/diagnostics/scan", { method: "POST" }).catch(() => {});
    setBusyId(null);
    router.refresh();
  }

  async function remove(id: string) {
    setBusyId(id);
    await fetch(`/api/monitored-pages/${id}`, { method: "DELETE" }).catch(() => {});
    setBusyId(null);
    setConfirmDelete(null);
    router.refresh();
  }

  return (
    <div>
      <InstallTagPanel
        workspaceId={workspaceId}
        appUrl={appUrl}
        locale={locale}
        defaultOpen={needsTag || pages.length === 0}
      />

      <div className="card-shadow mb-4 flex items-start gap-2.5 card pad-md">
        <Info size={16} className="mt-0.5 shrink-0 text-accent" />
        <p className="text-[12.5px] leading-relaxed text-text-muted">{tr("covScopeNote")}</p>
      </div>

      <form onSubmit={handleAdd} className="card-shadow mb-4 card pad-md">
        <div className="mb-3 grid gap-2.5 sm:grid-cols-[2fr_1fr]">
          <input
            value={url} onChange={(e) => setUrl(e.target.value)}
            placeholder={tr("covUrlPlaceholder")}
            className="field"
          />
          <input
            value={label} onChange={(e) => setLabel(e.target.value)}
            placeholder={tr("covLabelPlaceholder")}
            className="field"
          />
        </div>
        {error && <p className="mb-2 text-[12.5px] text-critical">{error}</p>}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <button type="submit" disabled={adding || !url.trim()}
                  className="btn btn-primary">
            <Plus size={14} /> {adding ? tr("covAdding") : tr("covAdd")}
          </button>

          {pages.length > 0 && (
            <button type="button" onClick={recheckAll} disabled={busyId === "all"}
                    className="btn btn-secondary">
              {busyId === "all" ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
              {busyId === "all" ? tr("covCheckingAll") : tr("covCheckAll")}
            </button>
          )}
        </div>
      </form>

      {pages.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center">
          <ShieldCheck size={26} className="mx-auto mb-3 text-text-faint" />
          <p className="text-[13.5px] text-text-primary">{tr("covNoneTitle")}</p>
          <p className="mt-1 text-[12.5px] text-text-muted">{tr("covNoneBody")}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {pages.map((p) => {
            const state = stateOf(p);
            const tone = STATE_TONE[state];
            const Icon =
              state === "ok" ? CheckCircle2
              : state === "error" ? AlertTriangle
              : state === "pending" ? Clock
              : XCircle;

            return (
              <div key={p.id} className="card pad-md">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-center gap-2">
                      <Icon size={15} style={{ color: tone }} />
                      <span className="text-[13.5px] font-medium text-text-primary">{p.label || p.url}</span>
                    </div>
                    {p.label && <p className="mb-1.5 truncate text-[11.5px] text-text-faint">{p.url}</p>}

                    {/* الحالة: عنوان + ماذا يعني + الخطوة التالية - لا سطر
                        تشخيص مغلق يترك المستخدم يبحث عن الحلّ بنفسه */}
                    <p className="text-[12.5px] font-medium" style={{ color: tone }}>
                      {tr(`st${cap(state)}Title`)}
                    </p>
                    <p className="mt-0.5 text-[12px] leading-relaxed text-text-muted">
                      {/* السبب مترجَماً أو لا سبب: كان `lastError` يُطبع خاماً
                          بين قوسين - نصُّ شبكةٍ إنجليزيّ تقنيّ لقارئٍ عربيّ،
                          أو العكس. والصفوف المخزَّنة قبل التحويل تحمل نصّاً
                          حرّاً لا رمزاً، فتُعرَض بالجملة العامّة وحدها. */}
                      {state === "error"
                        ? trackingErrorText(p.lastError ?? null, locale) ?? tr("stErrorBody")
                        : tr(`st${cap(state)}Body`)}
                    </p>

                    {(state === "missing" || state === "partial") && (
                      <a
                        href="#"
                        onClick={(e) => {
                          e.preventDefault();
                          window.scrollTo({ top: 0, behavior: "smooth" });
                        }}
                        className="mt-2 inline-flex items-center gap-1 text-[12px] font-medium text-accent no-underline"
                      >
                        {tr("fixNow")}
                        <ArrowLeft size={12} className="rtl:rotate-0 ltr:rotate-180" />
                      </a>
                    )}

                    {p.detectedSystems?.length > 0 && (
                      <div className="mt-2">
                        <span className="text-[11px] text-text-faint">{tr("covOtherTags")}</span>
                        <div className="mt-1 flex flex-wrap gap-1.5">
                          {p.detectedSystems.map((sys) => (
                            <span key={sys}
                                  className={`rounded-full px-2 py-0.5 text-[10.5px] ${
                                    sys === "adloop" ? "bg-verified/12 text-verified" : "bg-surface-raised text-text-muted"
                                  }`}>
                              {SYSTEM_LABEL[sys] ?? sys}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {p.lastCheckedAt && (
                      <p className="mt-2 text-[11px] text-text-faint">
                        {tr("covLastCheck", { date: new Date(p.lastCheckedAt).toLocaleString(locale === "en" ? "en-GB" : "ar-EG-u-nu-latn") })}
                      </p>
                    )}
                  </div>

                  <div className="flex shrink-0 gap-1.5">
                    <button onClick={() => recheck(p.id)} disabled={busyId === p.id}
                            className="flex items-center gap-1.5 card-inset px-3 py-2 text-[12px] text-text-primary disabled:opacity-50">
                      {busyId === p.id ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
                      {busyId === p.id ? tr("covChecking") : tr("covCheck")}
                    </button>
                    <button onClick={() => setConfirmDelete(p.id)}
                            className="card-inset p-2 text-text-muted hover:text-critical"
                            aria-label={tr("covDelete")}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {confirmDelete === p.id && (
                  <div className="note mt-3 flex-wrap justify-between border-critical/35 bg-critical/[0.06] p-3">
                    <span className="text-[12.5px] text-text-primary">{tr("covConfirmDelete")}</span>
                    <div className="flex gap-2">
                      <button onClick={() => setConfirmDelete(null)}
                              className="card px-3 py-1.5 text-[12px] text-text-muted">
                        {tr("covCancel")}
                      </button>
                      <button onClick={() => remove(p.id)} disabled={busyId === p.id}
                              className="btn btn-danger btn-sm">
                        {tr("covRemove")}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function cap(s: string): string {
  return s[0].toUpperCase() + s.slice(1);
}
