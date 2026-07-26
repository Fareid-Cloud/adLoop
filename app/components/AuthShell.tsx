// app/components/AuthShell.tsx
//
// قشرة شاشات الحساب (دخول/تسجيل/استعادة) بتصميم split-screen احترافي:
// نصف بصري بالعلامة على اليسار، والفورم على اليمين — نفس أسلوب المنتجات
// العالمية (Runway/Linear).
//
// الصورة: ضع ملفك في public/auth-visual.png. لو غير موجود، تظهر خلفية
// متدرّجة أنيقة بنفس الهوية بدلاً منه (لا تنكسر الصفحة أبداً).

import type { ReactNode } from "react";

export function AuthShell({
  children,
  dir = "rtl",
  headline = "الحقيقة وراء كل إعلان",
  sub = "نقارن ما تقوله المنصات بما تحقّق فعلاً — لتدفع مقابل النتائج الحقيقية فقط.",
  wide = false,
}: {
  children: ReactNode;
  dir?: "rtl" | "ltr";
  headline?: string;
  sub?: string;
  wide?: boolean; // للفورم متعدد الأعمدة (التسجيل)
}) {
  return (
    <div dir={dir} data-accent="blue" data-mode="light" className="flex min-h-screen bg-bg font-display">
      {/* اللوحة البصرية - مخفية على الشاشات الصغيرة */}
      <div className="relative hidden w-1/2 overflow-hidden lg:block" style={{ background: "linear-gradient(150deg,#0A1628 0%,#0D2A4A 45%,#08192E 100%)" }}>
        {/* خلفية بالصورة - لو الملف غير موجود يظهر التدرّج تحتها بدون كسر */}
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: "url('/auth-visual.png')" }}
        />
        {/* توهّج خفيف + تعتيم سفلي ليظهر النص بوضوح فوق أي صورة */}
        <div className="absolute inset-0" style={{ background: "radial-gradient(60% 50% at 20% 30%, rgba(59,130,246,.22), transparent 70%)" }} />
        <div className="absolute inset-x-0 bottom-0 h-2/3" style={{ background: "linear-gradient(to top, rgba(4,12,24,.92), transparent)" }} />

        <div className="absolute inset-x-0 bottom-0 p-12">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[12px] text-white/85 backdrop-blur">
            AdLoop — طبقة الحقيقة
          </div>
          <h2 className="mb-3 text-[34px] font-bold leading-tight text-white">{headline}</h2>
          <p className="max-w-md text-[15px] leading-relaxed text-white/70">{sub}</p>
        </div>
      </div>

      {/* الفورم */}
      <div className="flex w-full items-center justify-center px-5 py-10 lg:w-1/2">
        <div className={`w-full ${wide ? "max-w-md" : "max-w-sm"}`}>{children}</div>
      </div>
    </div>
  );
}
