"use client";

// زر المساعدة (؟) جنب الإشعارات - بيفتح لوحة جانبية فيها مركز المساعدة
// كامل مع بحث. المحتوى من lib/helpContent.ts (نفس مصدر صفحة /dashboard/help).
import { useState } from "react";
import { HelpCircle, X, Search, ChevronDown } from "lucide-react";
import { HELP_SECTIONS, searchHelp, helpText, type HelpArticle } from "@/lib/helpContent";

export function HelpButton({ locale }: { locale: "ar" | "en" }) {
  const ar = locale === "ar";
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  const results = q.trim() ? searchHelp(q) : null;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex h-9 w-9 items-center justify-center rounded-full text-text-muted transition-colors hover:bg-surface-raised hover:text-text-primary"
        aria-label={ar ? "المساعدة" : "Help"}
        title={ar ? "المساعدة" : "Help"}
      >
        <HelpCircle size={18} strokeWidth={1.75} />
      </button>

      {open && (
        <div className="fixed inset-0 z-[9998] flex justify-end bg-black/30" onClick={() => setOpen(false)}>
          <div
            onClick={(e) => e.stopPropagation()}
            className="pop-shadow flex h-full w-full max-w-md flex-col border-s border-border bg-surface"
          >
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div>
                <div className="text-base font-semibold text-text-primary">{ar ? "مركز المساعدة" : "Help center"}</div>
                <div className="text-xs text-text-muted">{ar ? "إجابات عن أسئلتك حول AdLoop" : "Answers about AdLoop"}</div>
              </div>
              <button onClick={() => setOpen(false)} className="text-text-faint hover:text-text-primary" aria-label={ar ? "إغلاق" : "Close"}>
                <X size={18} />
              </button>
            </div>

            <div className="border-b border-border p-4">
              <div className="relative">
                <Search size={15} className="pointer-events-none absolute inset-y-0 my-auto ms-3 text-text-faint" />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder={ar ? "ابحث في المساعدة..." : "Search help..."}
                  className="card-shadow w-full rounded-xl border border-border bg-surface-raised py-2 ps-9 pe-3 text-[13px] text-text-primary placeholder:text-text-faint outline-none focus:border-accent"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {results ? (
                results.length === 0 ? (
                  <p className="py-6 text-center text-sm text-text-faint">{ar ? "لا نتائج" : "No results"}</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {results.map((a) => (
                      <Article key={a.id} a={a} locale={locale} open={openId === a.id} onToggle={() => setOpenId(openId === a.id ? null : a.id)} />
                    ))}
                  </div>
                )
              ) : (
                HELP_SECTIONS.map((s) => (
                  <div key={s.title.en} className="mb-5">
                    <div className="mb-2 text-[11px] font-medium uppercase tracking-wider text-text-faint">{helpText(locale, s.title)}</div>
                    <div className="flex flex-col gap-2">
                      {s.articles.map((a) => (
                        <Article key={a.id} a={a} locale={locale} open={openId === a.id} onToggle={() => setOpenId(openId === a.id ? null : a.id)} />
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="border-t border-border p-4 text-center text-xs text-text-muted">
              {ar ? "لم تجد إجابتك؟ استخدم زر المحادثة أسفل الشاشة." : "Still stuck? Use the chat button at the bottom."}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Article({
  a,
  open,
  onToggle,
  locale,
}: {
  a: HelpArticle;
  locale: "ar" | "en"; open: boolean; onToggle: () => void }) {
  return (
    <div className="card-shadow overflow-hidden rounded-xl border border-border bg-surface-raised">
      <button onClick={onToggle} className="flex w-full items-center justify-between gap-2 px-3.5 py-2.5 text-start text-[13.5px] font-medium text-text-primary">
        {helpText(locale, a.q)}
        <ChevronDown size={15} className={`shrink-0 text-text-faint transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <p className="border-t border-border px-3.5 py-3 text-[13px] leading-relaxed text-text-muted">{helpText(locale, a.a)}</p>}
    </div>
  );
}
