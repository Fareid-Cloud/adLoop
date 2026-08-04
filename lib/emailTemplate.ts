// lib/emailTemplate.ts
//
// **قالب البريد الموحّد — الهويّة البصرية في صندوق الوارد.**
//
// كان كلّ مرسِل يكتب HTML خاصّاً به: `font-family: sans-serif` وعنوان
// وفقرة. خمس رسائل بخمسة أشكال، بلا شعار ولا هويّة ولا تذييل — تصل إلى
// صندوق فيه بريد شركات حقيقية فتبدو آلية ومؤقّتة.
//
// الهويّة هنا **هي نفسها** هويّة التقرير المطبوع والتطبيق: نفس الألوان
// ونفس نصف القطر ونفس الإيقاع. من يرى التقرير ثمّ يصله بريد يجب أن يعرف
// أنّهما من المنتج نفسه.
//
// **قيود عملاء البريد التي تحكم كلّ قرار هنا** (ليست تفضيلات):
//   • أنماط داخلية حصراً — Gmail يحذف `<style>` من الرأس.
//   • جداول لا flexbox ولا grid — Outlook (محرّك Word) لا يدعمهما.
//   • ألوان صريحة على كلّ عنصر — الوضع الداكن في بعض العملاء يقلب
//     الافتراضيات فيختفي النصّ على خلفيته.
//   • عرض أقصى 600px — أوسع منه يُقصّ في نافذة المعاينة.
//   • `role="presentation"` على كلّ جدول تخطيط — وإلّا قرأته قارئات
//     الشاشة كجدول بيانات وأعلنت أبعاده.
//
// **الشعار:** حرف في مربّع حتى يصل ملفّ الشعار. تُستبدل `LOGO_URL` بعدها
// في مكان واحد فيتغيّر في كلّ رسالة — راجع `BRAND_LOGO` أدناه.

export type EmailTone = "neutral" | "urgent" | "positive";

const BRAND = {
  ink: "#171C27",
  muted: "#5C6478",
  faint: "#8B95A3",
  line: "#E7EAEF",
  surface: "#FFFFFF",
  tint: "#F7F8FA",
  accent: "#4C8DFF",
  accentDim: "#EEF4FF",
  verified: "#16A34A",
  verifiedDim: "#EAF7EF",
  critical: "#DC2626",
  criticalDim: "#FDEEEE",
};

/** رموز الهويّة لمن يبني markup خاصّاً (جدول تقرير مثلاً) */
export const EMAIL_BRAND = BRAND;

/**
 * الشعار.
 *
 * `url` فارغة الآن فيُرسَم الحرف في مربّع. عند وصول ملفّ الشعار يوضع
 * رابطه المطلق هنا (مستضاف على نطاق ثابت — البريد لا يقرأ الملفّات
 * المحلّية) فيسري على كلّ رسالة ورد آلي في المنتج بلا تعديل آخر.
 */
export const BRAND_LOGO = {
  url: process.env.NEXT_PUBLIC_BRAND_LOGO_URL ?? "",
  /** الارتفاع بالبكسل — العرض تلقائي حفاظاً على النسبة */
  height: 28,
  alt: "AdLoop",
};

const TONE = {
  neutral: { solid: BRAND.accent, soft: BRAND.accentDim },
  urgent: { solid: BRAND.critical, soft: BRAND.criticalDim },
  positive: { solid: BRAND.verified, soft: BRAND.verifiedDim },
} as const;

export const escapeHtml = (s: unknown): string =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const COPY = {
  ar: {
    tagline: "طبقة التحقّق لإعلاناتك",
    whyAlert: "وصلتك هذه الرسالة لأنّك فعّلت تنبيهات البريد في إعدادات مساحة عملك.",
    whyMarketing: "تصلك هذه الرسالة لأنّ لديك حساباً في AdLoop.",
    manage: "إدارة التفضيلات",
    unsubscribe: "إيقاف رسائل التسويق",
    rights: "جميع الحقوق محفوظة",
    footerNote: "AdLoop — نقارن ما تقوله المنصّات بما يحدث فعلاً.",
  },
  en: {
    tagline: "The verification layer for your ads",
    whyAlert: "You are receiving this because you enabled email alerts in your workspace settings.",
    whyMarketing: "You are receiving this because you have an AdLoop account.",
    manage: "Manage preferences",
    unsubscribe: "Stop marketing emails",
    rights: "All rights reserved",
    footerNote: "AdLoop — we compare what the platforms claim against what actually happened.",
  },
};

