// app/dashboard/campaigns/layout.tsx
//
// إطار قسم الحملات - **التنقّل يعيش هنا لا في صفحة واحدة منه.**
//
// 🔴 كان `CampaignsNav` مُصيَّراً في `page.tsx` وحدها، أي في **صفحةٍ من
// ثلاثين**. مَن يفتح «درجة الجودة» أو «مصطلحات البحث» يجد نفسه في صفحةٍ
// بلا أيّ تنقّل: لا تبويب يقول أين هو، ولا رابط إلى صفحةٍ مجاورة. السبيل
// الوحيد إلى الصفحة التالية زرُّ الرجوع في المتصفّح ثمّ اختيارٌ جديد.
//
// الإطار في Next.js يُصيَّر مرّةً ويبقى عبر انتقالات القسم كلّه - فالشريط
// لا يُعاد بناؤه مع كلّ صفحة، ولا يومض بينها.
//
// **العرض هنا لا في كلّ صفحة:** الحافّة التي تبدأ منها التبويبات هي نفسها
// التي يبدأ منها المحتوى تحتها. حين كان لكلّ صفحة عرضها الخاصّ مع توسيطٍ
// (`mx-auto`) كان المحتوى يبدأ من منتصف الشريط لا من أوّله - وهو الاختلال
// نفسه الذي رآه المالك في مرجع التصميم المرسَل: هناك حافّة واحدة تنتظم
// عليها التبويبات والبطاقات معاً.

import { getSessionUserFromCookies } from "@/lib/auth";
import type { Locale } from "@/lib/i18n/dictionary";
import { CampaignsNav } from "./CampaignsNav";

export default async function CampaignsLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUserFromCookies();
  const locale: Locale = (user?.preferredLocale as Locale) ?? "en";

  return (
    <div className="mx-auto max-w-6xl pb-10">
      <CampaignsNav locale={locale} />
      {children}
    </div>
  );
}
