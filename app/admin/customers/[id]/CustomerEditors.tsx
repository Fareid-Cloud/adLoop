"use client";

// app/admin/customers/[id]/CustomerEditors.tsx
//
// النماذج التفاعلية في صفحة العميل: الحدود والميزات والسعر، التمديد
// والهدية، الرسالة، والملاحظات.
//
// كلها بتبعت لمسارات محميّة بـ`guardAdmin`، وبتستخدم نفس نمط الرفعة
// (step-up) اللي في `AdminAction` - لكن بنموذج بدل زرّ، لأنّ اللي بيتبعت
// هنا بيانات مش مجرّد أمر. الرفعة بتتعالج بنفس الطريقة: الخادم بيرد
// `elevation_required`، فبيظهر حقل تحقّق ويعيد الإرسال بعد النجاح.

import { useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Lock, Save, Gift, CalendarPlus, Mail, StickyNote } from "lucide-react";
import { getCsrfHeader } from "@/lib/csrfClient";

// ==================== المشترك ====================

function useAdminSubmit(url: string) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [reauth, setReauth] = useState<string | null>(null);
  const [pendingBody, setPendingBody] = useState<Record<string, unknown> | null>(null);

  async function post(body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    setDone(false);
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getCsrfHeader() },
      body: JSON.stringify(body),
    }).catch(() => null);

    if (!res) {
      setBusy(false);
      setError("Network error");
      return;
    }
    if (res.ok) {
      setBusy(false);
      setDone(true);
      setPendingBody(null);
      router.refresh();
      return;
    }
    const data = await res.json().catch(() => ({}) as { error?: string });
    setBusy(false);
    if (res.status === 403 && data?.error === "elevation_required") {
      // نحتفظ بالجسم عشان نعيد إرساله بعد التحقّق - إعادة كتابة النموذج
      // من الأول عقوبة على المالك مالهاش داعي أمنيّ.
      setPendingBody(body);
      setReauth("");
      return;
    }
    setError(data?.error ?? `Failed (${res.status})`);
  }

  async function verify() {
    if (reauth === null) return;
    setBusy(true);
    const looksLikePassword = reauth.length > 6 && !/^\d+$/.test(reauth);
    const res = await fetch("/api/admin/reauth", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getCsrfHeader() },
      body: JSON.stringify(looksLikePassword ? { password: reauth } : { code: reauth }),
    });
    if (!res.ok) {
      setBusy(false);
      setError("Verification failed");
      return;
    }
    setReauth(null);
    if (pendingBody) await post(pendingBody);
    else setBusy(false);
  }

  const reauthNode =
    reauth !== null ? (
      <div className="mt-2 flex flex-wrap items-center gap-1.5 rounded-lg border border-critical/30 bg-critical/8 p-2">
        <Lock size={13} className="shrink-0 text-critical" />
        <span className="text-[11.5px] text-text-muted">Confirm it&apos;s you to continue:</span>
        <input
          type="password"
          autoFocus
          value={reauth}
          onChange={(e) => setReauth(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && verify()}
          placeholder="Password or MFA code"
          className="field field-sm h-7 w-40"
        />
        <button type="button" onClick={verify} disabled={busy || !reauth} className="btn btn-primary btn-sm h-7 px-2 text-xs">
          Verify
        </button>
        <button type="button" onClick={() => { setReauth(null); setPendingBody(null); }} className="text-xs text-text-faint">
          Cancel
        </button>
      </div>
    ) : null;

  const statusNode = (
    <>
      {error && <p className="mt-1.5 text-[11.5px] text-critical">{error}</p>}
      {done && <p className="mt-1.5 text-[11.5px] text-verified">Saved.</p>}
    </>
  );

  return { post, busy, reauthNode, statusNode };
}

function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] uppercase tracking-wide text-text-faint">{label}</span>
      {children}
      {hint && <span className="text-[10.5px] text-text-faint">{hint}</span>}
    </label>
  );
}

// ==================== الحدود والميزات والسعر ====================

const NUMERIC_LIMITS = [
  { key: "workspaces", label: "Workspaces" },
  { key: "adAccounts", label: "Ad accounts / platform" },
  { key: "monthlySpendUsd", label: "Managed spend (USD/mo)" },
  { key: "verifiedConversions", label: "Verified conversions" },
  { key: "historyMonths", label: "History (months)" },
  { key: "automationRules", label: "Automation rules" },
  { key: "stores", label: "Stores" },
  { key: "aiCredits", label: "AI credits" },
  { key: "deepScans", label: "Deep scans" },
  { key: "savedViews", label: "Saved views" },
] as const;

