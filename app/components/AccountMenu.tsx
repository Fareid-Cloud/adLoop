"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Settings, LogOut, CreditCard, Shield } from "lucide-react";

export function AccountMenu({
  name,
  email,
  avatarUrl,
  locale,
  isOwner = false,
}: {
  name: string | null;
  email: string;
  avatarUrl: string | null;
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

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-full py-1 pe-2.5 ps-1 transition-colors hover:bg-surface-raised"
      >
        {avatarUrl ? (
          <img src={avatarUrl} alt={display} className="h-7 w-7 rounded-full object-cover" />
        ) : (
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-accent/15 text-xs font-medium text-accent">
            {initial}
          </div>
        )}
        <span className="max-w-[120px] truncate text-[13px] text-text-muted">{display}</span>
        <ChevronDown size={14} className={`text-text-faint transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="pop-shadow absolute right-0 z-50 mt-2 w-56 rounded-xl card-shadow border border-border bg-surface p-1.5">
          <div className="border-b border-border px-3 pb-2 pt-1.5">
            <div className="truncate text-sm text-text-primary">{name ?? "—"}</div>
            <div className="truncate text-xs text-text-faint">{email}</div>
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
            <CreditCard size={15} /> {ar ? "الاشتراك والفوترة" : "Billing"}
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
