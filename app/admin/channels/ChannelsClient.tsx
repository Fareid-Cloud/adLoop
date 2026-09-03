"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Lock, Plug, Power } from "lucide-react";
import { getCsrfHeader } from "@/lib/csrfClient";

/**
 * ربطُ القنوات - النموذج والمفتاح.
 *
 * الاتنين محتاجين نفس تدفّق «أكّد هويتك»، فمتجمّعين في ملفٍّ واحد بدل
 * نسختين من نفس المعالجة.
 */

async function withElevation(
  run: () => Promise<Response | null>,
  onNeedsAuth: () => void
): Promise<{ ok: boolean; error?: string }> {
  const res = await run();
  const data = await res?.json().catch(() => null);
  if (res?.status === 403 && data?.error === "elevation_required") {
    onNeedsAuth();
    return { ok: false };
  }
  if (!res?.ok) return { ok: false, error: data?.error ?? "That did not work." };
  return { ok: true };
}

function ElevationPrompt({
  onDone, onCancel,
}: { onDone: () => void; onCancel: () => void }) {
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function verify() {
    if (!value || busy) return;
    setBusy(true);
    setError(null);
    const looksLikePassword = value.length > 6 && !/^\d+$/.test(value);
    const res = await fetch("/api/admin/reauth", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getCsrfHeader() },
      body: JSON.stringify(looksLikePassword ? { password: value } : { code: value }),
    }).catch(() => null);
    setBusy(false);
    if (!res?.ok) {
      setValue("");
      setError("That didn't match. Try your password, or a code from your authenticator.");
      return;
    }
    onDone();
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Lock size={14} className="shrink-0 text-critical" />
      <input
        type="password"
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && verify()}
        placeholder="Password or MFA code"
        className="field field-sm h-8 w-48"
      />
      <button onClick={verify} disabled={busy || !value} className="btn btn-primary btn-sm h-8 px-3">
        {busy ? <Loader2 size={13} className="animate-spin" /> : "Confirm"}
      </button>
      <button onClick={onCancel} className="text-xs text-text-faint hover:text-text-primary">Cancel</button>
      {error && <p role="alert" className="w-full text-[11.5px] text-critical">{error}</p>}
    </div>
  );
}

/**
 * 🔴 **تصديرٌ مسمّى، لا خاصّيةٌ على كائن.**
 *
 * كان `export const ChannelsClient = { Form, Toggle }` والصفحة تكتب
 * `<ChannelsClient.Toggle />`. وده بيتترجم عبر حدّ `"use client"` لمرجع
 * وحدةٍ لا لكائنٍ حقيقيّ - فالخادم بيقرا `.Toggle` منه فيلاقي `undefined`،
 * ورياكت بترمي «Element type is invalid» **وتُسقط الصفحة كلّها**.
 *
 * و`tsc` مابيشوفهاش: الأنواع سليمة تماماً على الجانبين، والعطب في كيفية
 * عبور الحدّ. مايظهرش غير وقت التشغيل - وصلني كإيميل من Sentry.
 *
 * فكلُّ مكوّنٍ يعبر الحدّ يتصدَّر باسمه مباشرةً.
 */