export function OverrideEditor({
  userId,
  limits,
  features,
  customPrice,
}: {
  userId: string;
  limits: Record<string, number> | null;
  features: Record<string, unknown> | null;
  customPrice: { amount: number; currency: string } | null;
}) {
  const { post, busy, reauthNode, statusNode } = useAdminSubmit(`/api/admin/customers/${userId}/override`);
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(NUMERIC_LIMITS.map((l) => [l.key, limits?.[l.key] !== undefined ? String(limits[l.key]) : ""]))
  );
  const [feat, setFeat] = useState({
    scheduledReports: (features?.scheduledReports as boolean | undefined) ?? null,
    mcp: (features?.mcp as boolean | undefined) ?? null,
    scaleKill: (features?.scaleKill as string | undefined) ?? "",
    conversionSync: (features?.conversionSync as string | undefined) ?? "",
  });
  const [price, setPrice] = useState(customPrice ? String(customPrice.amount) : "");
  const [currency, setCurrency] = useState(customPrice?.currency ?? "EGP");
  const [note, setNote] = useState("");

  function submit(e: FormEvent) {
    e.preventDefault();
    const numeric: Record<string, number> = {};
    for (const l of NUMERIC_LIMITS) {
      const raw = values[l.key];
      if (raw !== "" && raw !== undefined) {
        const n = Number(raw);
        if (Number.isInteger(n) && (n >= 0 || n === -1)) numeric[l.key] = n;
      }
    }
    const featureBody: Record<string, unknown> = {};
    if (feat.scheduledReports !== null) featureBody.scheduledReports = feat.scheduledReports;
    if (feat.mcp !== null) featureBody.mcp = feat.mcp;
    if (feat.scaleKill) featureBody.scaleKill = feat.scaleKill;
    if (feat.conversionSync) featureBody.conversionSync = feat.conversionSync;

    void post({
      limits: Object.keys(numeric).length > 0 ? numeric : null,
      features: Object.keys(featureBody).length > 0 ? featureBody : null,
      customPrice: price.trim() === "" ? null : { amount: Number(price), currency },
      note: note || undefined,
    });
  }

  return (
    <form onSubmit={submit}>
      <p className="mb-3 text-[12px] leading-relaxed text-text-faint">
        Blank means &ldquo;follow the plan&rdquo;. <span className="font-mono">-1</span> means unlimited. These apply on top
        of whatever plan the account is on — they are not a plan change.
      </p>

      <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
        {NUMERIC_LIMITS.map((l) => (
          <Field key={l.key} label={l.label}>
            <input
              type="number"
              value={values[l.key] ?? ""}
              onChange={(e) => setValues((v) => ({ ...v, [l.key]: e.target.value }))}
              placeholder="plan default"
              className="field field-sm h-8"
            />
          </Field>
        ))}
      </div>

      <div className="mt-4 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Scheduled reports">
          <select
            value={feat.scheduledReports === null ? "" : String(feat.scheduledReports)}
            onChange={(e) => setFeat((f) => ({ ...f, scheduledReports: e.target.value === "" ? null : e.target.value === "true" }))}
            className="field field-sm h-8"
          >
            <option value="">plan default</option>
            <option value="true">on</option>
            <option value="false">off</option>
          </select>
        </Field>
        <Field label="MCP connection">
          <select
            value={feat.mcp === null ? "" : String(feat.mcp)}
            onChange={(e) => setFeat((f) => ({ ...f, mcp: e.target.value === "" ? null : e.target.value === "true" }))}
            className="field field-sm h-8"
          >
            <option value="">plan default</option>
            <option value="true">on</option>
            <option value="false">off</option>
          </select>
        </Field>
        <Field label="Scale / Kill">
          <select value={feat.scaleKill} onChange={(e) => setFeat((f) => ({ ...f, scaleKill: e.target.value }))} className="field field-sm h-8">
            <option value="">plan default</option>
            <option value="view">view only</option>
            <option value="apply">can apply</option>
          </select>
        </Field>
        <Field label="Conversion sync">
          <select value={feat.conversionSync} onChange={(e) => setFeat((f) => ({ ...f, conversionSync: e.target.value }))} className="field field-sm h-8">
            <option value="">plan default</option>
            <option value="none">none</option>
            <option value="one">one platform</option>
            <option value="all">all platforms</option>
          </select>
        </Field>
      </div>

      <div className="mt-4 grid gap-2.5 sm:grid-cols-3">
        <Field label="Custom renewal price" hint="Monthly. Yearly is derived the same way the catalogue does it.">
          <input
            type="number"
            step="0.01"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="catalogue price"
            className="field field-sm h-8"
          />
        </Field>
        <Field label="Currency" hint="Checkout ignores the custom price if the account bills in another currency.">
          <select value={currency} onChange={(e) => setCurrency(e.target.value)} className="field field-sm h-8">
            <option value="EGP">EGP</option>
            <option value="SAR">SAR</option>
            <option value="USD">USD</option>
          </select>
        </Field>
        <Field label="Reason (audit log)">
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Agency deal, Q3" className="field field-sm h-8" />
        </Field>
      </div>

      <button type="submit" disabled={busy} className="btn btn-primary mt-4 h-8 gap-1.5 px-3 text-[12.5px]">
        <Save size={13} /> {busy ? "Saving…" : "Save overrides"}
      </button>
      {reauthNode}
      {statusNode}
    </form>
  );
}

// ==================== الاشتراك ====================

