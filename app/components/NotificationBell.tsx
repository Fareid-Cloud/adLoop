// app/components/NotificationBell.tsx
//
// جرس الإشعارات - سجل دائم تراجعه وقت ما تحب. مختلف عمداً عن البوب-أب
// (NotificationToast) اللي بيظهر لحظياً وبيختفي - الجرس بيحتفظ بكل حاجة
// وبتفرّق بين المقروء وغير المقروء بلون واضح.

"use client";

import { useState, useEffect, useRef } from "react";
import { Bell, X } from "lucide-react";
import { useLive } from "@/app/components/LiveData";
import { t, type Locale } from "@/lib/i18n/dictionary";

interface Notification {
  id: string;
  type: "SUGGESTION" | "ALERT" | "ACCOUNT";
  severity: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  title: string;
  description: string | null;
  linkUrl: string | null;
  read: boolean;
  createdAt: string;
}

const SEVERITY_COLOR: Record<string, string> = {
  LOW: "bg-text-faint",
  MEDIUM: "bg-gap",
  HIGH: "bg-critical",
  URGENT: "bg-critical",
};

export function NotificationBell({ locale = "ar" }: { locale?: Locale }) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  async function loadNotifications() {
    const res = await fetch("/api/notifications");
    if (res.ok) {
      const data = await res.json();
      setNotifications(data.notifications);
      setUnreadCount(data.unreadCount);
    }
  }

  // العدّاد بييجي من المؤقّت الموحّد (LiveData). القائمة الكاملة بتتجاب
  // عند فتح الجرس فقط - مش كل 30 ثانية زي قبل كده.
  const live = useLive();
  useEffect(() => setUnreadCount(live.unreadCount), [live.unreadCount]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function handleOpen(notification: Notification) {
    if (!notification.read) {
      await fetch(`/api/notifications/${notification.id}`, { method: "PATCH" });
      setNotifications((prev) =>
        prev.map((n) => (n.id === notification.id ? { ...n, read: true } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    }
    if (notification.linkUrl) {
      window.location.href = notification.linkUrl;
    }
  }

  async function handleDelete(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    await fetch(`/api/notifications/${id}`, { method: "DELETE" });
    setNotifications((prev) => {
      const removed = prev.find((n) => n.id === id);
      if (removed && !removed.read) setUnreadCount((c) => Math.max(0, c - 1));
      return prev.filter((n) => n.id !== id);
    });
  }

  async function handleMarkAllRead() {
    await fetch("/api/notifications/mark-all-read", { method: "POST" });
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
  }

  // العلامة الحمرا بتتمسح فعلياً (محفوظة، مش بصرية بس) لما تدوس على
  // الجرس نفسه - مش لازم تفتح كل إشعار بمفرده عشان تختفي
  async function handleBellClick() {
    const nextOpen = !open;
    setOpen(nextOpen);
    // **الفتح ليس قراءة.** كان مجرّد فتح الجرس يعلّم كل الإشعارات مقروءة،
    // فتومض القائمة زرقاء لحظةً ثمّ تبيضّ كاملةً قبل أن يقرأ المستخدم
    // سطراً واحداً - ويفقد بذلك أثر ما لم يطّلع عليه بعد. كلٌّ يُقرأ
    // بالضغط عليه، و«تعليم الكلّ كمقروء» يبقى متاحاً كخيار صريح.
    if (nextOpen) await loadNotifications();
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={handleBellClick}
        className="relative flex h-9 w-9 items-center justify-center rounded-full text-text-muted hover:bg-surface-raised hover:text-text-primary"
        aria-label={t(locale, "notif.title")}
      >
        <Bell size={18} strokeWidth={1.75} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -end-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-critical px-1 text-[10px] font-medium text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div // 🔴 `end-0` يثبّت اللوحة بحافة *الزرّ* لا بحافة الشاشة، والجرس في
          // العربية يقع يسار الرأس - فتمتدّ اللوحة يساراً وتخرج من الشاشة.
          // على الموبايل تُثبَّت بالشاشة نفسها بهامش متساوٍ، وتعود مُعلَّقة
          // بالزرّ من `sm` فصاعداً حيث المساحة تكفي.
          className="pop-shadow fixed inset-x-4 top-16 z-50 max-h-[70vh] overflow-y-auto card sm:absolute sm:inset-x-auto sm:end-0 sm:top-11 sm:w-[min(20rem,calc(100vw-2rem))]">
          <div className="sticky top-0 flex items-center justify-between border-b border-border bg-surface px-4 py-3">
            <span className="text-sm font-semibold text-text-primary">{t(locale, "notif.title")}</span>
            {unreadCount > 0 && (
              <button onClick={handleMarkAllRead} className="text-xs text-accent">
                {t(locale, "notif.markAllRead")}
              </button>
            )}
          </div>

          {notifications.length === 0 ? (
            <div className="px-4 py-10 text-center text-xs text-text-faint">{t(locale, "notif.none")}</div>
          ) : (
            <div className="flex flex-col">
              {notifications.map((n) => (
                <div
                  key={n.id}
                  onClick={() => handleOpen(n)}
                  className={`group flex cursor-pointer items-start gap-2 border-b border-border px-4 py-3 hover:bg-surface-raised ${
                    n.read ? "bg-transparent" : "bg-accent/5"
                  }`}
                >
                  <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${n.read ? "bg-transparent" : SEVERITY_COLOR[n.severity]}`} />
                  <div className="flex-1 min-w-0">
                    <div className={`text-xs ${n.read ? "text-text-muted" : "font-medium text-text-primary"}`}>
                      {n.title}
                    </div>
                    {n.description && (
                      <div className="mt-0.5 text-[11px] text-text-faint line-clamp-2">{n.description}</div>
                    )}
                  </div>
                  <button
                    onClick={(e) => handleDelete(e, n.id)}
                    className="shrink-0 rounded-full p-1 text-text-faint opacity-0 hover:bg-surface hover:text-critical group-hover:opacity-100"
                    aria-label={t(locale, "notif.remove")}
                  >
                    <X size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
