"use client";

// مؤقّت واحد لكل الواجهة (بدل 3 مؤقتات منفصلة)، وبيتوقف تماماً لما التاب
// مش ظاهر. ده الإصلاح اللي بيقلّل نقل البيانات ~95%:
//   قبل: ~500 طلب/ساعة لكل تاب، بقوائم كاملة، حتى والتاب في الخلفية.
//   بعد: ~60 طلب/ساعة كحد أقصى، حمولة صغيرة (أعداد)، وصفر وقت الخمول.

import { createContext, useContext, useEffect, useRef, useState, useCallback, type ReactNode } from "react";

export interface LiveItem {
  id: string;
  type: "SUGGESTION" | "ALERT" | "ACCOUNT";
  severity: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  title: string;
  description: string | null;
  linkUrl: string | null;
  createdAt: string;
}

interface LiveState {
  unreadCount: number;
  supportUnread: number;
  fresh: LiveItem[];
  setUnreadCount: (n: number) => void;
  setSupportUnread: (n: number) => void;
  consumeFresh: (id: string) => void;
  refresh: () => void;
}

const Ctx = createContext<LiveState | null>(null);

const POLL_MS = 60_000; // دقيقة - كافية تماماً لتنبيهات غير لحظية

export function LiveDataProvider({ children }: { children: ReactNode }) {
  const [unreadCount, setUnreadCount] = useState(0);
  const [supportUnread, setSupportUnread] = useState(0);
  const [fresh, setFresh] = useState<LiveItem[]>([]);
  const lastCheck = useRef<string>(new Date().toISOString());

  const poll = useCallback(async () => {
    // لا نستهلك أي شيء والتاب مخفي - أكبر مصدر هدر كان هنا
    if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
    try {
      const res = await fetch(`/api/live?since=${encodeURIComponent(lastCheck.current)}`);
      if (!res.ok) return;
      const d = await res.json();
      setUnreadCount(d.unreadCount ?? 0);
      setSupportUnread(d.supportUnread ?? 0);
      if (Array.isArray(d.new) && d.new.length > 0) setFresh((p) => [...d.new, ...p].slice(0, 5));
      lastCheck.current = new Date().toISOString();
    } catch {
      /* تجاهل - المحاولة الجاية هتعوّض */
    }
  }, []);

  useEffect(() => {
    poll();
    const id = setInterval(poll, POLL_MS);
    // نفحص فوراً عند رجوع المستخدم للتاب (بدل انتظار الدورة)
    const onVis = () => { if (document.visibilityState === "visible") poll(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { clearInterval(id); document.removeEventListener("visibilitychange", onVis); };
  }, [poll]);

  const consumeFresh = useCallback((id: string) => setFresh((p) => p.filter((n) => n.id !== id)), []);

  return (
    <Ctx.Provider value={{ unreadCount, supportUnread, fresh, setUnreadCount, setSupportUnread, consumeFresh, refresh: poll }}>
      {children}
    </Ctx.Provider>
  );
}

export function useLive(): LiveState {
  const v = useContext(Ctx);
  if (!v) {
    return {
      unreadCount: 0, supportUnread: 0, fresh: [],
      setUnreadCount: () => {}, setSupportUnread: () => {}, consumeFresh: () => {}, refresh: () => {},
    };
  }
  return v;
}
