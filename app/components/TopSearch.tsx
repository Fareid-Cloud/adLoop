"use client";

// بحث سريع في الشريط العلوي (زي الصور) - يفلتر كل صفحات المنتج ويودّيك
// لأي حاجة مباشرة. لوحة أوامر مصغّرة.
import { useState, useRef, useEffect } from "react";
import { Search } from "lucide-react";
import { NAV_GROUPS } from "@/lib/navConfig";
import { PlatformLogo } from "@/app/components/PlatformLogo";
import { t, type Locale } from "@/lib/i18n/dictionary";
import { searchSettingsEntries } from "@/lib/settingsSearchIndex";

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

  // 🔴 **«التسعير» مرّتين بلا ما يفرّق بينهما.** الاسم وحده لا يكفي حين
  // يتكرّر في موضعين - وهو يتكرّر: تسعيرُ منتجاتك داخل «متجري»، وصفحةُ
  // التسعير العامّة. السياق (اسمُ ما تندرج تحته) هو ما يجعل الاختيار ممكناً.
  const all = NAV_GROUPS.flatMap((g) =>
    g.items.flatMap((it) => [
      {
        href: it.href,
        text: ar ? it.labelAr : it.labelEn,
        context: (ar ? g.labelAr : g.labelEn) ?? null,
        platform: null as string | null,
      },
      ...(it.children ?? []).map((c) => ({
        href: c.href,
        text: ar ? c.labelAr : c.labelEn,
        // الأبُ لا المجموعة: «متجري ← التسعير» أدلّ من «تحليل ← التسعير».
        context: ar ? it.labelAr : it.labelEn,
        platform: plat(c.href),
      })),
    ])
  );
  const query = q.trim().toLowerCase();
  const pageResults = query ? all.filter((r) => r.text.toLowerCase().includes(query)).slice(0, 6) : [];

  // الإعدادات ليست صفحةً واحدة بل ثلاثون حقلاً في ثمانية تبويبات. البحث
  // عن «العملة» كان يقف عند عنوان الصفحة، فيُنزل الباحثَ عند أوّل تبويب
  // ويتركه يفتّش السبعة الباقية بنفسه.
  const settingsResults = query
    ? searchSettingsEntries(query, locale).slice(0, 5).map((r) => ({
        href: r.href,
        text: r.label,
        context: r.context,
        platform: null as string | null,
      }))
    : [];

  // ═══ ما في المساحة فعلاً: حملاتٌ ومنتجات ═══
  // الصفحات تُطابَق محلّياً فتظهر فوراً؛ وهذه رحلةُ شبكةٍ مؤجَّلة كي لا
  // يُستدعى الخادم مع كلّ حرف.
  const [hits, setHits] = useState<Array<{ kind: string; label: string; context: string | null; href: string; platform: string | null }>>([]);
  useEffect(() => {
    if (query.length < 2) { setHits([]); return; }
    const id = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(query)}`)
        .then((r) => r.json())
        .then((d) => setHits(Array.isArray(d.hits) ? d.hits : []))
        .catch(() => setHits([]));
    }, 220);
    return () => clearTimeout(id);
  }, [query]);

  const results = [
    ...pageResults.map((r) => ({ ...r, kind: "page" as const, label: r.text })),
    ...settingsResults.map((r) => ({ ...r, kind: "setting" as const, label: r.text })),
    ...hits,
  ];

  return (
    <div ref={ref} className="relative w-full max-w-md">
      <Search size={15} className="pointer-events-none absolute inset-y-0 my-auto ms-3 text-text-faint" />
      <input
        value={q}
        onFocus={() => setOpen(true)}
        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        placeholder={ar ? t(locale, "ui.searchPlaceholder") : "Search campaigns, sources, or metrics..."}
        className="field field-icon-start field-icon-end card-shadow w-full"
      />
      <span className="pointer-events-none absolute inset-y-0 end-2.5 my-auto flex h-5 items-center rounded-md border border-border px-1.5 text-[10px] text-text-faint">⌘ K</span>

      {open && query && (
        <div className="pop-shadow absolute z-50 mt-2 w-full overflow-hidden card">
          {results.length === 0 ? (
            <div className="px-4 py-4 text-center text-[13px] text-text-faint">{ar ? t(locale, "ui.noResults") : "No results"}</div>
          ) : (
            results.map((r) => (
              <a
                key={`${r.kind}:${r.href}`}
                href={r.href}
                className="flex w-full items-center gap-2.5 px-3.5 py-2.5 no-underline transition-colors hover:bg-surface-raised"
              >
                {r.platform ? (
                  <PlatformLogo platform={r.platform} size={15} />
                ) : (
                  <Search size={13} className="shrink-0 text-text-faint" />
                )}
                <span className="min-w-0 flex-1 truncate text-[13px] text-text-primary">{r.label}</span>
                {/* السياق على اليمين: يفصل المتشابهات بلا أن يزاحم الاسم */}
                {r.context && (
                  <span className="shrink-0 text-[11px] text-text-faint">{r.context}</span>
                )}
              </a>
            ))
          )}
        </div>
      )}
    </div>
  );
}
