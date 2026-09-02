"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, UserPlus, Lock } from "lucide-react";
import { getCsrfHeader } from "@/lib/csrfClient";

/**
 * منح صلاحية إدارية لزميل، بالبريد.
 *
 * **بيمرّ على نفس نافذة "أكّد هويتك" زي أي فعل خطير** - لكن `AdminAction`
 * المشترك مبنيّ لزرّ بفعل واحد بلا مدخلات، ودي فيها حقلان. فالتعامل مع
 * `elevation_required` متكرّر هنا بدل ما نلوي المكوّن المشترك على حالة
 * مش شبهه: نسخةٌ صغيرة أصدق من تجريدٍ بيخدم حالتين مختلفتين نصّ خدمة.
 */
export function GrantAccessForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"SUPPORT" | "OWNER">("SUPPORT");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  // حالة الرفعة: لمّا الخادم يطلب إثباتاً طازجاً، بنسأل هنا ونعيد المحاولة.
  const [needsAuth, setNeedsAuth] = useState(false);
  const [authValue, setAuthValue] = useState("");

  async function grant(): Promise<void> {
    const res = await fetch("/api/admin/staff", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getCsrfHeader() },
      body: JSON.stringify({ email: email.trim(), role }),
    });
    const data = await res.json().catch(() => ({}));

    if (res.status === 403 && data?.error === "elevation_required") {
      setNeedsAuth(true);
      setBusy(false);
      return;
    }
    if (!res.ok) {
      setError(data?.error ?? "Could not grant access.");
      setBusy(false);
      return;
    }

    setDone(`${data.email} now has the ${data.role} role.`);
    setEmail("");
    setBusy(false);
    router.refresh();
  }

  async function submit() {
    if (!email.trim() || busy) return;
    setBusy(true);
    setError(null);
    setDone(null);
    await grant();
  }

  async function verifyThenGrant() {
    if (!authValue || busy) return;
    setBusy(true);
    setError(null);
    // نفس تخمين بقيّة اللوحة: كلمة السر أطول من ستّة وفيها حروف، والكود أرقام.
    const looksLikePassword = authValue.length > 6 && !/^\d+$/.test(authValue);
    const res = await fetch("/api/admin/reauth", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getCsrfHeader() },
      body: JSON.stringify(looksLikePassword ? { password: authValue } : { code: authValue }),
    });
    if (!res.ok) {
      setBusy(false);
      setAuthValue("");
      setError("That didn't match. Try your password, or a code from your authenticator.");
      return;
    }
    setNeedsAuth(false);
    setAuthValue("");
    await grant();
  }

  return (
    <div className="card pad-lg mb-4">
      <div className="mb-2.5 flex items-center gap-2">
        <UserPlus size={15} className="text-critical" />
        <h2 className="m-0 text-[13.5px] font-semibold text-text-primary">Give someone panel access</h2>
      </div>

      {needsAuth ? (
        <div>
          <p className="mb-2 text-[12.5px] text-text-muted">
            Granting admin access is the most powerful action here. Confirm it&apos;s you.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Lock size={14} className="shrink-0 text-critical" />
            <input
              type="password"
              autoFocus
              value={authValue}
              onChange={(e) => setAuthValue(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && verifyThenGrant()}
              placeholder="Password or MFA code"
              className="field field-sm h-8 w-48"
            />
            <button onClick={verifyThenGrant} disabled={busy || !authValue} className="btn btn-primary btn-sm h-8 px-3">
              {busy ? <Loader2 size={13} className="animate-spin" /> : "Confirm"}
            </button>
            <button
              onClick={() => { setNeedsAuth(false); setAuthValue(""); setBusy(false); }}
              className="text-xs text-text-faint hover:text-text-primary"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-0 flex-1">
            <label htmlFor="staff-email" className="mb-1 block text-[11.5px] text-text-muted">
              Their account email
            </label>
            <input
              id="staff-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              placeholder="teammate@example.com"
              className="field field-sm h-8 w-full"
            />
          </div>
          <div>
            <label htmlFor="staff-role" className="mb-1 block text-[11.5px] text-text-muted">Role</label>
            <select
              id="staff-role"
              value={role}
              onChange={(e) => setRole(e.target.value as "SUPPORT" | "OWNER")}
              className="field field-sm h-8"
            >
              <option value="SUPPORT">Support</option>
              <option value="OWNER">Owner</option>
            </select>
          </div>
          <button onClick={submit} disabled={busy || !email.trim()} className="btn btn-primary btn-sm h-8 px-3">
            {busy ? <Loader2 size={13} className="animate-spin" /> : "Grant access"}
          </button>
        </div>
      )}

      {error && <p role="alert" className="mt-2 text-[12px] text-critical">{error}</p>}
      {/* `text-verified` لا `text-ok`: اسم الرمز في النظام `verified`،
          و`text-ok` كلاس مش موجود فبيتجاهله تايلوند بصمت - رسالة نجاح
          بلا لون تبان زي أي سطر رمادي. */}
      {done && <p className="mt-2 text-[12px] text-verified">{done}</p>}

      <p className="mt-2.5 border-t border-border pt-2.5 text-[11.5px] leading-relaxed text-text-faint">
        The account has to exist and have two-factor authentication on — they sign up and set their own password and
        2FA, we only grant the role. Their open sessions are signed out immediately so the new role takes effect now.
      </p>
    </div>
  );
}
