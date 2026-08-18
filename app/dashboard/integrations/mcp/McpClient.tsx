"use client";

// app/dashboard/integrations/mcp/McpClient.tsx
//
// عمودٌ من ثلاث خطوات، لا نموذج. كلّ خطوةٍ تفتح التالية وتنطوي هي إلى
// سطرٍ بعلامة تمام.
//
// 🔴 **ومؤشّر «اشتغل» هو محور الشاشة.** كلّ تدفّقات «اربط ذكاءك» في السوق
// تنتهي بأن يلصق المستخدم إعداداً ثمّ لا يعرف: أنجح أم لا؟ فالصفحة
// تستطلع `lastUsedAt` بعد التوليد، وأوّلُ نداءٍ يصل من ذكائه يقلب الخطوة
// إلى الأخضر - يقول المنتج «تمّ» قبل أن يسأل.

import { useEffect, useMemo, useState } from "react";
import { Check, Copy, KeyRound, Loader2, ShieldCheck, Trash2 } from "lucide-react";
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

type ClientKey = "claudeCode" | "desktop" | "cursor" | "web";

const CLIENTS: Array<{ key: ClientKey; label: string }> = [
  { key: "claudeCode", label: "Claude Code" },
  { key: "desktop", label: "Claude Desktop" },
  { key: "cursor", label: "Cursor" },
  { key: "web", label: "claude.ai" },
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

  // الاستطلاع يعمل فقط بعد توليد مفتاح، ويتوقّف فور وصول أوّل نداء -
  // نداءٌ كلّ خمس ثوانٍ بلا سببٍ استهلاكٌ بلا فائدة.
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
    if (client === "web") return mcpUrl;
    return JSON.stringify(
      client === "cursor"
        ? { mcpServers: { adloop: { url: mcpUrl, headers: { Authorization: `Bearer ${key}` } } } }
        : { mcpServers: { adloop: { url: mcpUrl, headers: { Authorization: `Bearer ${key}` } } } },
      null,
      2
    );
  }, [client, fresh, mcpUrl]);

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

  const scopes = ["scopeCampaigns", "scopeAds", "scopeStores", "scopeOrders", "scopeDecisions"];

  return (
    <div className="mx-auto max-w-3xl">
      {/* نطاق الوصول رقائقُ لا فقرات - يُقرأ في ثانية ويُقرّر */}
      <div className="card pad-md mb-5">
        <div className="mb-2 text-[12.5px] font-medium text-text-primary">{tr("scopeTitle")}</div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="flex items-center gap-1 rounded-full border border-verified/40 bg-verified/10 px-2.5 py-1 text-[12px] font-medium text-verified">
            <ShieldCheck size={12} />
            {tr("scopeReadOnly")}
          </span>
          {scopes.map((k) => (
            <span
              key={k}
              className="rounded-full border border-border-visible px-2.5 py-1 text-[12px] text-text-muted"
            >
              {tr(k)}
            </span>
          ))}
        </div>
      </div>

      {/* ١ · مساحة العمل */}
      <Step n={1} title={tr("step1")} done={Boolean(fresh)}>
        <Select
          value={workspaceId}
          onChange={setWorkspaceId}
          options={workspaces.map((w) => ({ value: w.id, label: w.name }))}
          locale={locale}
        />
      </Step>

      {/* ٢ · المفتاح */}
      <Step n={2} title={tr("step2")} done={Boolean(fresh)}>
        {fresh ? (
          <div>
            <div className="mb-2 text-[12px] text-gap">{tr("shownOnce")}</div>
            <div className="flex items-center gap-2">
              <code
                dir="ltr"
                className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap rounded-lg bg-surface-raised px-3 py-2.5 font-mono text-[13px] text-text-primary"
              >
                {fresh.token}
              </code>
              <button onClick={() => copy(fresh.token, "key")} className="btn btn-primary shrink-0">
                {copied === "key" ? tr("copied") : tr("copy")}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-end gap-2">
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder={tr("labelPlaceholder")}
              className="field min-w-[12rem] flex-1"
            />
            <div className="w-[10rem]">
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
            <button onClick={generate} disabled={busy} className="btn btn-primary shrink-0">
              {busy ? <Loader2 size={14} className="animate-spin" /> : <KeyRound size={14} />}
              {busy ? tr("generating") : tr("generate")}
            </button>
          </div>
        )}
        {error && <p className="mt-2 text-[12px] text-critical">{error}</p>}
        <p className="mt-2 text-[11px] text-text-faint">{tr("idleNote")}</p>
      </Step>

      {/* ٣ · التركيب */}
      <Step n={3} title={tr("step3")} done={connected} last>
        <div className="mb-3 flex flex-wrap gap-1.5">
          {CLIENTS.map((c) => (
            <button
              key={c.key}
              onClick={() => setClient(c.key)}
              className={`rounded-xl border px-3 py-1.5 text-[12.5px] transition-colors ${
                client === c.key
                  ? "border-accent/40 bg-accent-dim text-accent"
                  : "border-border-visible text-text-muted hover:text-text-primary"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>

        <p className="mb-1.5 text-[12px] text-text-muted">
          {client === "claudeCode"
            ? tr("installClaudeCode")
            : client === "desktop"
              ? tr("installDesktop")
              : client === "cursor"
                ? tr("installCursor")
                : tr("installWeb")}
        </p>
        {client === "desktop" && (
          <div className="mb-2 font-mono text-[11px] leading-relaxed text-text-faint" dir="ltr">
            <div>{tr("installDesktopPathWin")}</div>
            <div>{tr("installDesktopPathMac")}</div>
          </div>
        )}

        <div className="relative">
          <pre
            dir="ltr"
            className="overflow-x-auto rounded-xl bg-surface-raised p-3 pe-16 font-mono text-[12px] leading-relaxed text-text-primary"
          >
            {snippet}
          </pre>
          <button
            onClick={() => copy(snippet, "snippet")}
            className="btn btn-ghost absolute end-2 top-2 !px-2 !py-1 text-[11.5px]"
          >
            {copied === "snippet" ? <Check size={12} /> : <Copy size={12} />}
            {copied === "snippet" ? tr("copied") : tr("copy")}
          </button>
        </div>

        {client === "web" && (
          <p className="mt-2 text-[11.5px] leading-relaxed text-gap">{tr("installWebNote")}</p>
        )}

        <div className="mt-4 rounded-xl border border-border-visible p-3">
          <div className="mb-1 text-[12px] text-text-muted">{tr("thenAsk")}</div>
          <div className="flex items-center gap-2">
            <code className="min-w-0 flex-1 text-[12.5px] text-text-primary">{tr("sampleQuestion")}</code>
            <button
              onClick={() => copy(tr("sampleQuestion"), "q")}
              className="btn btn-ghost shrink-0 !px-2 !py-1 text-[11.5px]"
            >
              {copied === "q" ? tr("copied") : tr("copy")}
            </button>
          </div>
        </div>

        {fresh && (
          <div
            className={`mt-4 flex items-center gap-2 rounded-xl border px-3 py-2.5 text-[12.5px] ${
              connected
                ? "border-verified/40 bg-verified/10 text-verified"
                : "border-border-visible text-text-muted"
            }`}
          >
            {connected ? <Check size={14} /> : <Loader2 size={14} className="animate-spin" />}
            {connected ? tr("connected") : tr("waiting")}
          </div>
        )}
      </Step>

      {/* جدول المفاتيح */}
      <div className="card pad-md mt-6">
        <div className="mb-3 text-[13px] font-medium text-text-primary">{tr("keysTitle")}</div>
        {tokens.length === 0 ? (
          <p className="text-[12px] text-text-muted">{tr("noKeys")}</p>
        ) : (
          <div className="divide-y divide-border">
            {tokens.map((k) => (
              <div key={k.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <div className="truncate text-[13px] text-text-primary">{k.label}</div>
                  <div className="text-[11px] text-text-faint">
                    <span dir="ltr" className="font-mono">
                      ····{k.lastFour}
                    </span>
                    {" · "}
                    {k.lastUsedAt
                      ? `${tr("keyLastUsed")}: ${new Date(k.lastUsedAt).toLocaleDateString(locale === "ar" ? "ar-EG" : "en-US")}`
                      : tr("keyNever")}
                    {k.expiresAt &&
                      ` · ${tr("keyExpires")}: ${new Date(k.expiresAt).toLocaleDateString(locale === "ar" ? "ar-EG" : "en-US")}`}
                  </div>
                </div>
                <button
                  onClick={() => revoke(k.id)}
                  className={`btn shrink-0 !px-2.5 !py-1 text-[12px] ${
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
      </div>
    </div>
  );
}

/** خطوةٌ في العمود: رقمها، وعنوانها، وعلامةُ تمامٍ متى أُنجزت */
function Step({
  n,
  title,
  done,
  last,
  children,
}: {
  n: number;
  title: string;
  done: boolean;
  last?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="relative ps-9 pb-6">
      {/* الخيط الواصل بين الخطوات - يُقرأ تسلسلاً لا بطاقاتٍ منفصلة */}
      {!last && <span className="absolute start-[13px] top-7 bottom-0 w-px bg-border" />}
      <span
        className={`absolute start-0 top-0 flex h-[27px] w-[27px] items-center justify-center rounded-full border text-[12px] font-semibold ${
          done
            ? "border-verified/40 bg-verified/12 text-verified"
            : "border-border-visible bg-surface text-text-muted"
        }`}
      >
        {done ? <Check size={13} /> : n}
      </span>
      <div className="mb-2 pt-1 text-[13px] font-medium text-text-primary">{title}</div>
      {children}
    </div>
  );
}