export function ChannelToggle({ id, active }: { id: string; active: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [needsAuth, setNeedsAuth] = useState(false);

  async function run() {
    setBusy(true);
    const result = await withElevation(
      () =>
        fetch("/api/admin/channels", {
          method: "PATCH",
          headers: { "Content-Type": "application/json", ...getCsrfHeader() },
          body: JSON.stringify({ id, active: !active }),
        }).catch(() => null),
      () => setNeedsAuth(true)
    );
    setBusy(false);
    if (result.ok) router.refresh();
  }

  if (needsAuth) {
    return <ElevationPrompt onDone={() => { setNeedsAuth(false); run(); }} onCancel={() => setNeedsAuth(false)} />;
  }

  return (
    <button onClick={run} disabled={busy} className="btn btn-sm h-8 shrink-0 px-2.5">
      {busy ? <Loader2 size={13} className="animate-spin" /> : <Power size={13} />}
      <span className="ms-1.5">{active ? "Pause" : "Resume"}</span>
    </button>
  );
}

export function ConnectForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsAuth, setNeedsAuth] = useState(false);

  const [channel, setChannel] = useState<"WHATSAPP" | "MESSENGER">("WHATSAPP");
  const [externalId, setExternalId] = useState("");
  const [label, setLabel] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [appSecret, setAppSecret] = useState("");
  const [verifyToken, setVerifyToken] = useState("");

  async function submit() {
    setBusy(true);
    setError(null);
    const result = await withElevation(
      () =>
        fetch("/api/admin/channels", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...getCsrfHeader() },
          body: JSON.stringify({ channel, externalId, label, accessToken, appSecret, verifyToken }),
        }).catch(() => null),
      () => setNeedsAuth(true)
    );
    setBusy(false);
    if (result.error) setError(result.error);
    if (result.ok) {
      // السرّان بيتمسحوا من الذاكرة فور الحفظ: مافيش سبب يفضلوا في حالة
      // المكوّن بعد ما اتخزّنوا مشفَّرين.
      setAccessToken("");
      setAppSecret("");
      setOpen(false);
      router.refresh();
    }
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="btn btn-primary btn-sm h-9 px-3.5">
        <Plug size={14} /><span className="ms-1.5">Connect a channel</span>
      </button>
    );
  }

  return (
    <div className="card pad-lg">
      <h2 className="m-0 mb-3 text-[13.5px] font-semibold text-text-primary">Connect a channel</h2>

      {needsAuth ? (
        <ElevationPrompt onDone={() => { setNeedsAuth(false); submit(); }} onCancel={() => setNeedsAuth(false)} />
      ) : (
        <div className="grid gap-2.5 sm:grid-cols-2">
          <Field label="Channel">
            <select value={channel} onChange={(e) => setChannel(e.target.value as "WHATSAPP" | "MESSENGER")} className="field field-sm h-8 w-full">
              <option value="WHATSAPP">WhatsApp Business</option>
              <option value="MESSENGER">Messenger</option>
            </select>
          </Field>
          <Field label={channel === "WHATSAPP" ? "Phone number ID" : "Page ID"} hint="from Meta, not the phone number itself">
            <input value={externalId} onChange={(e) => setExternalId(e.target.value)} className="field field-sm h-8 w-full" />
          </Field>
          <Field label="Label" hint="what you will recognise it by">
            <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Support line" className="field field-sm h-8 w-full" />
          </Field>
          <Field label="Verify token" hint="you invent this, and paste the same into Meta">
            <input value={verifyToken} onChange={(e) => setVerifyToken(e.target.value)} className="field field-sm h-8 w-full" />
          </Field>
          <Field label="Access token" hint="permanent token from the Meta app">
            <input type="password" value={accessToken} onChange={(e) => setAccessToken(e.target.value)} className="field field-sm h-8 w-full" />
          </Field>
          <Field label="App secret" hint="signs every incoming webhook">
            <input type="password" value={appSecret} onChange={(e) => setAppSecret(e.target.value)} className="field field-sm h-8 w-full" />
          </Field>

          <div className="sm:col-span-2 flex flex-wrap items-center gap-2">
            <button
              onClick={submit}
              disabled={busy || !externalId || !label || !accessToken || !appSecret || !verifyToken}
              className="btn btn-primary btn-sm h-8 px-3"
            >
              {busy ? <Loader2 size={13} className="animate-spin" /> : "Save connection"}
            </button>
            <button onClick={() => setOpen(false)} className="text-xs text-text-faint hover:text-text-primary">Cancel</button>
            {error && <p role="alert" className="w-full text-[11.5px] text-critical">{error}</p>}
          </div>

          <p className="sm:col-span-2 m-0 border-t border-border pt-2.5 text-[11px] leading-relaxed text-text-faint">
            Both secrets are encrypted before they touch the database, and neither is ever sent back to this page —
            not even partially. Re-connecting the same ID with a fresh token updates it, which is what a token
            refresh actually is.
          </p>
        </div>
      )}
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-[11.5px] text-text-muted">
        {label}
        {hint && <span className="ms-1 text-text-faint">— {hint}</span>}
      </label>
      {children}
    </div>
  );
}

