"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Settings, LogOut, CreditCard, Shield, Bot, Cpu, Sparkles, Terminal, Brain, Zap } from "lucide-react";
import { t, type Locale } from "@/lib/i18n/dictionary";

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
        {/* الاسم يختفي تحت `sm` لا يُقصّ: رأس الهاتف يحمل ستّة عناصر في
            ٦٨ بكسل، و«Abdul-Rahman M. …» المقصوص لا يفيد أحداً بينما يأكل
            عرض البحث. وفوق `lg` يتّسع الحدّ لاسمٍ كامل بدل قصّه بلا داعٍ
            على شاشة فيها متّسع. */}
        <span className="hidden max-w-[130px] truncate text-[13px] text-text-muted sm:inline lg:max-w-[190px]" dir="auto">
          {display}
        </span>
        <ChevronDown size={14} className={`hidden text-text-faint transition-transform sm:block ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div // نفس علّة لوحة الإشعارات: التعليق بحافة الزرّ يخرج بالقائمة من
          // الشاشة في العربية. تُثبَّت بالشاشة على الموبايل فقط.
          className="pop-shadow fixed inset-x-4 top-16 z-50 card p-1.5 sm:absolute sm:inset-x-auto sm:end-0 sm:top-auto sm:mt-2 sm:w-56">
          <div className="border-b border-border px-3 pb-2 pt-1.5">
            <div className="truncate text-sm text-text-primary" dir="auto">{name ?? "—"}</div>
            <div className="truncate text-xs text-text-faint" dir="auto">{email}</div>
          </div>
          <a
            href="/dashboard/settings"
            className="mt-1 flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-text-primary no-underline transition-colors hover:bg-surface-raised"
          >
            <Settings size={15} /> {ar ? t(locale, "accountMenu.settings") : "Settings"}
          </a>
          <a
            href="/dashboard/billing"
            className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-text-primary no-underline transition-colors hover:bg-surface-raised"
          >
            <CreditCard size={15} /> {ar ? t(locale, "accountMenu.billing") : "Billing & Plan"}
          </a>
          {isOwner && (
            <a
              href="/admin"
              className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-accent no-underline transition-colors hover:bg-accent/10"
            >
              <Shield size={15} /> {ar ? t(locale, "accountMenu.owner") : "Admin panel"}
            </a>
          )}
          <button
            onClick={logout}
            className="mt-0.5 flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-critical transition-colors hover:bg-critical/10"
          >
            <LogOut size={15} /> {ar ? t(locale, "accountMenu.signOut") : "Log out"}
          </button>
        </div>
      )}
    </div>
  );
}
