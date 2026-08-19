"use client";

// app/admin/components/AdminAction.tsx
//
// **نقطة تنفيذ واحدة لكل زرّ بيغيّر حاجة في لوحة المالك.**
//
// كل فعل هنا بيعدّي بنفس التسلسل: تأكيد بدوستين (بلا `confirm()` من
// المتصفّح - نفس نمط `ActionsClient` في لوحة العميل)، ثم النداء، وإن
// ردّ الخادم `elevation_required` بيفتح نموذج تحقّق طازج صغير مكانه
// **وبيعيد نفس الفعل تلقائياً بعد النجاح** - عشان المالك مايضيعش خطوته.
//
// النسخة السابقة كانت بتستخدم `confirm()`، وهو نافذة متصفّح بتوقف الصفحة
// كلها وماينفعش تتنسّق مع شكل اللوحة - والأهمّ إنّها نفس النافذة لكل فعل
// مهما اختلفت خطورته، فبتتقري بسرعة وبتتدَوَّس بلا قراءة.

import { useRef, useState, type ComponentType, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Lock } from "lucide-react";
import { getCsrfHeader } from "@/lib/csrfClient";

/** نافذة التأكيد - أطول منها بتخلّي الزرّ يفضل "مسلَّح" بعد ما المالك نسي */
const CONFIRM_WINDOW_MS = 4_000;

export interface AdminActionProps {
  url: string;
  body?: Record<string, unknown>;
  method?: "POST";
  label: string;
  /** النصّ اللي بيظهر على الدوسة الأولى - بيقول إيه اللي هيحصل بالظبط */
  confirmLabel?: string;
  icon?: ComponentType<{ size?: number; className?: string }>;
  tone?: "default" | "danger" | "primary";
  disabled?: boolean;
  /** فعل بلا رجعة أو بيمسّ فلوس - بيتوقّع `elevation_required` */
  needsElevation?: boolean;
  /** بعد النجاح: تحديث الصفحة (افتراضي) أو تحويل لمسار */
  onDoneRedirect?: string;
  size?: "sm" | "md";
  children?: ReactNode;
}

export function AdminAction(props: AdminActionProps) {
  const router = useRouter();
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [needsReauth, setNeedsReauth] = useState(false);
  const [reauthValue, setReauthValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const Icon = props.icon;
  const confirmLabel = props.confirmLabel ?? "Confirm?";

  async function run(): Promise<Response> {
    return fetch(props.url, {
      method: props.method ?? "POST",
      headers: { "Content-Type": "application/json", ...getCsrfHeader() },
      body: JSON.stringify(props.body ?? {}),
    });
  }

  async function execute() {
    setBusy(true);
    setError(null);
    let res: Response;
    try {
      res = await run();
    } catch {
      setBusy(false);
      setError("Network error");
      return;
    }

    if (res.ok) {
      setBusy(false);
      if (props.onDoneRedirect) window.location.href = props.onDoneRedirect;
      else router.refresh();
      return;
    }

    const data = await res.json().catch(() => ({}) as { error?: string });
    setBusy(false);
    if (res.status === 403 && data?.error === "elevation_required") {
      setNeedsReauth(true);
      return;
    }
    setError(data?.error ?? `Failed (${res.status})`);
  }

  function handleClick() {
    if (armed) {
      if (timer.current) clearTimeout(timer.current);
      setArmed(false);
      void execute();
      return;
    }
    if (timer.current) clearTimeout(timer.current);
    setArmed(true);
    timer.current = setTimeout(() => setArmed(false), CONFIRM_WINDOW_MS);
  }

  async function submitReauth() {
    setBusy(true);
    setError(null);
    // كلمة السر أطول من ستّة وفيها حروف؛ الكود أرقام. التخمين هنا مجرّد
    // راحة - الخادم بيقبل الاتنين وبيرفض الغلط، فالتخمين الخاطئ بيفشل
    // بأمان مش بيمرّر حاجة.
    const looksLikePassword = reauthValue.length > 6 && !/^\d+$/.test(reauthValue);
    const res = await fetch("/api/admin/reauth", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getCsrfHeader() },
      body: JSON.stringify(looksLikePassword ? { password: reauthValue } : { code: reauthValue }),
    });
    if (!res.ok) {
      setBusy(false);
      setError("Verification failed — check your password or code");
      return;
    }
    setNeedsReauth(false);
    setReauthValue("");
    await execute();
  }

  if (needsReauth) {
    return (
      <div className="flex flex-wrap items-center gap-1.5">
        <Lock size={13} className="shrink-0 text-critical" />
        <input
          type="password"
          autoFocus
          value={reauthValue}
          onChange={(e) => setReauthValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submitReauth()}
          placeholder="Password or MFA code"
          className="field h-7 w-40 px-2 text-xs"
        />
        <button
          onClick={submitReauth}
          disabled={busy || !reauthValue}
          className="btn btn-primary btn-sm h-7 px-2 text-xs"
        >
          Verify
        </button>
        <button
          onClick={() => { setNeedsReauth(false); setReauthValue(""); setError(null); }}
          className="text-xs text-text-faint hover:text-text-primary"
        >
          Cancel
        </button>
        {error && <span className="w-full text-[11px] text-critical">{error}</span>}
      </div>
    );
  }

  const toneCls =
    props.tone === "danger"
      ? armed
        ? "bg-critical text-white"
        : "border border-critical/40 text-critical hover:bg-critical/10"
      : props.tone === "primary"
        ? armed
          ? "bg-accent text-white"
          : "border border-accent/40 text-accent hover:bg-accent/10"
        : armed
          ? "bg-text-primary text-bg"
          : "border border-border text-text-muted hover:text-text-primary";

  const sizeCls = props.size === "sm" ? "h-7 px-2 text-[11.5px]" : "h-8 px-3 text-[12.5px]";

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={busy || props.disabled}
        className={`inline-flex items-center gap-1.5 rounded-lg font-medium transition-colors disabled:opacity-50 ${toneCls} ${sizeCls}`}
      >
        {Icon && !armed && <Icon size={13} />}
        {busy ? "Working…" : armed ? confirmLabel : props.label}
      </button>
      {error && <span className="text-[11px] text-critical">{error}</span>}
      {props.children}
    </span>
  );
}
