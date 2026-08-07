"use client";

// app/dashboard/campaigns/competitor-ads/CompetitorBoardClient.tsx
//
// لوحة إعلانات المنافسين داخل AdLoop. الصفحة السابقة كانت حقل بحث وزرّاً
// يفتح موقع ميتا في تبويب آخر - أي أنها لم تكن صفحة، كانت رابطاً.
//
// السحب الآلي غير ممكن (الـAPI يُرجع الإعلانات التجارية لدول الاتحاد
// الأوروبي وبريطانيا فقط)، فالقيمة هنا ليست في النقل بل فيما نشتقّه:
// **مدّة بقاء الإعلان**. لا أحد يدفع شهرين على إعلان فاشل - فالأطول
// بقاءً هو الرابح، وهذه إشارة لا تعرضها المكتبة لأنها لا تعرف متى رصدته.

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Plus, ExternalLink, Trash2, CheckCircle2, PauseCircle, Trophy,
  Image as ImageIcon, Video, Layers, Type, X, Search, AlertTriangle, Loader2,
} from "lucide-react";
import { MetricCard } from "@/app/components/ui/MetricCard";
import { t, type Locale } from "@/lib/i18n/dictionary";
import type { BoardSummary, CompetitorAdView, AdFormat } from "@/lib/competitorBoard";

const FORMATS: AdFormat[] = ["IMAGE", "VIDEO", "CAROUSEL", "TEXT"];
const FORMAT_ICON: Record<AdFormat, typeof ImageIcon> = {
  IMAGE: ImageIcon, VIDEO: Video, CAROUSEL: Layers, TEXT: Type,
};
const COUNTRIES = ["EG", "SA", "AE", "KW", "QA", "OM", "BH", "JO", "MA"];

