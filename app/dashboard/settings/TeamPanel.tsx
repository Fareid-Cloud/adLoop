"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Users, UserPlus, Loader2, Copy, Check, X, Eye, Wrench } from "lucide-react";
import { getCsrfHeader } from "@/lib/csrfClient";
import { t, type Locale } from "@/lib/i18n/dictionary";

/**
 * إدارةُ المقاعد.
 *
 * **«ادعُ» = ابعت رسالة.** الدعوةُ بتخرج بريداً من عندنا بهويّتنا، بتقول
 * مين دعاه ولأيّ مساحة وبأيّ دور قبل ما تطلب منه يدوس حاجة. الرابطُ
 * بيفضل معروضاً كطريقٍ إضافيّ لمَن يفضّل يبعته بنفسه.
 *
 * وكان الرابطُ هو النتيجةَ الوحيدة: فعلٌ اسمُه «ادعُ» بينتهي بتلات خطواتٍ
 * يدوية على صاحب الحساب (انسخ، افتح بريدك، اشرح إيه ده) - ورابطٌ بيوصل
 * عارياً من سياقه بيخلّي اللي بيستلمه يتردّد يدوس عليه، وهو تردّدٌ صحيّ.
 *
 * ومسارُ الفشل مُعلَنٌ لا مبلوع: لو البريد ما خرجش (مفتاح Resend مش
 * مضبوط مثلاً)، الشاشةُ بتقول «احفظ الرابط وابعته بنفسك» بدل ما تدّعي
 * إرسالاً ما حصلش وتخلّي صاحبَ الحساب يستنّى زميلاً مش جايّ.
 */

interface Member {
  userId: string;
  name: string | null;
  email: string;
  role: string;
}

interface Invite {
  id: string;
  email: string;
  role: string;
  expiresAt: string;
}

