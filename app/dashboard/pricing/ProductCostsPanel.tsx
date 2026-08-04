"use client";

// app/dashboard/pricing/ProductCostsPanel.tsx
//
// تكلفة البضاعة هي الرقم الذي تقف عليه كل حسابات الربح والتسعير في
// المنتج. كان إدخالها يدوياً منتجاً بمنتج - مستحيل عملياً عند مئتي منتج،
// فيبقى القسم كلّه معطَّلاً عمن يحتاجه أكثر.
//
// طريقان لأن ثلاثاً من المنصات الخمس لا تُعرّض التكلفة إطلاقاً: سحب مباشر
// لمن تدعمه منصّته، وملف CSV للبقية. وكل نتيجة تُقال كاملة - ماذا تغيّر،
// وماذا لم يتغيّر، ولماذا.

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, Upload, RefreshCw, Loader2, AlertTriangle, CheckCircle2 } from "lucide-react";
import { t, type Locale } from "@/lib/i18n/dictionary";
import { PLATFORM_LABEL, type EcommercePlatform } from "@/lib/ecommerce/types";

interface SyncResponse {
  ok: boolean;
  platform?: string;
  updated: number;
  emptyAtSource: number;
  unmatched: number;
  reasonKey?: string;
  reasonVars?: Record<string, string | number>;
}

interface ImportResponse {
  updated: number;
  unmatched: string[];
  invalid: number[];
  totalRows: number;
}

type Line = { text: string; tone: "positive" | "negative" | "neutral" };

export function ProductCostsPanel({
  workspaceId, missingCount, locale = "ar",
}: {
  workspaceId: string;
  missingCount: number;
  locale?: Locale;
}) {
  const tr = (k: string, v?: Record<string, string | number>) => t(locale, `cogs.${k}`, v);
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [busy, setBusy] = useState<"sync" | "import" | null>(null);
  const [lines, setLines] = useState<Line[]>([]);

  async function pull() {
    setBusy("sync");
    setLines([]);
    const res = await fetch(`/api/workspaces/${workspaceId}/product-costs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "sync" }),
    }).catch(() => null);
    setBusy(null);
    if (!res?.ok) { setLines([{ text: tr("csFetchFailed", { error: res?.status ?? "network" }), tone: "negative" }]); return; }

    const d: SyncResponse = await res.json();
    if (!d.ok) {
      // المنصة تُترجَم عند العرض - المحرّك يمرّرها كمفتاح لا كنصّ جاهز
      const vars = { ...d.reasonVars } as Record<string, string | number>;
      if (typeof vars.platform === "string") {
        const label = PLATFORM_LABEL[vars.platform as EcommercePlatform];
        if (label) vars.platform = locale === "en" ? label.en : label.ar;
      }
      setLines([{ text: tr(d.reasonKey ?? "csFetchFailed", vars), tone: "negative" }]);
      return;
    }

    const out: Line[] = [];
    if (d.updated > 0) out.push({ text: tr("resUpdated", { n: d.updated }), tone: "positive" });
    if (d.emptyAtSource > 0) out.push({ text: tr("resEmptyAtSource", { n: d.emptyAtSource }), tone: "neutral" });
    if (d.unmatched > 0) out.push({ text: tr("resUnmatched", { n: d.unmatched }), tone: "neutral" });
    if (out.length === 0) out.push({ text: tr("resNoChange"), tone: "neutral" });
    setLines(out);
    router.refresh();
  }

  async function upload(file: File) {
    setBusy("import");
    setLines([]);
    const csv = await file.text();
    const res = await fetch(`/api/workspaces/${workspaceId}/product-costs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "import", csv }),
    }).catch(() => null);
    setBusy(null);
    if (!res?.ok) { setLines([{ text: tr("csFetchFailed", { error: res?.status ?? "network" }), tone: "negative" }]); return; }

    const d: ImportResponse = await res.json();
    const out: Line[] = [];
    if (d.updated > 0) out.push({ text: tr("impUpdated", { n: d.updated }), tone: "positive" });
    if (d.unmatched.length > 0) {
      out.push({ text: tr("impUnmatched", { n: d.unmatched.length, list: d.unmatched.slice(0, 8).join(t(locale, "ui.listSep")) }), tone: "neutral" });
    }
    if (d.invalid.length > 0) {
      out.push({ text: tr("impInvalid", { n: d.invalid.length, lines: d.invalid.slice(0, 10).join(", ") }), tone: "negative" });
    }
    if (out.length === 0) out.push({ text: tr("impNothing"), tone: "neutral" });
    setLines(out);
    router.refresh();
  }

  return (
    <section className="card-shadow mb-5 card pad-md">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="section-title">{tr("title")}</h2>
          <p className="mt-0.5 text-[12.5px] leading-relaxed text-text-muted">{tr("subtitle")}</p>
        </div>
        {missingCount > 0 ? (
          <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-gap/12 px-3 py-1.5 text-[12px] font-medium text-gap">
            <AlertTriangle size={13} /> {tr("missingCount", { n: missingCount })}
          </span>
        ) : (
          <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-verified/12 px-3 py-1.5 text-[12px] font-medium text-verified">
            <CheckCircle2 size={13} /> {tr("allSet")}
          </span>
        )}
      </div>

      {missingCount > 0 && (
        <p className="mb-3 rounded-xl bg-gap/[0.07] p-2.5 text-[12px] leading-relaxed text-text-muted">
          {tr("missingHint")}
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="bg-surface-raised p-3">
          <div className="text-[13px] font-medium text-text-primary">{tr("pullTitle")}</div>
          <p className="mb-2.5 mt-0.5 text-[12px] leading-relaxed text-text-muted">{tr("pullBody")}</p>
          <button
            onClick={pull}
            disabled={busy !== null}
            className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-accent py-2 text-[12.5px] font-medium text-white disabled:opacity-50"
          >
            {busy === "sync" ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            {busy === "sync" ? tr("pulling") : tr("pull")}
          </button>
        </div>

        <div className="bg-surface-raised p-3">
          <div className="text-[13px] font-medium text-text-primary">{tr("csvTitle")}</div>
          <p className="mb-2.5 mt-0.5 text-[12px] leading-relaxed text-text-muted">{tr("csvBody")}</p>
          <div className="flex gap-2">
            <a
              href={`/api/workspaces/${workspaceId}/product-costs`}
              className="flex flex-1 items-center justify-center gap-1.5 card py-2 text-[12.5px] font-medium text-text-primary no-underline"
            >
              <Download size={14} /> {tr("download")}
            </a>
            <button
              onClick={() => fileRef.current?.click()}
              disabled={busy !== null}
              className="flex flex-1 items-center justify-center gap-1.5 card py-2 text-[12.5px] font-medium text-text-primary disabled:opacity-50"
            >
              {busy === "import" ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
              {busy === "import" ? tr("uploading") : tr("upload")}
            </button>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            aria-label={tr("pickFile")}
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) upload(f);
              e.target.value = "";
            }}
          />
        </div>
      </div>

      {lines.length > 0 && (
        <ul className="mt-3 flex flex-col gap-1.5 rounded-xl bg-surface-raised/70 p-3">
          {lines.map((l, i) => (
            <li key={i} className="flex items-start gap-2 text-[12.5px] leading-relaxed">
              <span
                className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full"
                style={{
                  background:
                    l.tone === "positive" ? "var(--verified)"
                    : l.tone === "negative" ? "var(--critical)"
                    : "var(--text-faint)",
                }}
              />
              <span className="text-text-primary">{l.text}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
