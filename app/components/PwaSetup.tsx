"use client";

// app/components/PwaSetup.tsx
//
// تسجيل الـService Worker وزرّ التثبيت.
//
// **ما كان معطّلاً:** الـSW كان يُسجَّل داخل `PushNotificationToggle` فقط،
// أي عند تفعيل الإشعارات وحده. ومن لا يفعّلها لا يُسجَّل عنده SW إطلاقاً،
// فلا يعرض المتصفّح خيار التثبيت أصلاً — شرط أساسي لتطبيق ويب قابل
// للتثبيت. التسجيل هنا يجعله يعمل لكلّ زائر.

import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";
import { t, type Locale } from "@/lib/i18n/dictionary";

/** الحدث غير قياسي بعد - Chromium وحده يطلقه، وتعريفه ليس في lib.dom */
interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "adloop_install_dismissed";

export function PwaSetup({ locale }: { locale: Locale }) {
  const [deferred, setDeferred] = useState<InstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    // بعد `load`: التسجيل أثناء التحميل يزاحم طلبات الصفحة الأولى على
    // نفس النطاق الترددي، فيؤخّر أوّل رسم على اتصال ضعيف.
    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch((err) => {
        console.warn("[pwa] تعذّر تسجيل Service Worker:", err);
      });
    };
    if (document.readyState === "complete") register();
    else {
      window.addEventListener("load", register);
      return () => window.removeEventListener("load", register);
    }
  }, []);

  useEffect(() => {
    // المتصفّح يطلق هذا الحدث حين تتحقّق شروط التثبيت. اعتراضه يمنع
    // شريط المتصفّح التلقائي، فنعرض دعوتنا في وقت نختاره بدل أن تظهر
    // فوق المحتوى في أوّل ثانية.
    const onPrompt = (e: Event) => {
      e.preventDefault();
      if (localStorage.getItem(DISMISS_KEY)) return;
      setDeferred(e as InstallPromptEvent);
      setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);

    // بعد التثبيت الفعلي لا معنى للدعوة
    const onInstalled = () => {
      setVisible(false);
      localStorage.setItem(DISMISS_KEY, "1");
    };
    window.addEventListener("appinstalled", onInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
    setVisible(false);
  }

  function dismiss() {
    // الرفض يُحفظ: تكرار الدعوة في كلّ زيارة إزعاج لا إقناع.
    localStorage.setItem(DISMISS_KEY, "1");
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 px-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
      <div className="card pad-sm pointer-events-auto mx-auto flex max-w-sm items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent/12 text-accent">
          <Download size={17} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-semibold text-text-primary">{t(locale, "pwa.installTitle")}</div>
          <div className="text-[11.5px] leading-relaxed text-text-muted">{t(locale, "pwa.installHint")}</div>
        </div>
        <button
          onClick={install}
          className="shrink-0 rounded-xl bg-accent px-3 py-2 text-[12.5px] font-medium text-white"
        >
          {t(locale, "pwa.installAction")}
        </button>
        <button
          onClick={dismiss}
          aria-label={t(locale, "pwa.installDismiss")}
          className="shrink-0 text-text-faint transition-colors hover:text-text-primary"
        >
          <X size={15} />
        </button>
      </div>
    </div>
  );
}
