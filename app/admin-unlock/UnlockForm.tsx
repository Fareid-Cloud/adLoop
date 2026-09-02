"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Lock } from "lucide-react";
import { getCsrfHeader } from "@/lib/csrfClient";

/**
 * نموذج فتح القفل - كلمة سر الحساب أو كود التحقّق بخطوتين.
 *
 * **ليه كلمة سر الحساب لا كلمة سر ثانية للوحة:** السرّ الثاني بيتنسى،
 * ومابيتغيّرش مع مسار تغيير كلمة السر العادي، ومابيضيفش أماناً حقيقياً -
 * اللي معاه الجلسة وكلمة السر معاه الاتنين أصلاً. الحماية الحقيقية في
 * **الطزاجة** (تثبت دلوقتي) و**التحقّق بخطوتين** المفروض على اللوحة
 * أصلاً، وهما الاتنين مبنيين. سرّ ثالث كان هيبقى منظر أمان لا أمان.
 */
export function UnlockForm({
  next,
  minutes,
  email,
}: {
  next: string;
  minutes: number;
  email: string;
}) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!value || busy) return;
    setBusy(true);
    setError(null);

    // نفس تخمين `AdminAction`: كلمة السر أطول من ستّة وفيها حروف، والكود
    // أرقام. التخمين راحة لا أمان - الخادم بيقبل الاتنين ويرفض الغلط.
    const looksLikePassword = value.length > 6 && !/^\d+$/.test(value);
    const res = await fetch("/api/admin/reauth", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getCsrfHeader() },
      body: JSON.stringify(looksLikePassword ? { password: value } : { code: value }),
    });

    if (!res.ok) {
      setBusy(false);
      setValue("");
      // الرسالة واحدة للحالتين عن قصد: التفرقة بين "كلمة السر غلط" و"الكود
      // غلط" بتقول للمهاجم أيّ الاتنين قرّب - وهو مايستاهلش المعلومة دي.
      // و429 وحدها بتتميّز لأنّها إرشاد حقيقي لصاحب الحساب.
      setError(
        res.status === 429
          ? "Too many attempts. Wait a few minutes and try again."
          : "That didn't match. Try your password, or a code from your authenticator."
      );
      return;
    }

    // `refresh()` قبل `replace()` مقصود: اللايوت مكوّن خادم بيقرا الكوكي،
    // وبلا تحديث الذاكرة المؤقّتة بيرجع نسخته القديمة (اللي بتحوّل لهنا)
    // فتحصل ذبذبة بين الصفحتين رغم أنّ القفل اتفتح فعلاً.
    router.refresh();
    router.replace(next);
  }

  return (
    <div className="card pad-lg">
      <label htmlFor="unlock" className="mb-1.5 block text-[12.5px] font-medium text-text-primary">
        Password or authenticator code
      </label>
      <div className="flex items-center gap-2">
        <input
          id="unlock"
          type="password"
          autoFocus
          autoComplete="current-password"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          disabled={busy}
          className="field h-9 flex-1"
        />
        <button
          onClick={submit}
          disabled={busy || !value}
          className="btn btn-primary h-9 shrink-0 px-3.5"
        >
          {busy ? <Loader2 size={15} className="animate-spin" /> : <Lock size={15} />}
          <span className="ms-1.5 text-[13px]">Unlock</span>
        </button>
      </div>

      {error && (
        <p role="alert" className="mt-2 text-[12px] text-critical">
          {error}
        </p>
      )}

      <p className="mt-3 border-t border-border pt-3 text-[11.5px] leading-relaxed text-text-faint">
        Signed in as <span className="text-text-muted">{email}</span>. The console stays open for{" "}
        {minutes} minutes; actions that change money or access ask again at the moment you run them.
      </p>
    </div>
  );
}
