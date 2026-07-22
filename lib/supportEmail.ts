// lib/supportEmail.ts
//
// إشعار صاحب المنتج بأي رسالة دعم جديدة عبر البريد (Resend). لو RESEND_API_KEY
// مش متظبط، بنتخطى بهدوء (الرسالة تفضل محفوظة في قاعدة البيانات على أي حال).
import { Resend } from "resend";
import { getAppUrl } from "@/lib/appUrl";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const OWNER_INBOX = process.env.SUPPORT_INBOX_EMAIL || "manfareiduwk@gmail.com";

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
  const adminUrl = `${getAppUrl()}/admin/support`;
  try {
    await resend.emails.send({
      from: process.env.NOTIFICATION_FROM_EMAIL || "AdLoop <onboarding@resend.dev>",
      to: OWNER_INBOX,
      replyTo: t.email,
      subject: t.isReply ? `رد جديد على محادثة دعم — ${t.subject}` : `رسالة دعم جديدة — ${t.subject}`,
      html: `
        <div dir="rtl" style="font-family: sans-serif; padding: 16px; color: #16181D;">
          <h2 style="margin:0 0 12px;">${t.isReply ? "رد جديد من عميل" : "رسالة دعم جديدة"}</h2>
          <p><b>الاسم:</b> ${t.name}</p>
          <p><b>البريد:</b> ${t.email}</p>
          ${t.phone ? `<p><b>الهاتف:</b> ${t.phone}</p>` : ""}
          ${t.country ? `<p><b>الدولة:</b> ${t.country}</p>` : ""}
          <p><b>الموضوع:</b> ${t.subject}</p>
          <p style="white-space:pre-wrap; background:#F5F6F8; padding:12px; border-radius:8px;">${t.body}</p>
          <p><a href="${adminUrl}" style="color:#4C8DFF;">افتح لوحة الدعم للرد ←</a></p>
        </div>`,
    });
  } catch (err) {
    console.error("فشل إرسال إشعار الدعم:", err);
  }
}
