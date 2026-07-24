"use client";

// بحث سريع في الشريط العلوي (زي الصور) - يفلتر كل صفحات المنتج ويودّيك
// لأي حاجة مباشرة. لوحة أوامر مصغّرة.
import { useState, useRef, useEffect } from "react";
import { Search } from "lucide-react";
import { NAV_GROUPS } from "@/lib/navConfig";
import { PlatformLogo } from "@/app/components/PlatformLogo";

function plat(href: string): string | null {
  if (/google|youtube|pmax|shopping/.test(href)) return "GOOGLE_ADS";
  if (/meta|placements|catalog/.test(href)) return "META_ADS";
  if (/tiktok/.test(href)) return "TIKTOK_ADS";
  return null;
}

export function TopSearch({ locale }: { locale: "ar" | "en" }) {
  const ar = locale === "ar";
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const all = NAV_GROUPS.flatMap((g) =>
    g.items.flatMap((it) => [
      { href: it.href, text: ar ? it.labelAr : it.labelEn, platform: null as string | null },
      ...(it.children ?? []).map((c) => ({ href: c.href, text: ar ? c.labelAr : c.labelEn, platform: plat(c.href) })),
    ])
  );
  const query = q.trim().toLowerCase();
  const results = query ? all.filter((r) => r.text.toLowerCase().includes(query)).slice(0, 8) : [];

  return (
    <div ref={ref} className="relative w-full max-w-md">
      <Search size={15} className="pointer-events-none absolute inset-y-0 my-auto ms-3 text-text-faint" />
      <input
        value={q}
        onFocus={() => setOpen(true)}
        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        placeholder={ar ? "ابحث في الحملات والمصادر والمقاييس..." : "Search campaigns, sources, or metrics..."}
        className="w-full rounded-xl border border-border bg-surface py-2 ps-9 pe-14 text-[13px] text-text-primary placeholder:text-text-faint outline-none focus:border-accent"
      />
      <span className="pointer-events-none absolute inset-y-0 end-2.5 my-auto flex h-5 items-center rounded-md border border-border px-1.5 text-[10px] text-text-faint">⌘ K</span>

      {open && query && (
        <div className="pop-shadow absolute z-50 mt-2 w-full overflow-hidden rounded-xl border border-border bg-surface">
          {results.length === 0 ? (
            <div className="px-4 py-4 text-center text-[13px] text-text-faint">{ar ? "لا نتائج" : "No results"}</div>
          ) : (
            results.map((r) => (
              <a key={r.href} href={r.href} className="flex items-center gap-2.5 px-4 py-2.5 text-[13px] text-text-primary no-underline transition-colors hover:bg-surface-raised">
                {r.platform ? <PlatformLogo platform={r.platform} size={15} /> : <Search size={13} className="text-text-faint" />}
                {r.text}
              </a>
            ))
          )}
        </div>
      )}
    </div>
  );
}
