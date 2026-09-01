"use client";

// app/dashboard/tracking/InstallTagPanel.tsx
//
// كان النظام يقول "وسم AdLoop غير موجود" ولا يقول ما هو الوسم ولا من أين
// يأتي. الكود كان في ملف توثيق فيه REPLACE_WITH_ACTUAL_WORKSPACE_ID -
// فحتى من يجده لا يعمل عنده.
//
// **القاعدة التي تحكم هذه اللوحة:** أي حالة تمنع المستخدم من المتابعة
// يجب أن تُظهر في مكانها: ما الناقص بالضبط، ولماذا يهمّ، والخطوة التالية
// جاهزة للتنفيذ - لا رسالة تشخيص تتركه يبحث.

import { useState } from "react";
import { Copy, Check, ChevronDown, ExternalLink } from "lucide-react";
import { t, type Locale } from "@/lib/i18n/dictionary";
import { CodeWindow } from "@/app/components/CodeWindow";

export function InstallTagPanel({
  workspaceId, appUrl, locale, defaultOpen = false,
}: {
  workspaceId: string;
  appUrl: string;
  locale: Locale;
  defaultOpen?: boolean;
}) {
  const tr = (k: string, v?: Record<string, string | number>) => t(locale, `tagInstall.${k}`, v);
  const [open, setOpen] = useState(defaultOpen);
  const [copied, setCopied] = useState<string | null>(null);

  // القيم الحقيقية مدموجة مسبقاً - لا عناصر نائبة يملؤها المستخدم يدوياً
  const snippet = buildSnippet(workspaceId, appUrl);
  const ctaExamples = `<a href="https://wa.me/9665XXXXXXXX" onclick="trackCtaClick('WHATSAPP')">${tr("egWhatsapp")}</a>

<a href="tel:+9665XXXXXXXX" onclick="trackCtaClick('CALL')">${tr("egCall")}</a>

<form onsubmit="trackCtaClick('FORM')"> … </form>`;

  async function copy(text: string, key: string) {
    await navigator.clipboard.writeText(text).catch(() => {});
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  }

  return (
    <section className="card-shadow mb-4 overflow-hidden rounded-2xl border border-accent/35 bg-accent/[0.04]">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 p-4 text-start"
      >
        <div>
          <h2 className="section-title">{tr("title")}</h2>
          <p className="mt-0.5 text-[12.5px] text-text-muted">{tr("subtitle")}</p>
        </div>
        <ChevronDown size={17} className={`shrink-0 text-text-muted transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="border-t border-accent/25 p-4">
          {/* لماذا يهمّ - قبل الكود لا بعده */}
          <p className="card mb-4 bg-surface/70 p-3 text-[12.5px] leading-relaxed text-text-muted">
            {tr("why")}
          </p>

          <Step n={1} title={tr("s1Title")} body={tr("s1Body")}>
            <CodeBlock code={snippet} copyLabel={tr("copy")} copiedLabel={tr("copied")} />
          </Step>

          <Step n={2} title={tr("s2Title")} body={tr("s2Body")}>
            <CodeBlock code={ctaExamples} copyLabel={tr("copy")} copiedLabel={tr("copied")} />
          </Step>

          <Step n={3} title={tr("s3Title")} body={tr("s3Body")} last />

          <div className="card mt-4 flex flex-wrap items-center gap-3 bg-surface/70 p-3">
            <span className="text-[12px] text-text-muted">{tr("wsIdLabel")}</span>
            <code className="rounded-lg bg-surface-raised px-2 py-1 font-mono text-[11.5px] text-text-primary">{workspaceId}</code>
            <button onClick={() => copy(workspaceId, "ws")} className="flex items-center gap-1 text-[11.5px] text-accent">
              {copied === "ws" ? <Check size={12} /> : <Copy size={12} />}
              {copied === "ws" ? tr("copied") : tr("copy")}
            </button>
          </div>

          <p className="mt-3 flex items-start gap-1.5 text-[11.5px] leading-relaxed text-text-faint">
            <ExternalLink size={12} className="mt-0.5 shrink-0" />
            {tr("gtmNote")}
          </p>
        </div>
      )}
    </section>
  );
}

function Step({
  n, title, body, children, last,
}: {
  n: number;
  title: string;
  body: string;
  children?: React.ReactNode;
  last?: boolean;
}) {
  return (
    <div className={last ? "" : "mb-4"}>
      <div className="mb-1.5 flex items-center gap-2">
        <span className="flex h-5 w-5 items-center justify-center rounded-md bg-accent/15 text-[11px] font-semibold text-accent">{n}</span>
        <span className="text-[13px] font-medium text-text-primary">{title}</span>
      </div>
      <p className="mb-2 ps-7 text-[12.5px] leading-relaxed text-text-muted">{body}</p>
      {children && <div className="ps-7">{children}</div>}
    </div>
  );
}

function CodeBlock({
  code, copyLabel, copiedLabel,
}: {
  code: string;
  copyLabel: string;
  copiedLabel: string;
}) {
  // الوسمُ هو الشيء الوحيد الذي جاء التاجرُ لينسخه، وكان يُعرَض نصّاً
  // أسودَ متجانساً - فالوسمُ والسمةُ والقيمةُ سواء. النافذةُ الملوّنة
  // تُري أينَ معرّفُه قبل أن يقرأ السطر. (`CodeWindow` يملك زرّ النسخ
  // بنفسه، فزرُّ الأب المطلقُ الموضع - الذي كان يقف فوق النصّ - سقط معه.)
  return (
    <CodeWindow
      code={code}
      lang="markup"
      title="tag"
      copyLabel={copyLabel}
      copiedLabel={copiedLabel}
    />
  );
}

/**
 * الكود بقيم مساحة العمل الحقيقية مدموجة. النسخة المرجعية في docs كانت
 * تحوي REPLACE_WITH_ACTUAL_WORKSPACE_ID وYOUR_ADLOOP_DOMAIN - عنصران
 * نائبان يعطّلان التتبّع صامتاً لمن ينسخ ولا ينتبه.
 */
function buildSnippet(workspaceId: string, appUrl: string): string {
  return `<!-- AdLoop tracking tag -->
<script>
(function () {
  var WORKSPACE_ID = "${workspaceId}";
  var ENDPOINT = "${appUrl}/api/track/cta-click";

  function sessionId() {
    var id = localStorage.getItem("adloop_session_id");
    if (!id) {
      id = (crypto.randomUUID && crypto.randomUUID()) ||
           String(Date.now()) + Math.random().toString(16).slice(2);
      localStorage.setItem("adloop_session_id", id);
    }
    return id;
  }

  var CLICK_IDS = {
    gclid: "GOOGLE_ADS",
    fbclid: "META_ADS",
    ttclid: "TIKTOK_ADS",
    sc_click_id: "SNAPCHAT_ADS"
  };

  function clickInfo() {
    var p = new URLSearchParams(window.location.search);
    for (var key in CLICK_IDS) {
      var v = p.get(key);
      if (v) return { clickId: v, platform: CLICK_IDS[key] };
    }
    var savedId = localStorage.getItem("adloop_click_id");
    var savedPlatform = localStorage.getItem("adloop_click_platform");
    return savedId && savedPlatform ? { clickId: savedId, platform: savedPlatform } : null;
  }

  var info = clickInfo();
  if (info) {
    localStorage.setItem("adloop_click_id", info.clickId);
    localStorage.setItem("adloop_click_platform", info.platform);
  }

  window.trackCtaClick = function (ctaType) {
    fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workspaceId: WORKSPACE_ID,
        sessionId: sessionId(),
        gclid: info && info.platform === "GOOGLE_ADS" ? info.clickId : undefined,
        clickId: info ? info.clickId : undefined,
        clickPlatform: info ? info.platform : undefined,
        ctaType: ctaType
      }),
      keepalive: true
    });
  };
})();
</script>`;
}