export function CompetitorBoardClient({
  workspaceId, board, locale,
}: {
  workspaceId: string;
  board: BoardSummary;
  locale: Locale;
}) {
  const tr = (k: string, v?: Record<string, string | number>) => t(locale, `competitors.${k}`, v);
  const router = useRouter();

  const [addingCompetitor, setAddingCompetitor] = useState(false);
  const [addingAdFor, setAddingAdFor] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "running" | "proven">("all");
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return board.competitors
      .filter((c) => !q || c.name.toLowerCase().includes(q))
      .map((c) => ({
        ...c,
        ads: c.ads.filter((a) =>
          filter === "all" ? true : filter === "running" ? a.stillRunning : a.proven
        ),
      }));
  }, [board.competitors, filter, query]);

  async function confirmRunning(competitorId: string, adId: string) {
    setBusy(adId);
    await fetch(`/api/workspaces/${workspaceId}/competitors/${competitorId}/ads`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ adId, confirmRunning: true }),
    }).catch(() => {});
    setBusy(null);
    router.refresh();
  }

  async function markStopped(competitorId: string, adId: string) {
    setBusy(adId);
    await fetch(`/api/workspaces/${workspaceId}/competitors/${competitorId}/ads`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ adId, stillRunning: false }),
    }).catch(() => {});
    setBusy(null);
    router.refresh();
  }

  async function removeAd(competitorId: string, adId: string) {
    setBusy(adId);
    await fetch(`/api/workspaces/${workspaceId}/competitors/${competitorId}/ads?adId=${adId}`, {
      method: "DELETE",
    }).catch(() => {});
    setBusy(null);
    router.refresh();
  }

  async function removeCompetitor(competitorId: string) {
    setBusy(competitorId);
    await fetch(`/api/workspaces/${workspaceId}/competitors/${competitorId}`, { method: "DELETE" }).catch(() => {});
    setBusy(null);
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-[1300px] pb-12">
      <header className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="page-title">{tr("title")}</h1>
          <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-text-muted">{tr("subtitle")}</p>
        </div>
        <button
          onClick={() => setAddingCompetitor(true)}
          className="btn btn-primary"
        >
          <Plus size={15} /> {tr("addCompetitor")}
        </button>
      </header>

      <QuickSearch tr={tr} locale={locale} />

      {board.totalAds > 0 && (
        <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard label={tr("kpiTracked")} value={String(board.competitors.length)} icon={Search} tone="default" locale={locale}
          explainKey="competitorsTracked"
        />
          <MetricCard label={tr("kpiRunning")} value={String(board.totalActive)} icon={CheckCircle2} tone="verified" locale={locale}
          explainKey="competitorAdsRunning"
        />
          <MetricCard
            label={tr("kpiProven")}
            value={String(board.totalProven)}
            icon={Trophy}
            tone="gap"
            caption={{ text: tr("provenHint"), tone: "muted" }}
            locale={locale}
            explainKey="competitorProven"
          />
          <MetricCard
            label={tr("kpiLongest")}
            value={String(board.topRunningDays)}
            unit={tr("days")}
            icon={Trophy}
            tone="accent"
            caption={
              board.dominantFormat
                ? { text: tr("dominantFormat", { format: tr(`fmt${board.dominantFormat}`), pct: board.dominantFormatPct }), tone: "muted" }
                : undefined
            }
            locale={locale}
            explainKey="competitorLongest"
          />
        </div>
      )}

      {board.competitors.length === 0 ? (
        <EmptyBoard tr={tr} onAdd={() => setAddingCompetitor(true)} />
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div className="flex gap-1">
              {(["all", "running", "proven"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`rounded-xl px-3.5 py-2 text-[12.5px] font-medium transition-colors ${
                    filter === f ? "bg-accent text-white" : "border border-border bg-surface text-text-muted"
                  }`}
                >
                  {tr(`filter${f[0].toUpperCase()}${f.slice(1)}`)}
                </button>
              ))}
            </div>
            <div className="relative">
              <Search size={14} className="absolute top-1/2 -translate-y-1/2 text-text-faint" style={{ insetInlineStart: 11 }} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={tr("searchCompetitor")}
                className="field w-52"
                style={{ paddingInlineStart: 32, paddingInlineEnd: 12 }}
              />
            </div>
          </div>

          <div className="flex flex-col gap-5">
            {visible.map((c) => (
              <section key={c.id} className="card pad-md">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h2 className="section-title">{c.name}</h2>
                      <span className="rounded-full bg-surface-raised px-2 py-0.5 text-[10.5px] text-text-muted">{c.country}</span>
                      {c.longestRunningDays >= 21 && (
                        <span className="flex items-center gap-1 rounded-full bg-gap/12 px-2 py-0.5 text-[10.5px] font-medium text-gap">
                          <Trophy size={10} /> {tr("longestBadge", { n: c.longestRunningDays })}
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-[12px] text-text-muted">
                      {tr("competitorStats", { total: c.ads.length, running: c.activeCount, proven: c.provenCount })}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-1.5">
                    <a
                      href={adLibraryUrl(c.name, c.country)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-secondary btn-sm"
                      title={tr("findNewHint")}
                    >
                      <ExternalLink size={13} /> {tr("findNew")}
                    </a>
                    <button
                      onClick={() => setAddingAdFor(c.id)}
                      className="btn btn-primary btn-sm"
                    >
                      <Plus size={13} /> {tr("addAd")}
                    </button>
                    <button
                      onClick={() => removeCompetitor(c.id)}
                      disabled={busy === c.id}
                      aria-label={tr("removeCompetitor")}
                      className="card-inset p-2 text-text-muted hover:text-critical disabled:opacity-50"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                {c.ads.length === 0 ? (
                  <p className="card-ghost pad-lg text-center text-[12.5px] text-text-muted">
                    {tr("noAdsYet")}
                  </p>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {c.ads.map((ad) => (
                      <AdCard
                        key={ad.id}
                        ad={ad}
                        tr={tr}
                        busy={busy === ad.id}
                        onConfirm={() => confirmRunning(c.id, ad.id)}
                        onStop={() => markStopped(c.id, ad.id)}
                        onRemove={() => removeAd(c.id, ad.id)}
                      />
                    ))}
                  </div>
                )}
              </section>
            ))}
          </div>
        </>
      )}

      <p className="mt-6 bg-surface-raised p-3 text-[11.5px] leading-relaxed text-text-faint">
        {tr("apiNote")}
      </p>

      {addingCompetitor && (
        <CompetitorModal workspaceId={workspaceId} tr={tr} onClose={() => setAddingCompetitor(false)} />
      )}
      {addingAdFor && (
        <AdModal
          workspaceId={workspaceId}
          competitorId={addingAdFor}
          tr={tr}
          onClose={() => setAddingAdFor(null)}
        />
      )}
    </div>
  );
}


// ==================== البحث السريع في مكتبة الإعلانات ====================
//
// كان هذا كلّ ما في الصفحة سابقاً، ويعمل فعلاً: تكتب اسماً فتفتح مكتبة
// ميتا عليه. حُذف عند بناء اللوحة، وإزالة ما يعمل خسارة صافية - فعاد
// أعلى الصفحة، واللوحة تحته لمن يريد تتبّعاً لا بحثاً عابراً.

function QuickSearch({
  tr, locale,
}: {
  tr: (k: string, v?: Record<string, string | number>) => string;
  locale: Locale;
}) {
  const [brand, setBrand] = useState("");
  const [country, setCountry] = useState("EG");

  const url = brand.trim() ? adLibraryUrl(brand.trim(), country) : null;

  return (
    <section className="card-shadow mb-5 card pad-md">
      <h2 className="section-title">{tr("quickTitle")}</h2>
      <p className="mb-3 mt-0.5 text-[12.5px] leading-relaxed text-text-muted">{tr("quickBody")}</p>

      <div className="flex flex-wrap gap-2">
        <input
          value={brand}
          onChange={(e) => setBrand(e.target.value)}
          placeholder={tr("quickPlaceholder")}
          className="field min-w-[200px] flex-1"
        />
        <select
          value={country}
          onChange={(e) => setCountry(e.target.value)}
          className="field text-[13px]"
        >
          {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <a
          href={url ?? undefined}
          target="_blank"
          rel="noopener noreferrer"
          aria-disabled={!url}
          onClick={(e) => { if (!url) e.preventDefault(); }}
          className={`flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-[13px] font-medium no-underline ${
            url ? "bg-accent text-white" : "cursor-not-allowed bg-surface-raised text-text-faint"
          }`}
        >
          <ExternalLink size={14} /> {tr("quickOpen")}
        </a>
      </div>
      <span className="hidden">{locale}</span>
    </section>
  );
}

// ==================== بطاقة الإعلان ====================

function AdCard({
  ad, tr, busy, onConfirm, onStop, onRemove,
}: {
  ad: CompetitorAdView;
  tr: (k: string, v?: Record<string, string | number>) => string;
  busy: boolean;
  onConfirm: () => void;
  onStop: () => void;
  onRemove: () => void;
}) {
  const Icon = FORMAT_ICON[ad.format];
  return (
    <div className={`overflow-hidden rounded-xl border bg-surface-raised/50 ${ad.proven ? "border-gap/40" : "border-border"}`}>
      {/* المعاينة: الصورة إن وُجدت، وإلا شكل الإعلان كأيقونة - لا مربّع فارغ */}
      <div className="relative flex h-36 items-center justify-center overflow-hidden bg-surface">
        {ad.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={ad.imageUrl} alt={ad.headline ?? ""} className="h-full w-full object-cover" />
        ) : (
          <Icon size={26} className="text-text-faint" />
        )}

        <span
          className={`absolute top-2 flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
            ad.proven ? "bg-gap text-white" : ad.stillRunning ? "bg-verified/90 text-white" : "bg-surface-raised text-text-muted"
          }`}
          style={{ insetInlineStart: 8 }}
        >
          {ad.proven && <Trophy size={9} />}
          {tr("nDaysRunning", { n: ad.runningDays })}
        </span>

        {ad.staleConfirm && (
          <span
            className="absolute top-2 flex items-center gap-1 rounded-full bg-surface/90 px-2 py-0.5 text-[10px] text-gap"
            style={{ insetInlineEnd: 8 }}
            title={tr("staleHint")}
          >
            <AlertTriangle size={9} />
          </span>
        )}
      </div>

      <div className="p-2.5">
        <div className="mb-1 flex items-center gap-1.5">
          <Icon size={11} className="shrink-0 text-text-faint" />
          <span className="truncate text-[12px] font-medium text-text-primary" title={ad.headline ?? ""}>
            {ad.headline || tr("noHeadline")}
          </span>
        </div>
        {ad.body && <p className="mb-2 line-clamp-2 text-[11.5px] leading-relaxed text-text-muted">{ad.body}</p>}
        {ad.ctaLabel && (
          <span className="mb-2 inline-block rounded-md bg-accent/10 px-1.5 py-0.5 text-[10.5px] text-accent">{ad.ctaLabel}</span>
        )}

        <div className="mt-1.5 flex items-center gap-1">
          {ad.stillRunning ? (
            <>
              <button
                onClick={onConfirm}
                disabled={busy}
                title={tr("confirmHint")}
                className="flex flex-1 items-center justify-center gap-1 card py-1.5 text-[11px] text-text-primary disabled:opacity-50"
              >
                {busy ? <Loader2 size={10} className="animate-spin" /> : <CheckCircle2 size={10} />}
                {tr("confirm")}
              </button>
              <button
                onClick={onStop}
                disabled={busy}
                title={tr("stopHint")}
                className="card p-1.5 text-text-muted hover:text-gap disabled:opacity-50"
                aria-label={tr("markStopped")}
              >
                <PauseCircle size={11} />
              </button>
            </>
          ) : (
            <span className="flex-1 rounded-lg bg-surface py-1.5 text-center text-[11px] text-text-faint">{tr("stopped")}</span>
          )}

          {ad.sourceUrl && (
            <a
              href={ad.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="card p-1.5 text-text-muted no-underline hover:text-accent"
              aria-label={tr("openSource")}
            >
              <ExternalLink size={11} />
            </a>
          )}
          <button
            onClick={onRemove}
            disabled={busy}
            className="card p-1.5 text-text-muted hover:text-critical disabled:opacity-50"
            aria-label={tr("removeAd")}
          >
            <Trash2 size={11} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ==================== النوافذ ====================

function CompetitorModal({
  workspaceId, tr, onClose,
}: {
  workspaceId: string;
  tr: (k: string, v?: Record<string, string | number>) => string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [country, setCountry] = useState("EG");
  const [pageUrl, setPageUrl] = useState("");
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!name.trim()) return;
    setBusy(true);
    await fetch(`/api/workspaces/${workspaceId}/competitors`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), country, pageUrl: pageUrl.trim() || null }),
    }).catch(() => {});
    setBusy(false);
    onClose();
    router.refresh();
  }

  return (
    <Modal onClose={onClose} title={tr("addCompetitor")}>
      <Field label={tr("competitorName")}>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder={tr("competitorNamePlaceholder")} className={INPUT} />
      </Field>
      <Field label={tr("country")}>
        <select value={country} onChange={(e) => setCountry(e.target.value)} className={INPUT}>
          {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </Field>
      <Field label={tr("pageUrl")}>
        <input value={pageUrl} onChange={(e) => setPageUrl(e.target.value)} placeholder="facebook.com/…" className={INPUT} dir="ltr" />
      </Field>
      <Actions tr={tr} busy={busy} disabled={!name.trim()} onCancel={onClose} onSave={save} />
    </Modal>
  );
}

