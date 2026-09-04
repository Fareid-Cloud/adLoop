"use client";

// app/dashboard/tracking/TrackingCoverageClient.tsx
//
// تغطية التتبّع. الصفحات المُضافة هنا تُفحص تلقائياً وتؤثّر على درجة
// التشخيص، لذلك يُذكر ذلك صراحةً وتتوفّر إمكانية الحذف.
//
// **الإصلاح الجوهري:** كانت الصفحة تقول "وسم AdLoop غير موجود" وتتوقّف.
// لا تعرض الوسم، ولا تقول من أين يأتي، ولا ما الخطوة التالية. أي حالة
// تمنع المستخدم يجب أن تحمل معها الحلّ لا التشخيص وحده.

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Plus, CheckCircle2, XCircle, RefreshCw, Trash2, Info,
  AlertTriangle, Loader2, ShieldCheck, ArrowLeft, Clock, ChevronDown, Copy, Check,
} from "lucide-react";
import { CodeWindow } from "@/app/components/CodeWindow";
import { buildSnippet } from "./tagSnippet";
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
  workspaceId, appUrl, pages, locale, tagLive,
}: {
  workspaceId: string;
  appUrl: string;
  pages: PageRow[];
  locale: Locale;
  /** وصلت نقرةٌ حقيقيّة - الدليلُ الوحيد أنّ الحلقة تعمل. */
  tagLive: boolean;
}) {
  const tr = (k: string, v?: Record<string, string | number>) => t(locale, `tagInstall.${k}`, v);
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [label, setLabel] = useState("");
  const [adding, setAdding] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // لوحةُ الوسم تُفتح من الخطوة لا تفرض نفسها: بعد اكتمال التثبيت
  // تصير كتلةً طويلةً تُزاح في كلّ زيارة.
  /** أيُّ بندٍ مفتوحٌ الآن - واحدٌ في كلّ مرّة، فلا تتراكم الكتل. */
  const [openStep, setOpenStep] = useState<string | null>(null);
  const [copiedWs, setCopiedWs] = useState(false);
  const addRef = useRef<HTMLElement | null>(null);

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

  // ── الخطوات الثلاث ────────────────────────────────────────────────
  //
  // **كلُّ خطوةٍ حالتُها من دليلٍ مختلف، لا من ادّعاء.** الثلاثةُ منفصلةٌ
  // فعلاً ولا تُثبت إحداها الأخرى:
  //
  //   ١ الوسمُ موجود   ← كُشف في صفحةٍ مراقَبة.
  //   ٢ الأزرارُ مربوطة ← وصلت نقرةٌ حقيقيّة. وهذا لا يلزم من (١): وسمٌ
  //     مثبَّتٌ وزرٌّ بلا `trackCtaClick` يعطي صفحةً «سليمة» وصفر نقرات.
  //   ٣ المراقبةُ قائمة ← ثمّة صفحةٌ يفحصها AdLoop دورياً.
  const snippet = buildSnippet(workspaceId, appUrl);
  const ctaExamples = `<a href="https://wa.me/9665XXXXXXXX" onclick="trackCtaClick('WHATSAPP')">${tr("egWhatsapp")}</a>

<a href="tel:+9665XXXXXXXX" onclick="trackCtaClick('CALL')">${tr("egCall")}</a>

<form onsubmit="trackCtaClick('FORM')"> … </form>`;

  const steps = [
    { key: "st1", done: anyInstalled || tagLive },
    { key: "st2", done: tagLive },
    { key: "st3", done: pages.length > 0 },
  ];
  const doneCount = steps.filter((s) => s.done).length;
  const allDone = doneCount === steps.length;

  function pageState(p: PageRow): { key: string; tone: string } {
    if (p.lastCheckedAt === null) return { key: "stUnchecked", tone: "var(--text-muted)" };
    if (p.lastError || p.adloopDetected !== true) return { key: "stAttention", tone: "var(--gap)" };
    return { key: "stHealthy", tone: "var(--verified)" };
  }

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[1fr_300px]">
      <div className="min-w-0">
        {/* ── شريطُ الإعداد ──────────────────────────────────────────
            يختفي تماماً عند الاكتمال: لافتةُ «تمّ» دائمةٌ تصير أثاثاً،
            ومكانُها الحقيقيّ أن تُخلي الشاشة لما بعدها. */}
        {!allDone && (
          <div className="mb-4 flex items-start gap-2.5 rounded-2xl border border-gap/40 bg-gap/[0.07] p-3.5">
            <AlertTriangle size={16} className="mt-0.5 shrink-0 text-gap" />
            <div className="min-w-0">
              <div className="text-[13px] font-semibold text-text-primary">{tr("setupIncomplete")}</div>
              <p className="mt-0.5 text-[12px] leading-relaxed text-text-muted">
                {tr("setupProgress", { done: doneCount, total: steps.length })} {tr("setupRemaining")}
              </p>
            </div>
          </div>
        )}

        {/* ── الخطوات ─────────────────────────────────────────────── */}
        <section className="card-shadow mb-4 overflow-hidden card">
          <h2 className="border-b border-border px-4 py-2.5 text-[13px] font-semibold text-text-primary">
            {tr("stepsTitle")}
          </h2>
          <div className="divide-y divide-border">
            {steps.map((st, i) => (
              <div key={st.key} className="flex flex-wrap items-center gap-3 px-4 py-3">
                {/* 🔴 **الصفُّ كان يسحق عمودَ النصّ على الهاتف.** الرقمُ
                    والدائرةُ والحالةُ والزرُّ كلُّها `shrink-0`، فلا يبقى
                    ما يتقلّص إلّا النصّ - فينزل **كلمةً في كلّ سطر** ويصير
                    البند أطول من الشاشة. المجموعةُ اليسرى تأخذ سطراً
                    كاملاً تحت `sm` (`basis-full`)، وتعود إلى الصفّ فوقه. */}
                <span className="flex min-w-0 flex-1 basis-full items-center gap-3 sm:basis-0">
                  <span className="w-5 shrink-0 text-center font-mono text-[12px] tabular-nums text-text-faint">
                    {i + 1}
                  </span>
                  {/* دائرةٌ ممتلئةٌ للمنجَز وفارغةٌ لغيره - الحالةُ تُقرأ من
                      الشكل قبل النصّ، ومن اللون قبل القراءة. */}
                  <span className="shrink-0">
                    {st.done ? (
                      <CheckCircle2 size={20} className="text-verified" />
                    ) : (
                      <span className="block h-5 w-5 rounded-full border-2 border-gap/60" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-medium text-text-primary">
                      {tr(`${st.key}Title`)}
                    </span>
                    <span className="block text-[11.5px] leading-relaxed text-text-muted">
                      {tr(`${st.key}Body`)}
                    </span>
                  </span>
                </span>
                <span
                  className="ms-8 shrink-0 text-[12px] font-medium sm:ms-0"
                  style={{ color: st.done ? "var(--verified)" : "var(--gap)" }}
                >
                  {tr(st.done ? `${st.key}Done` : `${st.key}Todo`)}
                </span>
                <button
                  onClick={() => setOpenStep((o) => (o === st.key ? null : st.key))}
                  className="btn btn-secondary btn-sm shrink-0"
                >
                  {tr(`${st.key}Action`)}
                  <ChevronDown
                    size={13}
                    className={`transition-transform ${openStep === st.key ? "rotate-180" : ""}`}
                  />
                </button>

                {/* 🔴 **ما يخصّ البندَ يُفتح تحته، لا في كتلةٍ أخرى.**
                    كانت الأزرارُ الثلاثة تفتح لوحةً واحدةً في أسفل الصفحة
                    تحوي الشيفرتين معاً - فمن ضغط «اربطه بالأزرار» ينزل
                    إلى كتلةٍ تبدأ بشيفرةٍ أخرى ويبحث فيها عن بندِه.
                    وليست خطواتٍ مرتّبة أصلاً: وضعُ الكود وربطُ الأزرار
                    وفحصُ الصفحة أفعالٌ مستقلّة، ولا يلزم واحدٌ من الآخر. */}
                {openStep === st.key && (
                  <div className="w-full pt-1">
                    {st.key === "st1" && (
                      <>
                        <CodeWindow
                          code={snippet}
                          lang="markup"
                          title="adloop-tag.html"
                          copyLabel={tr("copy")}
                          copiedLabel={tr("copied")}
                        />

                        {/* 🔴 **معرّفُ المساحة سقط سهواً عند إعادة البناء.**
                            الوسمُ الجاهز يحمله مدموجاً، لكنّ من يركّب عبر
                            Google Tag Manager أو قالبٍ لا يقبل لصقَ سكربت
                            يحتاج الرقم وحدَه - وبدونه لا سبيل له إلى إتمام
                            التركيب. ومعه ملاحظةُ GTM لأنّها طريقتُه. */}
                        <div className="mt-2 flex flex-wrap items-center gap-2 rounded-xl border border-border-visible px-3 py-2">
                          <span className="text-[12px] text-text-muted">{tr("wsIdLabel")}</span>
                          <code
                            dir="ltr"
                            className="code-block min-w-0 flex-1 truncate rounded-lg bg-surface-raised px-2 py-1 text-[11.5px] text-text-primary"
                          >
                            {workspaceId}
                          </code>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(workspaceId);
                              setCopiedWs(true);
                              setTimeout(() => setCopiedWs(false), 2000);
                            }}
                            className="flex shrink-0 items-center gap-1 text-[11.5px] text-accent"
                          >
                            {copiedWs ? <Check size={12} /> : <Copy size={12} />}
                            {copiedWs ? tr("copied") : tr("copy")}
                          </button>
                        </div>

                        <p className="mt-2 flex items-start gap-1.5 text-[11.5px] leading-relaxed text-text-faint">
                          <Info size={12} className="mt-0.5 shrink-0" />
                          {tr("gtmNote")}
                        </p>
                      </>
                    )}
                    {st.key === "st2" && (
                      <CodeWindow
                        code={ctaExamples}
                        lang="markup"
                        title="buttons.html"
                        copyLabel={tr("copy")}
                        copiedLabel={tr("copied")}
                      />
                    )}
                    {st.key === "st3" && (
                      <form onSubmit={handleAdd} className="flex flex-wrap items-center gap-2 rounded-xl border border-border-visible p-2.5">
                        <input
                          dir="ltr"
                          value={url}
                          onChange={(e) => setUrl(e.target.value)}
                          placeholder="https://example.com/landing"
                          className="field field-sm min-w-[14rem] flex-1"
                        />
                        <input
                          value={label}
                          onChange={(e) => setLabel(e.target.value)}
                          placeholder={tr("covLabelPlaceholder")}
                          className="field field-sm w-[10rem]"
                        />
                        <button type="submit" disabled={adding || !url.trim()} className="btn btn-primary btn-sm shrink-0">
                          {adding ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                          {tr("qaAddPage")}
                        </button>
                      </form>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* ── الصفحات المراقَبة ──────────────────────────────────────── */}
        <section className="card-shadow overflow-hidden card" ref={addRef}>
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-2.5">
            <div className="min-w-0">
              <h2 className="text-[13px] font-semibold text-text-primary">{tr("pagesTitle")}</h2>
              <p className="text-[11.5px] text-text-muted">{tr("pagesBody")}</p>
            </div>
            {pages.length > 0 && (
              <button
                onClick={recheckAll}
                disabled={busyId === "all"}
                className="btn btn-ghost btn-sm shrink-0"
              >
                {busyId === "all" ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
                {tr("qaCheckAll")}
              </button>
            )}
          </div>

          {pages.length > 0 && (
            <>
              <div className="hidden items-center gap-3 border-b border-border px-4 py-2 text-[11px] font-medium uppercase tracking-wide text-text-faint sm:flex">
                <span className="min-w-0 flex-1">{tr("colPage")}</span>
                <span className="w-[150px] shrink-0">{tr("colStatusP")}</span>
                <span className="w-[100px] shrink-0">{tr("colChecked")}</span>
                <span className="w-[72px] shrink-0" />
              </div>
              <div className="divide-y divide-border">
                {pages.map((p) => {
                  const st = pageState(p);
                  return (
                    <div key={p.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[12.5px] text-text-primary">
                          {p.label || new URL(p.url).pathname || p.url}
                        </span>
                        {/* الرابط لاتينيّ دائماً مهما كانت لغة الواجهة */}
                        <span dir="ltr" className="block truncate text-[11px] text-text-faint">
                          {p.url}
                        </span>
                      </span>

                      <span className="w-[150px] shrink-0">
                        <span className="flex items-center gap-1.5 text-[12px]">
                          <span
                            className="h-1.5 w-1.5 shrink-0 rounded-full"
                            style={{ background: st.tone }}
                          />
                          <span className="truncate text-text-muted">{tr(st.key)}</span>
                        </span>
                        {/* سببُ العطل تحت اسمه - «تحتاج انتباهاً» وحدها
                            تُرسل صاحبَها ليخمّن. */}
                        {st.key === "stAttention" && (
                          <span className="block truncate text-[10.5px] text-text-faint">
                            {p.lastError
                              ? trackingErrorText(p.lastError, locale)
                              : tr("st1Todo")}
                          </span>
                        )}
                      </span>

                      <span className="w-[100px] shrink-0 text-[11.5px] text-text-muted">
                        {p.lastCheckedAt
                          ? new Date(p.lastCheckedAt).toLocaleDateString(
                              locale === "ar" ? "ar-EG-u-nu-latn" : "en-GB",
                              { day: "numeric", month: "short" }
                            )
                          : tr("neverChecked")}
                      </span>

                      <span className="flex w-[72px] shrink-0 items-center justify-end gap-1">
                        <button
                          onClick={() => recheck(p.id)}
                          disabled={busyId === p.id}
                          aria-label={tr("qaCheckAll")}
                          className="card-inset p-1.5 text-text-muted hover:text-text-primary"
                        >
                          {busyId === p.id
                            ? <Loader2 size={12} className="animate-spin" />
                            : <RefreshCw size={12} />}
                        </button>
                        <button
                          onClick={() => setConfirmDelete(p.id)}
                          aria-label={tr("covRemove")}
                          className="card-inset p-1.5 text-text-muted hover:text-critical"
                        >
                          <Trash2 size={12} />
                        </button>
                      </span>

                      {confirmDelete === p.id && (
                        <div className="mt-1 flex w-full flex-wrap items-center justify-between gap-2 rounded-xl border border-critical/35 bg-critical/[0.06] p-2.5">
                          <span className="text-[12px] text-text-primary">{tr("covConfirmDelete")}</span>
                          <div className="flex gap-2">
                            <button onClick={() => setConfirmDelete(null)} className="card px-3 py-1 text-[12px] text-text-muted">
                              {tr("covCancel")}
                            </button>
                            <button onClick={() => remove(p.id)} disabled={busyId === p.id} className="btn btn-danger btn-sm">
                              {tr("covRemove")}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {error && <p className="border-t border-border px-3 py-2 text-[12px] text-critical">{error}</p>}
        </section>
      </div>

      {/* ── العمود الجانبيّ ─────────────────────────────────────────── */}
      <aside className="flex flex-col gap-3">
        <section className="card-shadow card pad-md">
          <h2 className="mb-2.5 text-[13px] font-semibold text-text-primary">{tr("needHelp")}</h2>
          <div className="flex flex-col gap-2.5">
            {/* الدعمُ يُفتح بالحدث نفسه المستعمل في كلّ المنتج - لا رابطٌ
                إلى صفحةٍ لا وجود لها. */}
            <button
              onClick={() => window.dispatchEvent(new CustomEvent("adloop:open-support"))}
              // استجابةُ مرورٍ خاصّةٌ به: تعطيه إشارةً أوضحَ من الحلقة
              // الرمادية، وتُخرجه منها تلقائياً بحكم القاعدة في theme.css.
              className="flex items-start gap-2 text-start transition-opacity hover:opacity-70"
            >
              <ShieldCheck size={15} className="mt-0.5 shrink-0 text-accent" />
              <span className="min-w-0">
                <span className="block text-[12.5px] font-medium text-text-primary">{tr("helpTrouble")}</span>
                <span className="block text-[11.5px] text-text-muted">{tr("helpTroubleBody")}</span>
              </span>
            </button>
            <a href="/dashboard/help" className="flex items-start gap-2 no-underline">
              <Info size={15} className="mt-0.5 shrink-0 text-accent" />
              <span className="min-w-0">
                <span className="block text-[12.5px] font-medium text-text-primary">{tr("helpGuide")}</span>
                <span className="block text-[11.5px] text-text-muted">{tr("helpGuideBody")}</span>
              </span>
            </a>
          </div>
        </section>

        <div className="card-shadow flex items-start gap-2.5 card pad-md">
          <Info size={15} className="mt-0.5 shrink-0 text-accent" />
          <p className="text-[11.5px] leading-relaxed text-text-muted">{tr("covScopeNote")}</p>
        </div>
      </aside>
    </div>
  );
}
