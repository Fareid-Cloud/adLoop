// lib/sendEmail.ts
//
// 🔴 **كلُّ إيميل في المنتج كان يبتلع رفضَ المزوّد بصمت.**
//
// مكتبةُ Resend **لا ترمي استثناءً** حين يرفض الـAPI: ترجّع
// `{ data, error }`. وكلُّ نداءٍ عندنا كان `await resend.emails.send(...)`
// داخل `try/catch` - والـ`catch` لا يُنفَّذ أصلاً لأنّ شيئاً لم يُرمَ.
// فالرفضُ (نطاقٌ غير موثَّق، عنوانٌ غير صالح، تجاوزُ حدّ) كان يمرّ **كنجاح**:
// المسار يرجّع 200، ولا سطرَ في السجلّ، ولا رسالةَ تصل.
//
// وهذا بالضبط ما ظهر في دعوةِ فريقٍ لم تصل: الطلبُ نجح، والسجلُّ صامت،
// والبريدُ غير موجود. ولا يُكتشَف إلّا حين يسأل أحدٌ عن رسالةٍ ينتظرها.
//
// النقطةُ هنا واحدة يمرّ منها الجميع، تقرأ `error` فعلاً وترجّع نتيجةً
// **يُمكن فحصُها**. ومَن يتجاهل النتيجة يظهر في المراجعة، بخلاف
// `try/catch` فارغٍ يبدو صحيحاً.

import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

export interface SendResult {
  sent: boolean;
  /** سببُ الفشل كما قاله المزوّد - يُسجَّل ويُعرَض حيث يفيد. */
  error?: string;
}

export function isEmailConfigured(): boolean {
  return resend !== null;
}

export const FROM_ADDRESS =
  process.env.NOTIFICATION_FROM_EMAIL || "AdLoop <onboarding@resend.dev>";

export async function sendEmail(opts: {
  to: string | string[];
  subject: string;
  html: string;
  replyTo?: string;
  from?: string;
  /** اسمٌ يظهر في السجلّ ليُعرَف أيُّ رسالةٍ فشلت. */
  kind: string;
}): Promise<SendResult> {
  if (!resend) {
    console.warn(`[email:${opts.kind}] RESEND_API_KEY غير مضبوط - لم تُرسَل الرسالة.`);
    return { sent: false, error: "not_configured" };
  }

  try {
    const { error } = await resend.emails.send({
      from: opts.from || FROM_ADDRESS,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      ...(opts.replyTo ? { replyTo: opts.replyTo } : {}),
    });

    if (error) {
      // السببُ الأشيع هنا: النطاق في `NOTIFICATION_FROM_EMAIL` غير موثَّق
      // في Resend، أو استعمالُ `onboarding@resend.dev` لإرسالٍ إلى عنوانٍ
      // غير صاحب الحساب - وكلاهما يُرفض بـ403 بلا استثناء.
      console.error(`[email:${opts.kind}] رفضه المزوّد:`, error.message ?? error);
      return { sent: false, error: error.message ?? "provider_rejected" };
    }

    return { sent: true };
  } catch (err) {
    // الشبكةُ وحدها تصل هنا - أخطاءُ الـAPI تعود في `error` أعلاه.
    console.error(`[email:${opts.kind}] فشل الاتصال:`, err);
    return { sent: false, error: err instanceof Error ? err.message : "network" };
  }
}
