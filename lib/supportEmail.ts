// lib/supportEmail.ts
//
// إشعار صاحب المنتج بأي رسالة دعم جديدة عبر البريد (Resend). لو RESEND_API_KEY
// مش متظبط، بنتخطى بهدوء (الرسالة تفضل محفوظة في قاعدة البيانات على أي حال).
import { Resend } from "resend";
import { getAppUrl } from "@/lib/appUrl";
import { renderEmail } from "@/lib/emailTemplate";
import { OWNER_EMAIL } from "@/lib/owner";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
// 🔴 كان هنا بريدٌ شخصيٌّ مكتوبٌ في الكود كوجهةٍ افتراضية. وتذاكرُ الدعم
// تحمل اسمَ العميل وبريدَه وهاتفَه ونصَّ مشكلته - أي أنّ متغيّرَ بيئةٍ غيرَ
// مضبوطٍ كان يرسل بيانات عملاء إلى عنوانٍ مكتوبٍ في مستودعٍ يقرؤه غيرُ صاحبه.
//
// والترتيب: صندوقُ الدعم إن ضُبط، وإلّا بريدُ المالك. وبلا كليهما **لا
// يُرسَل شيء** ويُكتب تحذير - إشعارٌ ضائعٌ مع سجلٍّ أهونُ من بيانات عميلٍ
// تذهب إلى حيث لا يُقصَد.
const OWNER_INBOX = (process.env.SUPPORT_INBOX_EMAIL || OWNER_EMAIL || "").trim();

export async function notifyOwnerNewSupport(t: {
  name: string;
  email: string;
  phone?: string | null;
  country?: string | null;
  subject: string;
  body: string;
  isReply?: boolean;
}) {
  if (!resend) {
    console.warn("RESEND_API_KEY غير مضبوط - لم يُرسل إشعار الدعم (الرسالة محفوظة في قاعدة البيانات)");
    return;
  }
  if (!OWNER_INBOX) {
    console.warn(
      "SUPPORT_INBOX_EMAIL وOWNER_EMAIL غير مضبوطين - لم يُرسل إشعار الدعم. " +
        "التذكرة محفوظة في قاعدة البيانات وتُقرأ من /admin/support."
    );
    return;
  }
  const adminUrl = `${getAppUrl()}/admin/support`;
  try {
    await resend.emails.send({
      from: process.env.NOTIFICATION_FROM_EMAIL || "AdLoop <onboarding@resend.dev>",
      to: OWNER_INBOX,
      replyTo: t.email,
      subject: t.isReply ? `رد جديد على محادثة دعم — ${t.subject}` : `رسالة دعم جديدة — ${t.subject}`,
      // 🔴 كانت بيانات المرسِل تُحقن في HTML بلا تهريب (`${t.name}`,
      // `${t.body}`) - أي أنّ عميلاً يكتب وسماً في رسالة دعم يحقنه في
      // بريد المالك. `renderEmail` يهرّب كلّ قيمة تمرّ به.
      html: renderEmail({
        locale: "ar",
        art: "none",
        eyebrow: t.isReply ? "ردّ على محادثة قائمة" : "رسالة جديدة",
        title: t.subject,
        blocks: [
          { stat: { label: "الاسم", value: t.name } },
          { stat: { label: "البريد", value: t.email } },
          ...(t.phone ? [{ stat: { label: "الهاتف", value: t.phone } }] : []),
          ...(t.country ? [{ stat: { label: "الدولة", value: t.country } }] : []),
          { text: t.body },
        ],
        cta: { label: "افتح لوحة الدعم للردّ", url: adminUrl },
      }),
    });
  } catch (err) {
    console.error("فشل إرسال إشعار الدعم:", err);
  }
}