export function SubscriptionEditor({
  userId,
  plans,
  currentPlan,
}: {
  userId: string;
  plans: string[];
  currentPlan: string | null;
}) {
  const { post, busy, reauthNode, statusNode } = useAdminSubmit(`/api/admin/customers/${userId}/subscription`);
  const [mode, setMode] = useState<"extend" | "gift">(currentPlan ? "extend" : "gift");
  const [days, setDays] = useState("30");
  const [planKey, setPlanKey] = useState(plans[0] ?? "");
  const [reason, setReason] = useState("");

  function submit(e: FormEvent) {
    e.preventDefault();
    void post({
      action: mode,
      days: Number(days),
      ...(mode === "gift" ? { planKey } : {}),
      reason,
    });
  }

  return (
    <form onSubmit={submit}>
      <p className="mb-3 text-[12px] leading-relaxed text-text-faint">
        Extend adds days to the current period. Gift grants a plan outright with no payment — it is recorded as a gift,
        not as revenue, so it never inflates growth figures.
      </p>
      <div className="flex flex-wrap items-end gap-2.5">
        <Field label="Action">
          <select value={mode} onChange={(e) => setMode(e.target.value as "extend" | "gift")} className="field field-sm h-8">
            <option value="extend" disabled={!currentPlan}>Extend current plan</option>
            <option value="gift">Gift a plan</option>
          </select>
        </Field>
        {mode === "gift" && (
          <Field label="Plan">
            <select value={planKey} onChange={(e) => setPlanKey(e.target.value)} className="field field-sm h-8">
              {plans.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </Field>
        )}
        <Field label="Days">
          <input type="number" min={1} max={730} value={days} onChange={(e) => setDays(e.target.value)} className="field field-sm h-8 w-24" />
        </Field>
        <Field label="Reason (required)">
          <input value={reason} onChange={(e) => setReason(e.target.value)} required minLength={3} placeholder="Goodwill after outage" className="field field-sm h-8 w-64" />
        </Field>
        <button type="submit" disabled={busy || reason.trim().length < 3} className="btn btn-primary h-8 gap-1.5 px-3 text-[12.5px]">
          {mode === "gift" ? <Gift size={13} /> : <CalendarPlus size={13} />}
          {busy ? "Working…" : mode === "gift" ? "Gift plan" : "Extend"}
        </button>
      </div>
      {reauthNode}
      {statusNode}
    </form>
  );
}

// ==================== الرسالة ====================

export function EmailComposer({ userId, email }: { userId: string; email: string }) {
  const { post, busy, reauthNode, statusNode } = useAdminSubmit(`/api/admin/customers/${userId}/email`);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  function submit(e: FormEvent) {
    e.preventDefault();
    void post({ subject, body });
  }

  return (
    <form onSubmit={submit}>
      <p className="mb-3 text-[12px] text-text-faint">
        Sent to <span className="font-medium text-text-muted">{email}</span> in their own language, using the product&apos;s
        email template. Marketing opt-out does not block this — it is a direct reply, not a campaign.
      </p>
      <div className="flex flex-col gap-2.5">
        <Field label="Subject">
          <input value={subject} onChange={(e) => setSubject(e.target.value)} required minLength={3} maxLength={150} className="field field-sm h-8" />
        </Field>
        <Field label="Message" hint="A blank line starts a new paragraph.">
          <textarea value={body} onChange={(e) => setBody(e.target.value)} required minLength={10} maxLength={5000} rows={7} className="field px-2 py-1.5 text-[12.5px]" />
        </Field>
      </div>
      <button type="submit" disabled={busy || subject.length < 3 || body.length < 10} className="btn btn-primary mt-3 h-8 gap-1.5 px-3 text-[12.5px]">
        <Mail size={13} /> {busy ? "Sending…" : "Send email"}
      </button>
      {reauthNode}
      {statusNode}
    </form>
  );
}

// ==================== الملاحظات والوسوم ====================

export function NotesEditor({ userId, notes, tags }: { userId: string; notes: string | null; tags: string[] }) {
  const { post, busy, reauthNode, statusNode } = useAdminSubmit(`/api/admin/customers/${userId}/notes`);
  const [value, setValue] = useState(notes ?? "");
  const [tagText, setTagText] = useState(tags.join(", "));

  function submit(e: FormEvent) {
    e.preventDefault();
    void post({
      notes: value,
      tags: tagText.split(",").map((t) => t.trim()).filter(Boolean).slice(0, 8),
    });
  }

  return (
    <form onSubmit={submit}>
      <div className="flex flex-col gap-2.5">
        <Field label="Internal note" hint="Never shown to the customer.">
          <textarea value={value} onChange={(e) => setValue(e.target.value)} rows={4} maxLength={5000} className="field px-2 py-1.5 text-[12.5px]" />
        </Field>
        <Field label="Tags" hint="Comma separated, up to 8.">
          <input value={tagText} onChange={(e) => setTagText(e.target.value)} className="field field-sm h-8" />
        </Field>
      </div>
      <button type="submit" disabled={busy} className="btn btn-primary mt-3 h-8 gap-1.5 px-3 text-[12.5px]">
        <StickyNote size={13} /> {busy ? "Saving…" : "Save note"}
      </button>
      {reauthNode}
      {statusNode}
    </form>
  );
}
