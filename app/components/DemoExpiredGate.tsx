// app/components/DemoExpiredGate.tsx
//
// ما يراه المستخدم حين تنتهي مدّة العرض التجريبي.
//
// **لماذا بوابة لا لافتة:** بيانات العرض أمثلة لا أرقام حقيقية. إبقاؤها
// معروضة بعد انتهاء المدّة - ولو بتنبيه فوقها - يعني أنّ منتجاً جوهره
// «تحقّق من أرقامك بدل تصديق أرقام المنصّات» يعرض هو نفسه أرقاماً غير
// حقيقية كأنها حقيقية. لذلك يُحجب **المحتوى**، لا يُزيَّن بتحذير.
//
// 🔴 **وكانت تحجب القشرة معه - وهذا هو العطل.** بطاقةٌ في وسط شاشةٍ فارغة:
// لا رأس، ولا قائمة جانبية، ولا قائمة حساب - أي لا تسجيل خروج ولا تبديل
// مساحة عمل. وزرّاها يشيران إلى صفحتين داخل `/dashboard`، وتخطيط اللوحة
// يلفّهما هما أيضاً، فكلّ ضغطةٍ تُعيد رسم البطاقة نفسها. زرّان لا يفعلان
// شيئاً بالمرّة، وشاشةٌ بلا باب.
//
// الآن هي **محتوى الصفحة** داخل القشرة: الرأس فوقها والقائمة جانبها، وفيهما
// المخرج. والصفحات التي تدلّ عليها مفتوحة فعلاً (`lib/demoGate.ts`).

import Link from "next/link";
import { Link2, CreditCard } from "lucide-react";
import { t, type Locale } from "@/lib/i18n/dictionary";
import { SwitchWorkspaceButton } from "@/app/components/SwitchWorkspaceButton";

export function DemoExpiredGate({
  locale,
  /** مساحة عملٍ حقيقية للمستخدم إن وُجدت - المخرج الأقرب، فتتصدّر */
  realWorkspace,
}: {
  locale: Locale;
  realWorkspace: { id: string; name: string } | null;
}) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="card pad-lg w-full max-w-md text-center">
        <h1 className="section-title mb-2">{t(locale, "demoGate.demoExpiredTitle")}</h1>
        <p className="mb-6 text-[13px] leading-relaxed text-text-muted">
          {t(locale, "demoGate.demoExpiredBody")}
        </p>
        <div className="flex flex-col gap-2">
          {/* مَن له مساحةٌ حقيقية أصلاً لا يحتاج ربطاً ولا باقة الآن - يحتاج
              أن يعود إليها. فتتقدّم على الاثنين، وتبقيان لمن أرادهما. */}
          {realWorkspace && (
            <SwitchWorkspaceButton
              workspaceId={realWorkspace.id}
              label={t(locale, "demoGate.demoExpiredBack", { name: realWorkspace.name })}
              locale={locale}
              className="btn btn-primary"
            />
          )}
          <Link
            href="/dashboard/integrations"
            className={realWorkspace ? "btn btn-secondary" : "btn btn-primary"}
          >
            <Link2 size={14} />
            {t(locale, "demoGate.demoExpiredConnect")}
          </Link>
          <Link href="/dashboard/billing" className="btn btn-secondary">
            <CreditCard size={14} />
            {t(locale, "demoGate.demoExpiredPlans")}
          </Link>
        </div>
      </div>
    </div>
  );
}
