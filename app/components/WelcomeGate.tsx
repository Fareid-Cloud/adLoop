"use client";

// بوابة الترحيب: أول ما تدخل، بتغطي الشاشة بالكامل قبل القائمة الجانبية
// وتشرح البرنامج في خطوات واضحة بأزرار تنقّل خاصة بيها (مستحيل تعلق).
// "تخطٍّ" متاح دائماً. عند الإنهاء بنعلّم الحساب إنه أنهى التعريف.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, Link2, Sparkles, Rocket } from "lucide-react";

interface Slide {
  icon: typeof ShieldCheck;
  titleAr: string;
  titleEn: string;
  bodyAr: string;
  bodyEn: string;
}

const SLIDES: Slide[] = [
  {
    icon: Rocket,
    titleAr: "أهلاً بك في AdLoop",
    titleEn: "Welcome to AdLoop",
    bodyAr: "طبقة الحقيقة لإعلاناتك. سنأخذك في جولة سريعة توضّح فكرة البرنامج وكيف تبدأ.",
    bodyEn: "The truth layer for your ads. Here's a quick tour of what AdLoop does and how to start.",
  },
  {
    icon: ShieldCheck,
    titleAr: "الرقم الحقيقي، لا رقم المنصة فقط",
    titleEn: "The real number, not just the platform's",
    bodyAr: "المنصات تبالغ أحياناً في عدد التحويلات. نقارن ما تقوله المنصة بما تحقّق فعلاً من محادثات واتساب وماسنجر حقيقية — وهذا الفارق يقود كل قرار.",
    bodyEn: "Platforms often overstate conversions. We compare what the platform claims against what is actually verified from real WhatsApp/Messenger conversations — and that gap drives every decision.",
  },
  {
    icon: Link2,
    titleAr: "الخطوة الأولى: اربط حساباتك",
    titleEn: "Step one: connect your accounts",
    bodyAr: "من الإعدادات، اربط حسابات Google وMeta وTikTok. تحتاج الأرقام بضع دقائق لتتزامن أول مرة.",
    bodyEn: "From Settings, connect your Google, Meta and TikTok accounts. Data takes a few minutes to sync the first time.",
  },
  {
    icon: Sparkles,
    titleAr: "قرارات جاهزة للتنفيذ",
    titleEn: "Decisions ready to act on",
    bodyAr: "يحلّل النظام بياناتك ويقترح قرارات (زيادة/إيقاف ميزانية، تنبيهات) يمكنك تنفيذها بضغطة واحدة. أنت جاهز الآن!",
    bodyEn: "AdLoop analyzes your data and suggests decisions (scale/kill budget, alerts) you can apply in one click. You're all set!",
  },
];

export function WelcomeGate({ locale, startStep = 0 }: { locale: "ar" | "en"; startStep?: number }) {
  const router = useRouter();
  const ar = locale === "ar";
  const [i, setI] = useState(Math.min(startStep, SLIDES.length - 1));
  const [closing, setClosing] = useState(false);

  const slide = SLIDES[i];
  const Icon = slide.icon;
  const isLast = i === SLIDES.length - 1;

  async function persist(body: object) {
    await fetch("/api/onboarding/progress", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => {});
  }

  async function finish() {
    setClosing(true);
    await persist({ step: SLIDES.length, completed: true });
    router.refresh();
  }

  async function skip() {
    setClosing(true);
    await persist({ dismissed: true });
    router.refresh();
  }

  function next() {
    if (isLast) return finish();
    const n = i + 1;
    setI(n);
    void persist({ step: n });
  }

  if (closing) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-bg/85 px-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-3xl card-shadow border border-border bg-surface p-8 shadow-2xl">
        <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/15 text-accent">
          <Icon size={26} />
        </div>
        <h2 className="mb-2 text-xl font-bold text-text-primary">{ar ? slide.titleAr : slide.titleEn}</h2>
        <p className="mb-7 text-sm leading-relaxed text-text-muted">{ar ? slide.bodyAr : slide.bodyEn}</p>

        <div className="flex items-center justify-between">
          <div className="flex gap-1.5">
            {SLIDES.map((_, idx) => (
              <span
                key={idx}
                className={`h-1.5 rounded-full transition-all ${idx === i ? "w-5 bg-accent" : "w-1.5 bg-border-visible"}`}
              />
            ))}
          </div>
          <div className="flex items-center gap-2">
            {i > 0 && (
              <button
                onClick={() => setI(i - 1)}
                className="rounded-xl px-3 py-2 text-sm text-text-muted transition-colors hover:text-text-primary"
              >
                {ar ? "السابق" : "Back"}
              </button>
            )}
            <button
              onClick={next}
              className="rounded-xl bg-accent px-5 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
            >
              {isLast ? (ar ? "ابدأ الآن" : "Get started") : ar ? "التالي" : "Next"}
            </button>
          </div>
        </div>

        {!isLast && (
          <button
            onClick={skip}
            className="mt-5 w-full text-center text-xs text-text-faint transition-colors hover:text-text-muted"
          >
            {ar ? "تخطّي الجولة" : "Skip the tour"}
          </button>
        )}
      </div>
    </div>
  );
}