export function TeamPanel({
  workspaceId,
  members,
  invites,
  seats,
  locale,
}: {
  workspaceId: string;
  members: Member[];
  invites: Invite[];
  seats: { viewer: number; operator: number };
  locale: Locale;
}) {
  const router = useRouter();
  const tr = (k: string) => t(locale, `team.${k}`);

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"VIEWER" | "OPERATOR">("VIEWER");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  // مين اتبعتت له وهل البريد خرج فعلاً: الشاشةُ لازم تفرّق بين «وصلته
  // رسالة» و«احفظ الرابط وابعته بنفسك» - الادّعاءُ بإرسالٍ ما حصلش
  // بيخلّي صاحبَ الحساب يستنّى زميلاً مش جايّ.
  const [sentTo, setSentTo] = useState("");
  const [emailSent, setEmailSent] = useState(false);

  const usedViewer = count(members, invites, "VIEWER");
  const usedOperator = count(members, invites, "OPERATOR");

  async function invite() {
    if (!email.trim() || busy) return;
    setBusy(true);
    setError(null);
    setLink(null);

    const res = await fetch(`/api/workspaces/${workspaceId}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getCsrfHeader() },
      body: JSON.stringify({ email: email.trim(), role }),
    }).catch(() => null);

    setBusy(false);
    const data = await res?.json().catch(() => null);
    if (!res?.ok) {
      setError(data?.error ?? tr("inviteFailed"));
      return;
    }

    setLink(`${window.location.origin}/invite/${data.token}`);
    setSentTo(email.trim());
    setEmailSent(data.emailSent === true);
    setEmail("");
    router.refresh();
  }

  async function change(userId: string, next: "VIEWER" | "OPERATOR" | null) {
    const res = await fetch(`/api/workspaces/${workspaceId}/members`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...getCsrfHeader() },
      body: JSON.stringify({ userId, role: next }),
    }).catch(() => null);
    if (!res?.ok) {
      const d = await res?.json().catch(() => null);
      setError(d?.error ?? tr("changeFailed"));
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="card pad-lg">
        <div className="mb-1 flex items-center gap-2">
          <Users size={16} className="text-accent" />
          <h2 className="m-0 text-[14px] font-semibold text-text-primary">{tr("title")}</h2>
        </div>
        <p className="m-0 mb-3 text-[12.5px] leading-relaxed text-text-muted">{tr("intro")}</p>

        <div className="grid gap-2 sm:grid-cols-2">
          <SeatMeter icon={Eye} label={tr("viewerSeats")} used={usedViewer} cap={seats.viewer} note={tr("viewerNote")} locale={locale} />
          <SeatMeter icon={Wrench} label={tr("operatorSeats")} used={usedOperator} cap={seats.operator} note={tr("operatorNote")} locale={locale} />
        </div>
      </div>

      <div className="card pad-lg">
        <h3 className="m-0 mb-2.5 text-[13px] font-semibold text-text-primary">{tr("inviteTitle")}</h3>
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-0 flex-1">
            <label htmlFor="team-email" className="mb-1 block text-[11.5px] text-text-muted">{tr("email")}</label>
            <input
              id="team-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && invite()}
              placeholder="teammate@example.com"
              className="field field-sm h-8 w-full"
            />
          </div>
          <div>
            <label htmlFor="team-role" className="mb-1 block text-[11.5px] text-text-muted">{tr("role")}</label>
            <select id="team-role" value={role} onChange={(e) => setRole(e.target.value as "VIEWER" | "OPERATOR")} className="field field-sm h-8">
              <option value="VIEWER">{tr("viewer")}</option>
              <option value="OPERATOR">{tr("operator")}</option>
            </select>
          </div>
          <button onClick={invite} disabled={busy || !email.trim()} className="btn btn-primary btn-sm h-8 px-3">
            {busy ? <Loader2 size={13} className="animate-spin" /> : <UserPlus size={13} />}
            <span className="ms-1.5">{tr("invite")}</span>
          </button>
        </div>

        {error && <p role="alert" className="mt-2 text-[12px] text-critical">{error}</p>}

        {/* 🔴 **الرسالةُ هي النتيجة، والرابطُ إضافة.**
            كانت النتيجةُ رابطاً وبس، فالدعوةُ بتقف عند صاحب الحساب:
            ينسخ، ويفتح بريده، ويشرح إيه ده. والسطرُ اللي كان تحته يشرح
            إنّنا نخزّن بصمةَ الرابط لا نصَّه اتشال - ده كلامٌ عن آليّتنا
            الداخلية، والمستخدمُ مش بيقرا الشاشة عشان يعرف إزاي بنشتغل. */}
        {link && (
          <div className="mt-3 rounded-xl border border-verified/30 bg-verified/8 p-2.5">
            <p className="m-0 flex items-center gap-1.5 text-[12px] text-text-primary">
              <Check size={13} className="shrink-0 text-verified" />
              {emailSent ? tr("sentTo").replace("{email}", sentTo) : tr("sentFallback")}
            </p>

            <p className="m-0 mb-1 mt-2 text-[11px] text-text-faint">{tr("orShareLink")}</p>
            <div className="flex items-center gap-1.5">
              <code className="min-w-0 flex-1 overflow-x-auto rounded bg-surface px-2 py-1 text-[11px] text-text-muted">{link}</code>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(link);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
                className="btn-icon btn-sm shrink-0"
                aria-label={tr("copy")}
              >
                {copied ? <Check size={14} className="text-verified" /> : <Copy size={14} />}
              </button>
            </div>
          </div>
        )}
      </div>

      {(members.length > 0 || invites.length > 0) && (
        <div className="card pad-lg">
          <h3 className="m-0 mb-2.5 text-[13px] font-semibold text-text-primary">{tr("membersTitle")}</h3>
          <ul className="m-0 list-none space-y-1.5 p-0">
            {members.map((m) => (
              <li key={m.userId} className="flex flex-wrap items-center gap-2 rounded-xl border border-border p-2.5">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[12.5px] text-text-primary">{m.name ?? m.email.split("@")[0]}</div>
                  <div className="truncate text-[11px] text-text-faint">{m.email}</div>
                </div>
                <select
                  value={m.role}
                  onChange={(e) => change(m.userId, e.target.value as "VIEWER" | "OPERATOR")}
                  className="field field-sm h-7"
                  aria-label={tr("role")}
                >
                  <option value="VIEWER">{tr("viewer")}</option>
                  <option value="OPERATOR">{tr("operator")}</option>
                </select>
                <button onClick={() => change(m.userId, null)} className="btn-icon shrink-0" aria-label={tr("remove")} title={tr("remove")}>
                  <X size={14} />
                </button>
              </li>
            ))}

            {invites.map((i) => (
              <li key={i.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-border p-2.5">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[12.5px] text-text-muted">{i.email}</div>
                  <div className="text-[11px] text-text-faint">
                    {tr("pending")} · {i.role === "OPERATOR" ? tr("operator") : tr("viewer")}
                  </div>
                </div>
                {/* الدعوةُ المعلَّقة بتاخد مقعداً فعلاً - فبتتعرض جنب
                    الأعضاء لا في مكانٍ تاني، عشان العدّ اللي بيتشاف يطابق
                    العدّ اللي بيتحسب. */}
                <span className="shrink-0 rounded bg-surface-raised px-1.5 py-0.5 text-[10.5px] text-text-faint">
                  {tr("seatHeld")}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function SeatMeter({
  icon: Icon, label, used, cap, note, locale,
}: {
  icon: typeof Eye; label: string; used: number; cap: number; note: string; locale: Locale;
}) {
  // `-1` = بلا حدّ. عرضُه كرقمٍ كان بيدّي «١ من -١».
  const unlimited = cap < 0;
  const full = !unlimited && cap > 0 && used >= cap;
  return (
    <div className="rounded-xl border border-border p-2.5">
      <div className="flex items-center gap-1.5">
        <Icon size={13} className="text-text-faint" />
        <span className="text-[12px] text-text-muted">{label}</span>
        <span className={`ms-auto tabular-nums text-[12.5px] ${full ? "text-gap" : "text-text-primary"}`}>
          {unlimited ? `${used} / ∞` : `${used} / ${cap}`}
        </span>
      </div>
      <p className="m-0 mt-1 text-[11px] leading-relaxed text-text-faint">
        {cap === 0 ? t(locale, "team.notOnPlan") : note}
      </p>
    </div>
  );
}

function count(members: Member[], invites: Invite[], role: string) {
  return members.filter((m) => m.role === role).length + invites.filter((i) => i.role === role).length;
}
