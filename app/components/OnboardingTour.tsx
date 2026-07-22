"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { driver, type Driver } from "driver.js";
import "driver.js/dist/driver.css";

// جولة تعريف تفاعلية - هايلايت + شرح جنبيه، بعض الخطوات إجبارية (لازم
// تدوس على العنصر نفسه عشان تكمل)، وبعضها معلوماتي بس. بتشتغل عبر
// صفحات مختلفة لأن الأقسام فعلياً صفحات منفصلة.

interface TourStep {
  path: string;
  target: string | null;
  title: string;
  description: string;
  requiresClick: boolean;
}

const TOUR_STEPS: TourStep[] = [
  {
    path: "/dashboard",
    target: null,
    title: "أهلاً بك في AdLoop 👋",
    description: "سنأخذ جولة سريعة (دقيقتين فقط) نوضح لك فيها كيفية استخدام البرنامج بأقصى استفادة. يمكنك إيقافها في أي وقت.",
    requiresClick: false,
  },
  {
    path: "/dashboard",
    target: "#tour-nav-/dashboard/settings",
    title: "الخطوة الأولى - اربط حملاتك",
    description: "أول خطوة: اربط حسابات جوجل وميتا وتيك توك الخاصة بك. اضغط هنا للانتقال إلى الإعدادات.",
    requiresClick: true,
  },
  {
    path: "/dashboard/settings",
    target: "#tour-nav-/dashboard",
    title: "تمام، الحملات مربوطة الآن",
    description: "الأرقام تحتاج بضع دقائق لتتزامن أول مرة. لننتقل الآن لنظرتك اليومية.",
    requiresClick: true,
  },
  {
    path: "/dashboard",
    target: "#tour-nav-/dashboard/campaigns",
    title: "هنا نظرتك اليومية",
    description: "أهم أرقام يومك في مكان واحد. لننتقل الآن لتفاصيل حملاتك.",
    requiresClick: true,
  },
  {
    path: "/dashboard/campaigns",
    target: "#tour-nav-/dashboard/actions",
    title: "هنا تقارن أداء إعلاناتك",
    description: "لكل منصة صفحة تقارن إعلاناتها مع بعضها، وصفحة شاملة تقارن كل المنصات. لننتقل الآن للقرارات الجاهزة.",
    requiresClick: true,
  },
  {
    path: "/dashboard/actions",
    target: "#tour-nav-/dashboard/reports",
    title: "هنا اقتراحات جاهزة للتنفيذ",
    description: "يحلّل النظام بياناتك ويقترح عليك قرارات جاهزة. اضغط موافقة لتنفيذ الاقتراح فعلياً عند المنصة نفسها.",
    requiresClick: true,
  },
  {
    path: "/dashboard/reports",
    target: null,
    title: "التقارير",
    description: "تقارير جاهزة تصدّرها لعملائك أو فريقك، بأرقام حقيقية مؤكدة، لا مجرد أرقام المنصات وحدها.",
    requiresClick: false,
  },
  {
    path: "/dashboard/reports",
    target: "#tour-notification-bell",
    title: "الجرس هنا لمساعدتك",
    description: "أي تنبيه مهم يخص حسابك ستجده هنا فوراً.",
    requiresClick: false,
  },
  {
    path: "/dashboard/reports",
    target: null,
    title: "تمام، انتهينا! 🎉",
    description: "أصبحت جاهزاً للبدء فعلياً. إذا أردت العودة لهذه الجولة، ستجد زر \"الجولة التعريفية\" في الإعدادات.",
    requiresClick: false,
  },
];

export function OnboardingTour({
  step,
  completed,
  dismissed,
}: {
  step: number;
  completed: boolean;
  dismissed: boolean;
}) {
  const pathname = usePathname();
  const driverRef = useRef<Driver | null>(null);

  useEffect(() => {
    if (completed || dismissed) return;
    if (step >= TOUR_STEPS.length) return;

    const currentStep = TOUR_STEPS[step];
    if (currentStep.path !== pathname) return;

    async function saveProgress(nextStep: number, isCompleted: boolean) {
      await fetch("/api/onboarding/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ step: nextStep, completed: isCompleted }),
      });
    }

    async function skipTour() {
      await fetch("/api/onboarding/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dismissed: true }),
      });
    }

    const isLastStep = step === TOUR_STEPS.length - 1;

    const driverObj = driver({
      showProgress: true,
      progressText: `${step + 1} من ${TOUR_STEPS.length}`,
      nextBtnText: "التالي",
      prevBtnText: "السابق",
      doneBtnText: "خلاص",
      onCloseClick: () => {
        void skipTour();
        driverObj.destroy();
      },
      steps: [
        {
          element: currentStep.target ?? undefined,
          popover: {
            title: currentStep.title,
            description: currentStep.description,
            showButtons: currentStep.requiresClick ? ["close"] : isLastStep ? ["close"] : ["next", "close"],
            onNextClick: () => {
              void saveProgress(step + 1, false);
              driverObj.destroy();
            },
          },
        },
      ],
    });

    driverRef.current = driverObj;
    driverObj.drive();

    let targetEl: Element | null = null;
    function handleTargetClick() {
      if (isLastStep) {
        void saveProgress(step, true);
      } else {
        void saveProgress(step + 1, false);
      }
    }
    if (currentStep.requiresClick && currentStep.target) {
      targetEl = document.querySelector(currentStep.target);
      targetEl?.addEventListener("click", handleTargetClick);
    }

    return () => {
      driverObj.destroy();
      targetEl?.removeEventListener("click", handleTargetClick);
    };
  }, [step, completed, dismissed, pathname]);

  return null;
}