function AdModal({
  workspaceId, competitorId, tr, onClose,
}: {
  workspaceId: string;
  competitorId: string;
  tr: (k: string, v?: Record<string, string | number>) => string;
  onClose: () => void;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [headline, setHeadline] = useState("");
  const [body, setBody] = useState("");
  const [ctaLabel, setCta] = useState("");
  const [format, setFormat] = useState<AdFormat>("IMAGE");
  const [sourceUrl, setSourceUrl] = useState("");
  const [firstSeenAt, setFirstSeen] = useState("");
  const [imageUrl, setImage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function pickImage(file: File) {
    // تصغير قبل التخزين: لقطة شاشة خام تتجاوز حدّ الحقل بسهولة
    const reader = new FileReader();
    reader.onload = () => setImage(String(reader.result));
    reader.readAsDataURL(file);
  }

  async function save() {
    setBusy(true);
    await fetch(`/api/workspaces/${workspaceId}/competitors/${competitorId}/ads`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ headline, body, ctaLabel, format, sourceUrl, firstSeenAt: firstSeenAt || null, imageUrl }),
    }).catch(() => {});
    setBusy(false);
    onClose();
    router.refresh();
  }

  return (
    <Modal onClose={onClose} title={tr("addAd")}>
      <Field label={tr("adFormat")}>
        <div className="flex gap-1.5">
          {FORMATS.map((f) => {
            const Icon = FORMAT_ICON[f];
            return (
              <button
                key={f}
                onClick={() => setFormat(f)}
                className={`flex flex-1 items-center justify-center gap-1 rounded-lg border py-1.5 text-[11.5px] ${
                  format === f ? "border-accent bg-accent/10 text-accent" : "border-border bg-surface-raised text-text-muted"
                }`}
              >
                <Icon size={12} /> {tr(`fmt${f}`)}
              </button>
            );
          })}
        </div>
      </Field>

      <Field label={tr("adImage")}>
        <div className="flex items-center gap-2">
          {imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageUrl} alt="" className="h-11 w-11 rounded-lg object-cover" />
          )}
          <button onClick={() => fileRef.current?.click()} className="flex-1 card-inset py-2 text-[12px] text-text-primary">
            {imageUrl ? tr("changeImage") : tr("uploadImage")}
          </button>
          <input
            ref={fileRef} type="file" accept="image/*" className="sr-only"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) pickImage(f); e.target.value = ""; }}
          />
        </div>
      </Field>

      <Field label={tr("adHeadline")}>
        <input value={headline} onChange={(e) => setHeadline(e.target.value)} className={INPUT} />
      </Field>
      <Field label={tr("adBody")}>
        <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={2} className={`${INPUT} resize-none`} />
      </Field>
      <Field label={tr("adCta")}>
        <input value={ctaLabel} onChange={(e) => setCta(e.target.value)} placeholder={tr("adCtaPlaceholder")} className={INPUT} />
      </Field>
      <Field label={tr("firstSeen")} hint={tr("firstSeenHint")}>
        <input type="date" value={firstSeenAt} onChange={(e) => setFirstSeen(e.target.value)} className={INPUT} />
      </Field>
      <Field label={tr("sourceUrl")}>
        <input value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} placeholder="facebook.com/ads/library/…" className={INPUT} dir="ltr" />
      </Field>

      <Actions tr={tr} busy={busy} disabled={false} onCancel={onClose} onSave={save} />
    </Modal>
  );
}

