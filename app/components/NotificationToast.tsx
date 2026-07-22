// app/components/NotificationToast.tsx
//
// البوب-أب اللي بيظهر من تحت - لحظي وعابر، مختلف عمداً عن الجرس. ده
// لأي حاجة بتحصل "الآن وانت شغال": أتمتة اتنفذت، تحليل جديد جهز،
// نصيحة استراتيجية جديدة ظهرت. بيختفي تلقائياً، مش سجل دائم.

"use client";

import { useState, useEffect, useRef } from "react";
import { X, Zap, TrendingUp, Lightbulb } from "lucide-react";

// صوت تنبيه بسيط عبر Web Audio API - مفيش ملف صوتي خارجي، صوت "نغمة"
// قصيرة ولطيفة (نغمتين متتاليتين، زي معظم أنظمة الإشعارات المعروفة)
function playNotificationSound() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new AudioContextClass();

    function playTone(frequency: number, startTime: number, duration: number) {
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);
      oscillator.frequency.value = frequency;
      oscillator.type = "sine";
      gainNode.gain.setValueAtTime(0.15, startTime); // حجم صوت هادئ - إشعار مش إنذار
      gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
      oscillator.start(startTime);
      oscillator.stop(startTime + duration);
    }

    const now = ctx.currentTime;
    playTone(880, now, 0.12); // نغمة أولى
    playTone(1108, now + 0.1, 0.15); // نغمة تانية أعلى شوية - إحساس "تم" إيجابي
  } catch {
    // بعض المتصفحات بترفض تشغيل صوت من غير تفاعل مستخدم الأول - مش مشكلة
    // حرجة، الإشعار البصري (البوب-أب نفسه) لسه بيظهر عادي
  }
}

interface ToastNotification {
  id: string;
  type: "SUGGESTION" | "ALERT" | "ACCOUNT";
  severity: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  title: string;
  description: string | null;
  linkUrl: string | null;
  createdAt: string;
}

const TYPE_ICON: Record<string, typeof Zap> = {
  SUGGESTION: Lightbulb,
  ALERT: TrendingUp,
  ACCOUNT: Zap,
};

const AUTO_DISMISS_MS = 8000;

export function NotificationToast() {
  const [queue, setQueue] = useState<ToastNotification[]>([]);
  const lastCheckRef = useRef<string>(new Date().toISOString());

  useEffect(() => {
    async function poll() {
      const res = await fetch(`/api/notifications?since=${encodeURIComponent(lastCheckRef.current)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.notifications.length > 0) {
          setQueue((prev) => [...data.notifications, ...prev]);
          lastCheckRef.current = new Date().toISOString();
          playNotificationSound();
        }
      }
    }

    const interval = setInterval(poll, 15000);
    return () => clearInterval(interval);
  }, []);

  function dismiss(id: string) {
    setQueue((prev) => prev.filter((n) => n.id !== id));
  }

  useEffect(() => {
    if (queue.length === 0) return;
    const timer = setTimeout(() => dismiss(queue[0].id), AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [queue]);

  const current = queue[0];
  if (!current) return null;

  const Icon = TYPE_ICON[current.type];

  return (
    <div className="fixed bottom-6 left-1/2 z-50 w-full max-w-sm -translate-x-1/2 px-4">
      <div className="flex items-start gap-3 rounded-2xl border border-border bg-surface p-4 shadow-lg">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent">
          <Icon size={16} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium text-text-primary">{current.title}</div>
          {current.description && (
            <div className="mt-0.5 text-xs text-text-faint line-clamp-2">{current.description}</div>
          )}
          {current.linkUrl && (
            <a href={current.linkUrl} className="mt-1.5 inline-block text-xs text-accent no-underline">
              عرض التفاصيل ←
            </a>
          )}
        </div>
        <button
          onClick={() => dismiss(current.id)}
          className="shrink-0 rounded-full p-1 text-text-faint hover:bg-surface-raised hover:text-text-primary"
          aria-label="إغلاق"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
