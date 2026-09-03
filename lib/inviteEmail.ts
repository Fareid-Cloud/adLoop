// lib/inviteEmail.ts
//
// **الدعوة رسالةٌ تُبعَت، لا رابطٌ يُنسَخ.**
//
// كانت الدعوةُ بتنتهي عند رابطٍ في الشاشة: صاحبُ الحساب لازم ينسخه ويفتح
// واتساب أو بريده ويبعته بنفسه ويشرح إيه ده. تلاتُ خطواتٍ يدوية بعد فعلٍ
// اسمُه «ادعُ» - والأسوأ إنّ الرابط بيوصل عارياً من غير سياق، فاللي بيستلمه
// بيشوف عنواناً غريباً وبيتردّد يدوس عليه، وهو تردّدٌ صحيّ.
//
// الرسالةُ بتحلّ الاتنين: بتوصل من عندنا بهويّتنا، وبتقول **مين** دعاه
// و**لأيّ مساحة** و**بأيّ دور** قبل ما تطلب منه يدوس أيَّ حاجة. واللي
// مش مهتمّ بيتجاهلها وخلاص - مافيش حساب اتعمل ولا حاجة اتغيّرت عنده.
//
// والرابطُ في الشاشة بيفضل موجوداً كطريقٍ إضافيّ لمَن يفضّل يبعته بنفسه.

import { Resend } from "resend";
import { getAppUrl } from "@/lib/appUrl";
import { renderEmail } from "@/lib/emailTemplate";
import { t, type Locale } from "@/lib/i18n/dictionary";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

export async function sendInviteEmail(opts: {
  to: string;
  /** اسمُ الداعي كما يعرفه المدعوّ - بريدُه لو مافيش اسم. */
  inviterName: string;
  workspaceName: string;
  role: "VIEWER" | "OPERATOR";
  token: string;
  expiresAt: Date;
  /** لغةُ الداعي: أقربُ تخمينٍ متاح للغة زميله. */
  locale: Locale;
}): Promise<{ sent: boolean }> {
  if (!resend) {
    console.warn("RESEND_API_KEY غير مضبوط - الدعوة محفوظة والرابط بيرجع في الرد، لكن مافيش بريد اتبعت");
    return { sent: false };
  }

  const tr = (k: string, vars?: Record<string, string | number>) => t(opts.locale, `inviteEmail.${k}`, vars);
  const url = `${getAppUrl()}/invite/${opts.token}`;
  const roleLabel = t(opts.locale, opts.role === "OPERATOR" ? "team.operator" : "team.viewer");

  const days = Math.max(
    1,
    Math.round((opts.expiresAt.getTime() - Date.now()) / 86_400_000)
  );

  try {
    await resend.emails.send({
      from: process.env.NOTIFICATION_FROM_EMAIL || "AdLoop <onboarding@resend.dev>",
      to: opts.to,
      subject: tr("subject", { inviter: opts.inviterName, workspace: opts.workspaceName }),
      html: renderEmail({
        locale: opts.locale,
        art: "loop",
        eyebrow: tr("eyebrow"),
        title: tr("title", { workspace: opts.workspaceName }),
        subtitle: tr("subtitle", { inviter: opts.inviterName, role: roleLabel }),
        blocks: [
          { text: tr("what") },
          {
            stat: {
              label: t(opts.locale, "team.role"),
              value: roleLabel,
            },
          },
          { text: tr("expires", { days }) },
          // **الرفضُ مالوش زرار عن قصد.** «مش أنا» أو «ارفض» بيطلب من
          // اللي مش مهتمّ فعلاً يعمل حاجة، وبيدّي مَن بيجرّب العناوين
          // تأكيداً إنّ العنوان ده شغّال. التجاهلُ كافٍ، والرسالةُ
          // بتقوله كده صراحةً فيقفل ويمشي بلا قلق.
          { text: tr("ignore") },
        ],
        cta: { label: tr("cta"), url },
      }),
    });
    return { sent: true };
  } catch (err) {
    console.error("فشل إرسال دعوة الفريق:", err);
    return { sent: false };
  }
}
