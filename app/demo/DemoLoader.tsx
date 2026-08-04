"use client";

// app/demo/DemoLoader.tsx
//
// شاشة تجهيز الديمو. تملأ الشاشة بالكامل من اللحظة الأولى - الشاشة
// السابقة الظاهرة خلف عملية تستغرق ثوانيَ تُقرأ كتعطّل لا كانتظار.

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FlaskConical, Loader2, AlertTriangle } from "lucide-react";
import { t, type Locale } from "@/lib/i18n/dictionary";

export function DemoLoader({ locale }: { locale: Locale }) {
  const tr = (k: string, v?: Record<string, string | number>) => t(locale, `demo.${k}`, v);
  const router = useRouter();
  const [failed, setFailed] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    // في وضع التطوير يُشغَّل التأثير مرّتين - بلا هذا الحارس يُستدعى
    // البذر مرّتين متزامنتين على نفس المستخدم
    if (started.current) return;
    started.current = true;

    (async () => {
      const res = await fetch("/api/demo", { method: "POST" }).catch(() => null);
      if (!res?.ok) { setFailed(true); return; }
      // replace لا push: الرجوع بزرّ المتصفّح يجب ألّا يُعيد التجهيز
      router.replace("/dashboard");
    })();
  }, [router]);

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center gap-4 bg-bg px-6 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gap/12 text-gap">
        <FlaskConical size={30} />
      </span>

      {failed ? (
        <>
          <AlertTriangle size={20} className="text-critical" />
          <p className="text-[14px] text-text-primary">{tr("failed")}</p>
          <button
            onClick={() => window.location.reload()}
            className="btn btn-primary"
          >
            {tr("retry")}
          </button>
        </>
      ) : (
        <>
          <h1 className="text-[20px] font-semibold text-text-primary">{tr("creating")}</h1>
          <p className="max-w-sm text-[13px] leading-relaxed text-text-muted">{tr("creatingBody")}</p>
          <Loader2 size={22} className="animate-spin text-accent" />
        </>
      )}
    </div>
  );
}
