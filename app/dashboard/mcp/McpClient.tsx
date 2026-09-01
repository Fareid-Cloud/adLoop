"use client";

// app/dashboard/mcp/McpClient.tsx
//
// **صفحةُ ربطٍ تُقرأ في مرّة، لا عمودٌ يُنزَل فيه.**
//
// 🔴 كانت الصفحة ستّ كتلٍ مرصوصةً رأسياً: بطاقةُ نطاقٍ بأحد عشر رقاقة،
// ثمّ عمودُ خطواتٍ ثلاث بخيطٍ واصل، ثمّ جدولُ مفاتيح، ثمّ مثال، ثمّ قائمةُ
// عملاء. وكلٌّ منها صحيحٌ وحدَه، ومجموعُها شاشةٌ لا تُرى نهايتُها -
// فالقارئ لا يعرف أين يبدأ، والخيطُ الواصل يَعِد بتسلسلٍ إجباريٍّ بينما
// اختيارُ المساحة ليس إنجازاً يُحتفَل به بعلامة تمام.
//
// البنية الآن **أقسامٌ لا خطوات**: تبويبُ العميل يحكم ما تحته، والإعداد
// كتلةٌ واحدة (مفتاح ثمّ إعداد)، ثمّ الأدوات، ثمّ الحدود، ثمّ المفاتيح.
// واختيارُ المساحة صار ضابطاً في الترويسة - وهو ما هو: نطاقُ ما يُقرأ،
// لا مرحلةٌ من مراحل التركيب.
//
// ومؤشّر «اشتغل» باقٍ: الصفحة تستطلع `lastUsedAt` بعد توليد المفتاح،
// وأوّلُ نداءٍ يصل يقلب الشارة خضراء - يقول المنتج «تمّ» قبل أن يُسأل.

import { useEffect, useMemo, useState } from "react";
import { Check, Copy, KeyRound, Loader2, ShieldCheck, Trash2, X } from "lucide-react";
import { t, type Locale } from "@/lib/i18n/dictionary";
import { Select } from "@/app/components/ui/Select";

interface TokenRow {
  id: string;
  label: string;
  lastFour: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}

type ClientKey = "claudeCode" | "desktop" | "cursor" | "gemini" | "kimi" | "web" | "gpt" | "custom";

const CLIENTS: Array<{ key: ClientKey; label: string }> = [
  { key: "claudeCode", label: "Claude Code" },
  { key: "desktop", label: "Claude Desktop" },
  { key: "cursor", label: "Cursor" },
  { key: "gemini", label: "Gemini CLI" },
  { key: "kimi", label: "Kimi CLI" },
  { key: "web", label: "claude.ai" },
  { key: "gpt", label: "ChatGPT" },
  { key: "custom", label: "JSON-RPC" },
];

const ALSO_WORKS = ["Windsurf", "Continue", "Zed", "LangChain", "LlamaIndex", "n8n"];

/**
 * أسماءُ الأدوات كما يعرّفها الخادم (`lib/mcp/tools.ts`) - **لا تُترجَم
 * ولا تُخترَع**: هي معرّفاتٌ يناديها المساعد حرفياً، فأيّ تجميلٍ لها هنا
 * يجعل الصفحة تَعِد بأداةٍ لا وجود لها.
 */
const TOOLS = [
  "get_truth_snapshot", "list_campaigns", "compare_periods", "get_creative_performance",
  "get_search_terms", "get_funnel", "get_cohorts", "get_customer_journey",
  "get_customer_analytics", "get_ltv_by_channel", "get_store_metrics",
  "get_orders_summary", "get_pending_decisions", "search_help",
];

