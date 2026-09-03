// app/invite/[token]/page.tsx
//
// صفحةُ قبول الدعوة.
//
// **الرمزُ في المسار لا في `?query`**: روابطُ الاستعلام بتتسرّب في
// ترويسة `Referer` لأيّ طرفٍ خارجيّ تفتحه الصفحة، وده رمزُ وصول.
//
// 🔴 **الصفحةُ كانت مابتقراش الدعوة أصلاً.** كانت بتعرض عنواناً عامّاً
// وبريدَ الزائر وزرّاً مكتوب عليه «ادعُ» - يعني اللي وصله الرابط بيتطلب
// منه يقبل حاجةً **مش عارف إيه هي ولا مين باعتها**، وده بالظبط شكلُ
// رسائل التصيّد. والقبولُ هنا بيدّي حدّاً وصولاً لحسابِ إعلاناتٍ حقيقيّ
// بأرقامه وحملاته، فالسؤال «مين؟ فين؟ بإيه؟» لازم يتجاوب **قبل** الزرار
// لا بعده.

import { redirect } from "next/navigation";
import crypto from "node:crypto";
import { Users, Eye, Wrench, AlertTriangle } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getSessionUserFromCookies } from "@/lib/auth";
import { t, type Locale } from "@/lib/i18n/dictionary";
import { AcceptInvite, SwitchAccount } from "./AcceptInvite";

export const dynamic = "force-dynamic";

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const user = await getSessionUserFromCookies();

  // مش مسجّل: يسجّل ويرجع هنا. مابنعملش حساباً نيابةً عنه - كلمةُ سرٍّ
  // مانعرفهاش أو حسابٌ بلا كلمة سر، والاتنين أسوأ من خطوةٍ زيادة.
  if (!user) redirect(`/login?next=${encodeURIComponent(`/invite/${token}`)}`);

  const locale: Locale = (user.preferredLocale as Locale) ?? "ar";
  const tr = (k: string, vars?: Record<string, string | number>) => t(locale, `invitePage.${k}`, vars);

  // المخزَّن هاشُ الرمز لا نصُّه، فالبحثُ بالهاش.
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const invite = await prisma.workspaceInvite.findUnique({
    where: { tokenHash },
    select: {
      email: true, role: true, expiresAt: true, acceptedAt: true,
      invitedById: true,
      workspace: { select: { name: true } },
    },
  });

  // الداعي بيتجاب على حدة: `invitedById` عمودٌ بلا علاقةٍ معرَّفة في
  // الـschema، فمافيش `include` يجيبه معاه.
  const inviter = invite?.invitedById
    ? await prisma.user.findUnique({
        where: { id: invite.invitedById },
        select: { name: true, email: true },
      })
    : null;

  // رسالةٌ واحدة للحالات التلاتة (مش موجودة / منتهية / مستهلَكة): التفرقة
  // بينها بتقول لحامل رابطٍ مسروق إن كان صالحاً يوماً ما.
  const dead = !invite || invite.acceptedAt || invite.expiresAt < new Date();
  // الدعوةُ لبريدٍ بعينه، والفرقُ بيتقال **هنا** لا بعد الدوسة: اللي
  // داخلٌ بحسابٍ تاني محتاج يعرف قبل ما يحاول، ومحتاج يعرف بأنهي بريدٍ
  // يدخل - غيرُ كده بيدوس ويقرا رفضاً مش فاهمه.
  const wrongAccount = !dead && user.email.trim().toLowerCase() !== invite!.email;

  const roleKey = invite?.role === "OPERATOR" ? "operator" : "viewer";
  const RoleIcon = invite?.role === "OPERATOR" ? Wrench : Eye;

  return (
    <main className="grid min-h-dvh place-items-center bg-surface px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="text-center">
          <span
            className={`mx-auto mb-3 grid size-11 place-items-center rounded-2xl ${
              dead || wrongAccount ? "bg-critical/12 text-critical" : "bg-accent/12 text-accent"
            }`}
          >
            {dead || wrongAccount ? <AlertTriangle size={22} /> : <Users size={22} />}
          </span>

          {dead ? (
            <>
              <h1 className="text-xl font-semibold text-text-primary">{tr("deadTitle")}</h1>
              <p className="mt-1.5 text-[13px] leading-relaxed text-text-muted">{tr("deadBody")}</p>
            </>
          ) : (
            <>
              <h1 className="text-xl font-semibold text-text-primary">
                {tr("title", { workspace: invite!.workspace.name })}
              </h1>
              <p className="mt-1.5 text-[13px] leading-relaxed text-text-muted">
                {tr("subtitle", {
                  inviter: inviter?.name?.trim() || inviter?.email || tr("someone"),
                })}
              </p>
            </>
          )}
        </div>

        {!dead && (
          <>
            {/* ما الذي يحصل عليه بالظبط - قبل الزرار لا بعده. */}
            <div className="mt-4 rounded-2xl border border-border bg-surface-raised p-3">
              <div className="flex items-center gap-2">
                <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-surface text-text-muted">
                  <RoleIcon size={14} />
                </span>
                <div className="min-w-0">
                  <p className="m-0 text-[12.5px] font-medium text-text-primary">
                    {t(locale, `team.${roleKey}`)}
                  </p>
                  <p className="m-0 text-[11.5px] leading-relaxed text-text-muted">
                    {t(locale, `team.${roleKey}Note`)}
                  </p>
                </div>
              </div>
            </div>

            {wrongAccount ? (
              <div className="mt-4 rounded-2xl border border-critical/35 bg-critical/[0.06] p-3">
                <p className="m-0 text-[12.5px] leading-relaxed text-text-primary">
                  {tr("wrongAccount", { invited: invite!.email, current: user.email })}
                </p>
                {/* الخروجُ `POST` لا رابط (بيبطّل الجلسة على الخادم كمان)،
                    فمحتاجٌ زرّاً بيندهه ويرجّعه هنا بعد الدخول الصحيح. */}
                <SwitchAccount token={token} label={tr("switchAccount")} />
              </div>
            ) : (
              <AcceptInvite token={token} locale={locale} />
            )}

            <p className="mt-3 text-center text-[11.5px] text-text-faint">{user.email}</p>
          </>
        )}

        {dead && (
          <a href="/dashboard" className="btn btn-secondary mt-4 w-full justify-center">
            {tr("toDashboard")}
          </a>
        )}
      </div>
    </main>
  );
}