export interface EmailBlock {
  /** فقرة نصّية — تُهرَّب تلقائياً */
  text?: string;
  /** عنوان فرعي داخل البطاقة */
  heading?: string;
  /** صفّ رقم: تسمية وقيمة — يُقرأ كسطر مرتّب لا كجملة */
  stat?: { label: string; value: string; tone?: EmailTone; hint?: string };
  /** بطاقة رقم بارزة: الرقم الذي بُنيت الرسالة حوله */
  hero?: { value: string; label: string; tone?: EmailTone };
  /** عناصر مرقّمة — أخفّ من فقرات متتالية حين تُعدّد أشياء */
  list?: string[];
  /** فاصل بصري بين قسمين */
  divider?: true;
  /**
   * markup جاهز لما لا يغطّيه ما سبق (جدول بيانات مثلاً).
   *
   * ⚠️ لا يُهرَّب. لا تمرّر هنا إلّا markup بنيتَه بنفسك بقيم مهرَّبة
   * أصلاً — أيّ نصّ من المستخدم يمرّ من هنا هو حقن HTML في بريد.
   */
  html?: string;
}

export function renderEmail(opts: {
  locale: "ar" | "en";
  /** سياق فوق العنوان بحرف صغير — لا عنوان ثانٍ */
  eyebrow?: string;
  title: string;
  /** سطر تحت العنوان يلخّص الرسالة قبل التفاصيل */
  subtitle?: string;
  blocks: EmailBlock[];
  cta?: { label: string; url: string };
  /** رابط ثانوي تحت الزرّ — لمن لا يريد الإجراء الأساسي */
  secondaryCta?: { label: string; url: string };
  tone?: EmailTone;
  /** رابط التفضيلات — التنبيهات تعرضه، والرسائل التسويقية تعرض إلغاء الاشتراك */
  preferencesUrl?: string;
  unsubscribeUrl?: string;
}): string {
  const ar = opts.locale === "ar";
  const c = COPY[opts.locale];
  const dir = ar ? "rtl" : "ltr";
  const start = ar ? "right" : "left";
  const end = ar ? "left" : "right";
  const tone = TONE[opts.tone ?? "neutral"];
  const year = new Date().getFullYear();

  const body = opts.blocks
    .map((b) => {
      if (b.hero) {
        const t = TONE[b.hero.tone ?? "neutral"];
        return `
        <tr><td style="padding:2px 0 14px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
                 style="background:${t.soft};border-radius:14px;">
            <tr><td style="padding:18px 20px;text-align:${start};">
              <div style="font-size:30px;font-weight:700;line-height:1.15;color:${t.solid};">${escapeHtml(b.hero.value)}</div>
              <div style="margin-top:4px;font-size:12.5px;color:${BRAND.muted};">${escapeHtml(b.hero.label)}</div>
            </td></tr>
          </table>
        </td></tr>`;
      }
      if (b.stat) {
        const color = b.stat.tone ? TONE[b.stat.tone].solid : BRAND.ink;
        return `
        <tr><td style="padding:0 0 8px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
                 style="background:${BRAND.tint};border:1px solid ${BRAND.line};border-radius:12px;">
            <tr>
              <td style="padding:12px 14px;text-align:${start};">
                <div style="font-size:13px;color:${BRAND.muted};">${escapeHtml(b.stat.label)}</div>
                ${b.stat.hint ? `<div style="margin-top:2px;font-size:11.5px;color:${BRAND.faint};">${escapeHtml(b.stat.hint)}</div>` : ""}
              </td>
              <td style="padding:12px 14px;font-size:17px;font-weight:600;color:${color};text-align:${end};white-space:nowrap;">${escapeHtml(b.stat.value)}</td>
            </tr>
          </table>
        </td></tr>`;
      }
      if (b.list) {
        const items = b.list
          .map(
            (it, i) => `
          <tr>
            <td width="22" valign="top" style="padding:0 0 8px;font-size:12px;font-weight:700;color:${tone.solid};text-align:${start};">${i + 1}.</td>
            <td valign="top" style="padding:0 0 8px;font-size:14px;line-height:1.65;color:${BRAND.muted};text-align:${start};">${escapeHtml(it)}</td>
          </tr>`
          )
          .join("");
        return `<tr><td style="padding:0 0 10px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${items}</table></td></tr>`;
      }
      if (b.divider) {
        return `<tr><td style="padding:8px 0 16px;"><div style="height:1px;background:${BRAND.line};line-height:1px;font-size:0;">&nbsp;</div></td></tr>`;
      }
      if (b.heading) {
        return `<tr><td style="padding:6px 0 8px;font-size:14.5px;font-weight:600;color:${BRAND.ink};text-align:${start};">${escapeHtml(b.heading)}</td></tr>`;
      }
      if (b.html) {
        return `<tr><td style="padding:0 0 14px;text-align:${start};">${b.html}</td></tr>`;
      }
      return `<tr><td style="padding:0 0 14px;font-size:14.5px;line-height:1.75;color:${BRAND.muted};text-align:${start};">${escapeHtml(b.text)}</td></tr>`;
    })
    .join("");

  const cta = opts.cta
    ? `<tr><td style="padding:8px 0 0;text-align:${start};">
         <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
           <td style="background:${tone.solid};border-radius:11px;">
             <a href="${escapeHtml(opts.cta.url)}"
                style="display:inline-block;color:#FFFFFF;text-decoration:none;font-size:14.5px;
                       font-weight:600;padding:13px 26px;">${escapeHtml(opts.cta.label)}</a>
           </td>
         </tr></table>
       </td></tr>`
    : "";

  const secondary = opts.secondaryCta
    ? `<tr><td style="padding:12px 0 0;text-align:${start};">
         <a href="${escapeHtml(opts.secondaryCta.url)}"
            style="font-size:13px;color:${BRAND.muted};text-decoration:underline;">${escapeHtml(opts.secondaryCta.label)}</a>
       </td></tr>`
    : "";

  // الشعار: صورة إن توفّرت، وإلّا الحرف في مربّع
  const mark = BRAND_LOGO.url
    ? `<img src="${escapeHtml(BRAND_LOGO.url)}" height="${BRAND_LOGO.height}" alt="${escapeHtml(BRAND_LOGO.alt)}"
            style="display:block;height:${BRAND_LOGO.height}px;width:auto;border:0;outline:none;text-decoration:none;">`
    : `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
         <td style="width:30px;height:30px;background:${BRAND.accent};border-radius:9px;color:#FFFFFF;
                    font-size:15px;font-weight:700;text-align:center;line-height:30px;">A</td>
         <td style="padding:0 9px;font-size:16px;font-weight:700;color:${BRAND.ink};white-space:nowrap;">AdLoop</td>
       </tr></table>`;

  const whyLine = opts.unsubscribeUrl
    ? `${escapeHtml(c.whyMarketing)} <a href="${escapeHtml(opts.unsubscribeUrl)}" style="color:${BRAND.faint};text-decoration:underline;">${escapeHtml(c.unsubscribe)}</a>`
    : opts.preferencesUrl
      ? `${escapeHtml(c.whyAlert)} <a href="${escapeHtml(opts.preferencesUrl)}" style="color:${BRAND.faint};text-decoration:underline;">${escapeHtml(c.manage)}</a>`
      : "";

  return `<!doctype html>
<html dir="${dir}" lang="${opts.locale}" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light only">
<meta name="supported-color-schemes" content="light only">
<title>${escapeHtml(opts.title)}</title>
</head>
<body style="margin:0;padding:0;background:${BRAND.tint};-webkit-text-size-adjust:100%;">

<!-- نصّ المعاينة: يظهر بجانب العنوان في صندوق الوارد. بدونه يعرض
     العميل أوّل ما يجده في الرسالة - وهو غالباً اسم الشعار. -->
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(opts.subtitle ?? opts.title)}</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${BRAND.tint};">
  <tr><td align="center" style="padding:30px 14px 40px;">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"
           style="width:100%;max-width:600px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">

      <!-- ═══ الترويسة ═══ -->
      <tr><td style="padding:0 4px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
          <td style="text-align:${start};">${mark}</td>
          <td style="text-align:${end};font-size:11.5px;color:${BRAND.faint};">${escapeHtml(c.tagline)}</td>
        </tr></table>
      </td></tr>

      <!-- ═══ البطاقة ═══ -->
      <tr><td style="background:${BRAND.surface};border:1px solid ${BRAND.line};border-radius:18px;">
        <!-- شريط لوني علوي: يحمل نبرة الرسالة قبل قراءة حرف واحد -->
        <div style="height:3px;background:${tone.solid};border-radius:18px 18px 0 0;line-height:3px;font-size:0;">&nbsp;</div>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr><td style="padding:24px 24px 26px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              ${opts.eyebrow ? `<tr><td style="padding:0 0 7px;font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:${tone.solid};text-align:${start};">${escapeHtml(opts.eyebrow)}</td></tr>` : ""}
              <tr><td style="padding:0 0 ${opts.subtitle ? "6" : "14"}px;font-size:21px;font-weight:700;line-height:1.35;color:${BRAND.ink};text-align:${start};">${escapeHtml(opts.title)}</td></tr>
              ${opts.subtitle ? `<tr><td style="padding:0 0 16px;font-size:14px;line-height:1.65;color:${BRAND.faint};text-align:${start};">${escapeHtml(opts.subtitle)}</td></tr>` : ""}
              ${body}
              ${cta}
              ${secondary}
            </table>
          </td></tr>
        </table>
      </td></tr>

      <!-- ═══ التذييل ═══ -->
      <tr><td style="padding:18px 8px 0;text-align:${start};">
        <p style="margin:0;font-size:12px;line-height:1.7;color:${BRAND.faint};">${escapeHtml(c.footerNote)}</p>
        ${whyLine ? `<p style="margin:8px 0 0;font-size:11.5px;line-height:1.7;color:${BRAND.faint};">${whyLine}</p>` : ""}
        <p style="margin:10px 0 0;font-size:11.5px;color:${BRAND.faint};">© ${year} AdLoop. ${escapeHtml(c.rights)}.</p>
      </td></tr>

    </table>
  </td></tr>
</table>
</body></html>`;
}