export function McpClient({
  locale,
  workspaces,
  initialWorkspaceId,
  mcpUrl,
}: {
  locale: Locale;
  workspaces: Array<{ id: string; name: string }>;
  initialWorkspaceId: string;
  mcpUrl: string;
}) {
  const tr = (k: string, v?: Record<string, string | number>) => t(locale, `mcp.${k}`, v);

  const [workspaceId, setWorkspaceId] = useState(initialWorkspaceId);
  const [label, setLabel] = useState("");
  const [expiresInDays, setExpiresInDays] = useState("0");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fresh, setFresh] = useState<{ id: string; token: string } | null>(null);
  const [tokens, setTokens] = useState<TokenRow[]>([]);
  const [copied, setCopied] = useState<string | null>(null);
  const [client, setClient] = useState<ClientKey>("claudeCode");
  const [confirming, setConfirming] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);

  async function load(ws: string) {
    const r = await fetch(`/api/workspaces/${ws}/mcp-tokens`);
    if (r.ok) setTokens((await r.json()).tokens ?? []);
  }
  useEffect(() => {
    void load(workspaceId);
    setFresh(null);
    setConnected(false);
  }, [workspaceId]);

  // الاستطلاع يعمل فقط بعد توليد مفتاح، ويتوقّف فور وصول أوّل نداء.
  useEffect(() => {
    if (!fresh || connected) return;
    const timer = setInterval(async () => {
      const r = await fetch(`/api/workspaces/${workspaceId}/mcp-tokens`);
      if (!r.ok) return;
      const rows: TokenRow[] = (await r.json()).tokens ?? [];
      setTokens(rows);
      if (rows.find((x) => x.id === fresh.id)?.lastUsedAt) setConnected(true);
    }, 5000);
    return () => clearInterval(timer);
  }, [fresh, connected, workspaceId]);

  const snippet = useMemo(() => {
    const key = fresh?.token ?? "YOUR_KEY";
    if (client === "claudeCode") {
      return `claude mcp add --transport http adloop ${mcpUrl} --header "Authorization: Bearer ${key}"`;
    }
    if (client === "web" || client === "gpt") return mcpUrl;
    // 🔴 كلٌّ بمفتاح النقل الخاصّ به: Gemini تميّز النقل باسم الحقل
    // (`httpUrl` لا `url`)، فحقلٌ خاطئ يجعلها تحاول SSE وتفشل بصمت.
    if (client === "gemini") {
      return JSON.stringify(
        { mcpServers: { adloop: { httpUrl: mcpUrl, headers: { Authorization: `Bearer ${key}` } } } },
        null, 2);
    }
    if (client === "custom") {
      return `curl -X POST ${mcpUrl} \\
  -H "Authorization: Bearer ${key}" \\
  -H "Content-Type: application/json" \\
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'`;
    }
    return JSON.stringify(
      { mcpServers: { adloop: { url: mcpUrl, headers: { Authorization: `Bearer ${key}` } } } },
      null, 2);
  }, [client, fresh, mcpUrl]);

  const installNote =
    client === "claudeCode" ? tr("installClaudeCode")
    : client === "desktop" ? tr("installDesktop")
    : client === "cursor" ? tr("installCursor")
    : client === "gemini" ? tr("installGemini")
    : client === "kimi" ? tr("installKimi")
    : client === "web" ? tr("installWeb")
    : client === "gpt" ? tr("installGpt")
    : tr("installCustom");

  async function generate() {
    setBusy(true);
    setError(null);
    try {
      const r = await fetch(`/api/workspaces/${workspaceId}/mcp-tokens`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label, expiresInDays: Number(expiresInDays) }),
      });
      const data = await r.json();
      if (!r.ok) {
        setError(data?.error === "tooMany" ? tr("tooMany") : tr("lockedBody"));
        return;
      }
      setFresh({ id: data.id, token: data.token });
      await load(workspaceId);
    } finally {
      setBusy(false);
    }
  }

  async function revoke(id: string) {
    if (confirming !== id) {
      setConfirming(id);
      setTimeout(() => setConfirming((c) => (c === id ? null : c)), 4000);
      return;
    }
    setConfirming(null);
    await fetch(`/api/workspaces/${workspaceId}/mcp-tokens`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tokenId: id }),
    });
    await load(workspaceId);
  }

  function copy(text: string, tag: string) {
    navigator.clipboard.writeText(text);
    setCopied(tag);
    setTimeout(() => setCopied((c) => (c === tag ? null : c)), 2000);
  }

  const clientLabel = CLIENTS.find((c) => c.key === client)?.label ?? "";

  return (
    <div className="mx-auto max-w-3xl">
      {/* ── الترويسة: العنوان، والمساحة كضابطٍ لا كخطوة ───────────────── */}
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className="mb-1 text-[19px] font-semibold leading-snug text-text-primary">
            {tr("heroTitle")}
          </h2>
          <p className="text-[13px] leading-relaxed text-text-muted">{tr("heroBody")}</p>
        </div>
        <div className="w-[13rem] shrink-0">
          <label className="mb-1 block text-[11.5px] text-text-faint">{tr("workspaceLabel")}</label>
          <Select
            value={workspaceId}
            onChange={setWorkspaceId}
            options={workspaces.map((w) => ({ value: w.id, label: w.name }))}
            locale={locale}
          />
        </div>
      </header>

      {/* ── تبويبُ العميل: يحكم كلّ ما تحته ──────────────────────────── */}
      <div className="mb-5 -mx-1 overflow-x-auto">
        <div className="flex min-w-max gap-1 border-b border-border px-1">
          {CLIENTS.map((c) => {
            const on = client === c.key;
            return (
              <button
                key={c.key}
                onClick={() => setClient(c.key)}
                className={`relative whitespace-nowrap px-3 py-2 text-[12.5px] transition-colors ${
                  on ? "font-medium text-text-primary" : "text-text-muted hover:text-text-primary"
                }`}
              >
                {c.label}
                {/* الخطّ تحت التبويب النشط - يربطه بما يشرحه أسفله */}
                {on && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-accent" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── الإعداد: مفتاحٌ ثمّ إعداد، في كتلةٍ واحدة ─────────────────── */}
      <section className="card pad-md mb-4">
        <h3 className="mb-3 text-[13.5px] font-semibold text-text-primary">
          {clientLabel} — {tr("setupTitle")}
        </h3>

        {/* ١ · المفتاح */}
        <NumberedRow n={1} text={tr("setupStepKey")} done={Boolean(fresh)} />
        <div className="mb-4 ps-8">
          {fresh ? (
            <div>
              <div className="mb-1.5 text-[11.5px] text-gap">{tr("shownOnce")}</div>
              <div className="flex items-center gap-2">
                <code
                  dir="ltr"
                  className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap rounded-lg bg-surface-raised px-3 py-2 font-mono text-[12.5px] text-text-primary"
                >
                  {fresh.token}
                </code>
                <button onClick={() => copy(fresh.token, "key")} className="btn btn-primary shrink-0">
                  {copied === "key" ? tr("copied") : tr("copy")}
                </button>
              </div>
            </div>
          ) : tokens.length === 0 ? (
            // حالةٌ فارغةٌ تقول ما ينقص وتعطي فعلاً واحداً - لا نموذجٌ يسبق
            // الحاجة إليه.
            <div className="rounded-xl border border-border-visible px-3.5 py-3">
              <div className="mb-0.5 text-[12.5px] font-medium text-text-primary">
                {tr("keyEmptyTitle")}
              </div>
              <p className="mb-2.5 text-[11.5px] leading-relaxed text-text-muted">
                {tr("keyEmptyBody")}
              </p>
              <KeyForm
                label={label} setLabel={setLabel}
                expiresInDays={expiresInDays} setExpiresInDays={setExpiresInDays}
                busy={busy} onGenerate={generate} locale={locale} tr={tr}
              />
            </div>
          ) : (
            <KeyForm
              label={label} setLabel={setLabel}
              expiresInDays={expiresInDays} setExpiresInDays={setExpiresInDays}
              busy={busy} onGenerate={generate} locale={locale} tr={tr}
            />
          )}
          {error && <p className="mt-2 text-[12px] text-critical">{error}</p>}
        </div>

        {/* ٢ · الإعداد */}
        <NumberedRow n={2} text={tr("setupStepConfig")} done={connected} last />
        <div className="ps-8">
          <p className="mb-2 text-[11.5px] leading-relaxed text-text-muted">{installNote}</p>
          {client === "desktop" && (
            <div className="mb-2 font-mono text-[11px] leading-relaxed text-text-faint" dir="ltr">
              <div>{tr("installDesktopPathWin")}</div>
              <div>{tr("installDesktopPathMac")}</div>
            </div>
          )}

          {/* زرّ النسخ في شريطٍ فوق الكود لا معلَّقاً عليه: السطر يتمرّر
              أفقياً، وزرٌّ مطلقُ الموضع يقف على آخره - وهو موضع المفتاح. */}
          <div className="overflow-hidden rounded-xl bg-surface-raised">
            <div className="flex items-center justify-end border-b border-border px-2 py-1">
              <button
                onClick={() => copy(snippet, "snippet")}
                className="btn btn-ghost !px-2 !py-1 text-[11.5px]"
              >
                {copied === "snippet" ? <Check size={12} /> : <Copy size={12} />}
                {copied === "snippet" ? tr("copied") : tr("copy")}
              </button>
            </div>
            <pre
              dir="ltr"
              className="code-block overflow-x-auto p-3 text-[12px] leading-relaxed text-text-primary"
            >
              {snippet}
            </pre>
          </div>

          {client === "web" && (
            <p className="mt-2 text-[11.5px] leading-relaxed text-gap">{tr("installWebNote")}</p>
          )}
          {/* الحدّ يُقال في مكانه - لا وعدٌ في التبويب وخيبةٌ عند التركيب */}
          {client === "gpt" && (
            <p className="mt-2 text-[11.5px] leading-relaxed text-critical">{tr("installGptBlocked")}</p>
          )}

          {fresh && (
            <div
              className={`mt-3 flex items-center gap-2 rounded-xl border px-3 py-2 text-[12px] ${
                connected
                  ? "border-verified/40 bg-verified/10 text-verified"
                  : "border-border-visible text-text-muted"
              }`}
            >
              {connected ? <Check size={13} /> : <Loader2 size={13} className="animate-spin" />}
              {connected ? tr("connected") : tr("waiting")}
            </div>
          )}
        </div>
      </section>

      {/* ── الأدوات: ما يستطيع مساعدُك مناداته ───────────────────────── */}
      <section className="card pad-md mb-4">
        <h3 className="mb-1 text-[13.5px] font-semibold text-text-primary">{tr("usageTitle")}</h3>
        <p className="mb-2.5 text-[11.5px] leading-relaxed text-text-muted">{tr("usageBody")}</p>
        <div className="mb-3 flex flex-wrap gap-1.5" dir="ltr">
          {TOOLS.map((n) => (
            <code
              key={n}
              className="rounded-md bg-surface-raised px-2 py-1 font-mono text-[11.5px] text-text-muted"
            >
              {n}
            </code>
          ))}
        </div>
        {/* مثالٌ واحد يشرح ما لا تشرحه قائمةُ أسماء: شكلُ السؤال وشكلُ الجواب */}
        <div className="rounded-xl border border-border-visible p-3">
          <div className="mb-1.5 flex items-start gap-2">
            <p className="min-w-0 flex-1 text-[12.5px] text-text-primary">{tr("exampleQ")}</p>
            <button
              onClick={() => copy(tr("exampleQ"), "q")}
              className="btn btn-ghost shrink-0 !px-2 !py-1 text-[11.5px]"
            >
              {copied === "q" ? tr("copied") : tr("copy")}
            </button>
          </div>
          <div className="mb-1.5 flex items-center gap-2 text-[11px] text-text-faint">
            <code className="rounded-md bg-accent-dim px-1.5 py-0.5 font-mono text-accent">
              compare_periods
            </code>
            {tr("exampleCall")}
          </div>
          <p className="text-[12px] leading-relaxed text-text-muted">{tr("exampleA")}</p>
          <p className="mt-1.5 text-[11px] text-text-faint">{tr("exampleNote")}</p>
        </div>
      </section>

      {/* ── الحدود: ما يصل إليه وما لا يصل، في سطرين ─────────────────── */}
      <section className="card pad-md mb-4">
        <h3 className="mb-2.5 text-[13.5px] font-semibold text-text-primary">{tr("accessTitle")}</h3>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="flex items-center gap-1 rounded-full border border-verified/40 bg-verified/10 px-2.5 py-1 text-[11.5px] font-medium text-verified">
            <ShieldCheck size={11} />
            {tr("scopeReadOnly")}
          </span>
          {["scopeCampaigns", "scopeAds", "scopeStores", "scopeOrders", "scopeDecisions"].map((k) => (
            <span
              key={k}
              className="rounded-full border border-border-visible px-2.5 py-1 text-[11.5px] text-text-muted"
            >
              {tr(k)}
            </span>
          ))}
        </div>
        {/* ما **لا** يصل إليه يقف مع ما يصل: عليهما معاً يُبنى قرارُ الربط */}
        <div className="mt-2 flex flex-wrap items-center gap-1.5 border-t border-border pt-2">
          {["scopeNoWrite", "scopeNoPii", "scopeOneWs"].map((k) => (
            <span
              key={k}
              className="flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-[11.5px] text-text-faint"
            >
              <X size={10} />
              {tr(k)}
            </span>
          ))}
        </div>
      </section>

      {/* ── المفاتيح ─────────────────────────────────────────────────── */}
      <section className="card pad-md">
        <h3 className="mb-2.5 text-[13.5px] font-semibold text-text-primary">{tr("keysTitle")}</h3>
        {tokens.length === 0 ? (
          <p className="text-[12px] text-text-muted">{tr("noKeys")}</p>
        ) : (
          <div className="divide-y divide-border">
            {tokens.map((k) => (
              <div key={k.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <div className="truncate text-[12.5px] text-text-primary">{k.label}</div>
                  <div className="text-[11px] text-text-faint">
                    <span dir="ltr" className="font-mono">····{k.lastFour}</span>
                    {" · "}
                    {k.lastUsedAt
                      ? `${tr("keyLastUsed")}: ${new Date(k.lastUsedAt).toLocaleDateString(locale === "ar" ? "ar-EG-u-nu-latn" : "en-US")}`
                      : tr("keyNever")}
                    {k.expiresAt &&
                      ` · ${tr("keyExpires")}: ${new Date(k.expiresAt).toLocaleDateString(locale === "ar" ? "ar-EG-u-nu-latn" : "en-US")}`}
                  </div>
                </div>
                <button
                  onClick={() => revoke(k.id)}
                  className={`btn shrink-0 !px-2.5 !py-1 text-[11.5px] ${
                    confirming === k.id ? "btn-primary" : "btn-ghost"
                  }`}
                >
                  <Trash2 size={12} />
                  {confirming === k.id ? tr("revokeConfirm") : tr("revoke")}
                </button>
              </div>
            ))}
          </div>
        )}
        <p className="mt-3 border-t border-border pt-2.5 text-[11px] leading-relaxed text-text-faint">
          {tr("keysLeakNote")} {tr("idleNote")}
        </p>
        {/* «يعمل مع» سطرٌ هنا لا بطاقةٌ مستقلّة: خبرٌ يُطمئن، لا قسمٌ يُدرَس */}
        <p className="mt-2 text-[11px] leading-relaxed text-text-faint">
          <span className="text-text-muted">{tr("clientsTitle")}: </span>
          {[...CLIENTS.map((c) => c.label), ...ALSO_WORKS].join(" · ")} — {tr("clientsAny")}
        </p>
      </section>
    </div>
  );
}

/** سطرُ خطوةٍ مرقَّم: رقمٌ صغير وعنوان، بلا خيطٍ يَعِد بتسلسلٍ إجباريّ. */
function NumberedRow({
  n, text, done, last,
}: {
  n: number;
  text: string;
  done: boolean;
  last?: boolean;
}) {
  return (
    <div className={`flex items-center gap-2.5 ${last ? "mb-2" : "mb-2"}`}>
      <span
        className={`flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold ${
          done
            ? "border-verified/40 bg-verified/12 text-verified"
            : "border-border-visible bg-surface text-text-muted"
        }`}
      >
        {done ? <Check size={11} /> : n}
      </span>
      <span className="text-[12.5px] font-medium text-text-primary">{text}</span>
    </div>
  );
}

/** نموذجُ توليد المفتاح - مستخرَجٌ كي لا يتكرّر في حالتَي الفراغ والامتلاء. */
function KeyForm({
  label, setLabel, expiresInDays, setExpiresInDays, busy, onGenerate, locale, tr,
}: {
  label: string;
  setLabel: (v: string) => void;
  expiresInDays: string;
  setExpiresInDays: (v: string) => void;
  busy: boolean;
  onGenerate: () => void;
  locale: Locale;
  tr: (k: string) => string;
}) {
  return (
    <div className="flex flex-wrap items-end gap-2">
      <input
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        placeholder={tr("labelPlaceholder")}
        className="field min-w-[10rem] flex-1"
      />
      <div className="w-[9rem]">
        <Select
          value={expiresInDays}
          onChange={setExpiresInDays}
          locale={locale}
          options={[
            { value: "0", label: tr("expiryNever") },
            { value: "30", label: tr("expiry30") },
            { value: "90", label: tr("expiry90") },
            { value: "365", label: tr("expiry365") },
          ]}
        />
      </div>
      <button onClick={onGenerate} disabled={busy} className="btn btn-primary shrink-0">
        {busy ? <Loader2 size={14} className="animate-spin" /> : <KeyRound size={14} />}
        {busy ? tr("generating") : tr("generate")}
      </button>
    </div>
  );
}