// ==================== أجزاء ====================

const INPUT =
  "w-full card-inset px-3 py-2 text-[13px] text-text-primary outline-none placeholder:text-text-faint focus:border-accent";

function Modal({ children, onClose, title }: { children: React.ReactNode; onClose: () => void; title: string }) {
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="pop-shadow max-h-[88vh] w-full max-w-md overflow-y-auto card pad-md">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="section-title">{title}</h2>
          <button onClick={onClose} className="rounded-lg p-1 text-text-muted hover:bg-surface-raised"><X size={16} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="mb-3">
      <label className="mb-1 block text-[12px] text-text-muted">{label}</label>
      {children}
      {hint && <p className="mt-1 text-[11px] leading-relaxed text-text-faint">{hint}</p>}
    </div>
  );
}

function Actions({
  tr, busy, disabled, onCancel, onSave,
}: {
  tr: (k: string) => string;
  busy: boolean;
  disabled: boolean;
  onCancel: () => void;
  onSave: () => void;
}) {
  return (
    <div className="mt-4 flex justify-end gap-2">
      <button onClick={onCancel} className="btn btn-secondary btn-sm">{tr("cancel")}</button>
      <button onClick={onSave} disabled={busy || disabled} className="btn btn-primary">
        {busy ? tr("saving") : tr("save")}
      </button>
    </div>
  );
}

function EmptyBoard({ tr, onAdd }: { tr: (k: string) => string; onAdd: () => void }) {
  return (
    <div className="rounded-2xl border border-dashed border-border p-12 text-center">
      <Search size={26} className="mx-auto mb-3 text-text-faint" />
      <p className="text-[14px] font-medium text-text-primary">{tr("emptyTitle")}</p>
      <p className="mx-auto mt-1 max-w-md text-[12.5px] leading-relaxed text-text-muted">{tr("emptyBody")}</p>
      <button onClick={onAdd} className="btn btn-primary mt-4">
        <Plus size={15} /> {tr("addCompetitor")}
      </button>
    </div>
  );
}

function adLibraryUrl(name: string, country: string): string {
  return `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=${country}&q=${encodeURIComponent(name)}&media_type=all`;
}
