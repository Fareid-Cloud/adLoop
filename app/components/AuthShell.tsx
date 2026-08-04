// app/components/AuthShell.tsx
//
// قشرة شاشات الحساب (دخول/تسجيل/استعادة) بتصميم نصفين.
//
// **قاعدة التمرير:** الصفحة نفسها لا تتمرّر أبداً (`h-screen overflow-hidden`).
// النصف البصري ثابت تماماً، والتمرير - إن لزم - داخل عمود الفورم وحده.
// السبب عملي: نموذج التسجيل طويل، وتمرير الصفحة كلّها كان يسحب الصورة
// والعنوان لأعلى فيرى المستخدم نصف شاشة فارغاً، ويفقد الرسالة التي وُضعت
// هناك ليقرأها **أثناء** التسجيل لا قبله.
//
// الصورة: ضع ملفك في public/auth-visual.png (لو غير موجود يظهر تدرّج أنيق).

import type { ReactNode } from "react";
import { Search, ShieldCheck, TrendingUp } from "lucide-react";
import type { Locale } from "@/lib/i18n/dictionary";
import { LegalLinks } from "@/app/components/LegalLinks";

// نصّ تسويقي قصير: العنوان وعدٌ من كلمتين، والفقرة تشرحه في ثلاثة أفعال
// (اربط، التقط، قرّر)، والأيقونات تختصر الرحلة نفسها. أطول من ذلك لا
// يُقرأ على شاشة تسجيل - المستخدم جاء ليكتب لا ليقرأ.
// نصّ تسويقي بوعدٍ لا وصف: الجملة الأولى تقول ما يخسره اليوم، والثانية
// تقول ما نعطيه. الكلمة الملوّنة هي المفتاح - «تدفع» و«ثبت» - لأن اللون
// يقع على ما نريده أن يُقرأ أوّلاً حين تمرّ العين سريعاً.
const COPY = {
  en: {
    lead: "You pay for every click.",
    accent: "You should pay for customers.",
    sub: "Platforms report the conversions that flatter them. We check every one against a real conversation, and show you the gap - so your budget follows what actually happened.",
    pillars: ["Capture every click", "Verify against reality", "Decide on proof"],
  },
  ar: {
    lead: "تدفع مقابل كل نقرة.",
    accent: "والأولى أن تدفع مقابل العملاء.",
    sub: "المنصّات تُبلغ عن التحويلات التي تُجمّلها. نحن نفحص كلّ واحد منها مقابل محادثة حقيقية، ونُريك الفارق - لتتبع ميزانيتُك ما حدث فعلاً.",
    pillars: ["التقاط كل نقرة", "تحقّق من الواقع", "قرار على دليل"],
  },
};

const PILLAR_ICONS = [Search, ShieldCheck, TrendingUp];

export function AuthShell({
  children,
  locale = "en",
  onLocaleChange,
  headline,
  sub,
  wide = false,
}: {
  children: ReactNode;
  locale?: Locale;
  onLocaleChange?: (l: Locale) => void;
  headline?: string;
  sub?: string;
  wide?: boolean;
}) {
  const copy = COPY[locale] ?? COPY.en;

  return (
    <div
      dir={locale === "ar" ? "rtl" : "ltr"}
      data-accent="blue"
      data-mode="light"
      className="flex h-screen overflow-hidden bg-bg font-display"
    >
      {/* ==================== النصف البصري - ثابت لا يتمرّر ==================== */}
      <div
        className="relative hidden w-1/2 shrink-0 overflow-hidden lg:flex lg:flex-col"
        style={{ background: "linear-gradient(150deg,#0A1628 0%,#0D2A4A 45%,#08192E 100%)" }}
      >
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: "url('/auth-visual.png')" }}
        />
        {/* تعتيم متدرّج من الأسفل فقط: النصّ يحتاج تبايناً والصورة تحتاج ألّا
            تُغطّى. التدرّج يعطي الاثنين دون طبقة معتمة فوق المشهد كلّه. */}
        <div
          className="absolute inset-x-0 bottom-0 h-3/4"
          style={{
            background:
              "linear-gradient(to top, rgba(4,12,24,.94) 12%, rgba(4,12,24,.70) 42%, transparent)",
          }}
        />

        {/* `justify-end` لا `justify-between`: النصّ يستقرّ أسفل اللوحة
            فتبقى الصورة مكشوفة في أعلاها وأوسطها - كان يتوسّطها فيغطّي
            موضوعها. الشعار وحده يبقى في الأعلى بموضع مطلق. */}
        <div className="absolute inset-x-0 top-0 z-10 p-10 xl:p-12">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-[15px] font-bold text-white">
              A
            </span>
            <span className="text-[19px] font-bold tracking-tight text-white">AdLoop</span>
          </div>
        </div>

        <div className="relative z-10 flex h-full flex-col justify-end p-10 xl:p-12">
          <div>
            <h2 className="mb-4 text-[34px] font-bold leading-[1.14] tracking-tight text-white xl:text-[40px]">
              {headline ? (
                headline
              ) : (
                <>
                  {copy.lead}
                  <br />
                  <span className="text-accent">{copy.accent}</span>
                </>
              )}
            </h2>
            <p className="max-w-md text-[15px] leading-relaxed text-white/70">{sub ?? copy.sub}</p>

            {/* الركائز الثلاث: أيقونة صغيرة وسطران - إشارة لا لافتة، فلا
                تزاحم الصورة ولا تسرق الانتباه من العنوان. */}
            <div className="mt-9 flex flex-wrap gap-x-8 gap-y-4">
              {copy.pillars.map((label, i) => {
                const Icon = PILLAR_ICONS[i];
                return (
                  <div key={label} className="flex items-center gap-2.5">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/[0.12] bg-white/[0.07] text-accent backdrop-blur-sm">
                      <Icon size={16} />
                    </span>
                    <span className="max-w-[96px] text-[12.5px] font-medium leading-snug text-white/85">
                      {label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <p className="mt-9 text-[11.5px] text-white/35">
            © {new Date().getFullYear()} AdLoop. All rights reserved.
          </p>
        </div>
      </div>

      {/* ==================== عمود الفورم - هو وحده يتمرّر ==================== */}
      <div className="relative flex w-full flex-col overflow-y-auto lg:w-1/2">
        {onLocaleChange && (
          <div className="sticky top-0 z-20 flex justify-end bg-bg/95 px-5 pt-5 backdrop-blur-sm">
            <div className="flex gap-1 card p-0.5 text-[12px]">
              {(["en", "ar"] as Locale[]).map((l) => (
                <button
                  key={l}
                  onClick={() => onLocaleChange(l)}
                  className={`rounded-md px-2.5 py-1 transition-colors ${
                    locale === l
                      ? "bg-accent font-medium text-white"
                      : "text-text-muted hover:text-text-primary"
                  }`}
                >
                  {l === "en" ? "EN" : "العربية"}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* `my-auto` يوسّط الفورم القصير رأسياً، ويتراجع من تلقائه حين يطول
            فيبدأ من الأعلى بدل أن يُقصّ نصفه خارج الشاشة. */}
        <div className="flex flex-1 items-start justify-center px-5 pb-6 pt-6">
          <div className={`my-auto w-full ${wide ? "max-w-lg" : "max-w-sm"}`}>{children}</div>
        </div>

        {/* المدخل الوحيد للصفحات القانونية قبل تسجيل الدخول - ومن لم
            يسجّل بعدُ هو أكثر من يحتاج قراءتها. */}
        <div className="px-5 pb-8">
          <LegalLinks locale={locale} variant="footer" />
        </div>
      </div>
    </div>
  );
}
