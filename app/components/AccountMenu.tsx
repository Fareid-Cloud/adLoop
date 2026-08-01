"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Settings, LogOut, CreditCard, Shield, Bot, Cpu, Sparkles, Terminal, Brain, Zap } from "lucide-react";

// نفس مفاتيح avatarIcon المحفوظة في قاعدة البيانات
const AVATAR_ICONS: Record<string, typeof Bot> = { bot: Bot, cpu: Cpu, sparkles: Sparkles, terminal: Terminal, brain: Brain, zap: Zap };

export function AccountMenu({
  name,
  email,
  avatarUrl,
  avatarIcon,
  locale,
  isOwner = false,
}: {
  name: string | null;
  email: string;
  avatarUrl: string | null;
  avatarIcon?: string | null;
  locale: "ar" | "en";
  isOwner?: boolean;
}) {
  const router = useRouter();
  const ar = locale === "ar";
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const display = name ?? email;
  const initial = display[0]?.toUpperCase() ?? "?";
  const AvatarIcon = avatarIcon ? (AVATAR_ICONS[avatarIcon] ?? null) : null;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-full py-1 pe-2.5 ps-1 transition-colors hover:bg-surface-raised"
      >
        {avatarUrl ? (
          <img src={avatarUrl} alt={display} className="h-7 w-7 rounded-full object-cover" />
        ) : (
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-accent/15 text-accent">
            {AvatarIcon ? <AvatarIcon size={15} /> : <span className="text-xs font-medium">{initial}</span>}
          </div>
        )}
        <span className="max-w-[120px] truncate text-[13px] text-text-muted" dir="auto">{display}</span>
        <ChevronDown size={14} className={`text-text-faint transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="pop-shadow absolute end-0 z-50 mt-2 w-56 rounded-xl card-shadow border border-border bg-surface p-1.5">
          <div className="border-b border-border px-3 pb-2 pt-1.5">
            <div className="truncate text-sm text-text-primary" dir="auto">{name ?? "—"}</div>
            <div className="truncate text-xs text-text-faint" dir="auto">{email}</div>
          </div>
          <a
            href="/dashboard/settings"
            className="mt-1 flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-text-primary no-underline transition-colors hover:bg-surface"
          >
            <Settings size={15} /> {ar ? "الإعدادات" : "Settings"}
          </a>
          <a
            href="/dashboard/billing"
            className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-text-primary no-underline transition-colors hover:bg-surface"
          >
            <CreditCard size={15} /> {ar ? "الاشتراك والباقة" : "Billing & Plan"}
          </a>
          {isOwner && (
            <a
              href="/admin"
              className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-accent no-underline transition-colors hover:bg-surface"
            >
              <Shield size={15} /> {ar ? "لوحة المالك" : "Admin panel"}
            </a>
          )}
          <button
            onClick={logout}
            className="mt-0.5 flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-critical transition-colors hover:bg-surface"
          >
            <LogOut size={15} /> {ar ? "تسجيل الخروج" : "Log out"}
          </button>
        </div>
      )}
    </div>
  );
}
