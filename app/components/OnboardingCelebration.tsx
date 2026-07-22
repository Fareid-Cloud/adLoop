"use client";

import { useState, useEffect } from "react";
import { PartyPopper } from "lucide-react";

// شاشة احتفالية بعد ما المستخدم يخلّص الجولة التعريفية كاملة - المستخدم
// طلب صراحة "جرافيك كده welcome to adLoop" مش بس بوب-أب عادي زي باقي الخطوات.
export function OnboardingCelebration({ show }: { show: boolean }) {
  const [visible, setVisible] = useState(show);

  useEffect(() => setVisible(show), [show]);

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="mx-4 flex max-w-sm flex-col items-center rounded-3xl bg-surface p-8 text-center shadow-2xl">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-accent/15 text-accent">
          <PartyPopper size={32} />
        </div>
        <h2 className="mb-2 text-2xl font-bold text-text-primary">أهلاً بيك في AdLoop!</h2>
        <p className="mb-6 text-sm text-text-muted">
          أنهيت الجولة التعريفية - أصبحت جاهزاً لإدارة حملاتك واتخاذ قرارات مبنية على أرقام حقيقية، لا مجرد تخمين.
        </p>
        <button
          onClick={() => setVisible(false)}
          className="rounded-full bg-accent px-6 py-2.5 text-sm font-medium text-white"
        >
          لنبدأ الآن
        </button>
      </div>
    </div>
  );
}
