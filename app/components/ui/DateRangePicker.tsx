"use client";

// app/components/ui/DateRangePicker.tsx
//
// منتقي الفترة الموحّد لكل المنتج. كانت كل صفحة تثبّت ٣٠ يوماً في الكود،
// فلم يكن المستخدم يستطيع سؤال "وماذا عن الأسبوع الماضي؟" في أي مكان.
//
// الاختيار يُكتب في الـURL لا في الحالة وحدها، حتى يبقى الرابط قابلاً
// للمشاركة والحفظ ولا يضيع عند إعادة التحميل.

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CalendarDays, ChevronLeft, ChevronRight, Check } from "lucide-react";
import {
  MORE_PRESETS, QUICK_PRESETS, addDays, daysBetween, fromISODate,
  resolveCompare, resolvePreset, toISODate,
  type CompareMode, type DateRange, type PresetKey,
} from "@/lib/dateRange";
import { t, type Locale } from "@/lib/i18n/dictionary";

const COMPARE_MODES: CompareMode[] = ["previous", "sameWeekday", "previousYear", "custom"];

export function DateRangePicker({
  locale = "ar",
  range,
  compare,
  preset,
  compareMode = "none",
  allowCompare = true,
  onApply,
}: {
  locale?: Locale;
  range: DateRange;
  compare: DateRange | null;
  preset: PresetKey;
  compareMode?: CompareMode;
  allowCompare?: boolean;
  /** حين تُمرَّر، يتولّى النداء الحفظ؛ وإلا يُكتب الاختيار في الـURL */
  onApply?: (next: { preset: PresetKey; range: DateRange; compareMode: CompareMode; compare: DateRange | null }) => void;
}) {
  const tr = (k: string, v?: Record<string, string | number>) => t(locale, `period.${k}`, v);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [open, setOpen] = useState(false);
  const [draftPreset, setDraftPreset] = useState<PresetKey>(preset);
  const [draft, setDraft] = useState<DateRange>(range);
  const [draftCmpMode, setDraftCmpMode] = useState<CompareMode>(compareMode);
  const [draftCmp, setDraftCmp] = useState<DateRange | null>(compare);
  const [cmpOn, setCmpOn] = useState(compare !== null);
  const [picking, setPicking] = useState<"main" | "compare">("main");
  const [anchor, setAnchor] = useState<string | null>(null);
  const [leftMonth, setLeftMonth] = useState(() => fromISODate(range.from));

  const boxRef = useRef<HTMLDivElement>(null);

  // إغلاق باللمس خارج اللوحة وبمفتاح الهروب - لوحة بهذا الحجم تحجب
  // الصفحة، فيجب أن يكون الخروج منها بلا تفكير.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    if (open) {
      setDraftPreset(preset);
      setDraft(range);
      setDraftCmpMode(compareMode);
      setDraftCmp(compare);
      setCmpOn(compare !== null);
      setPicking("main");
      setAnchor(null);
      setLeftMonth(fromISODate(range.from));
    }
  }, [open]);

  const fmt = (d: string) =>
    fromISODate(d).toLocaleDateString(locale === "en" ? "en-GB" : "ar-EG", {
      day: "numeric", month: "short", year: "numeric",
    });

  function pickPreset(p: PresetKey) {
    const r = resolvePreset(p);
    setDraftPreset(p);
    setDraft(r);
    setLeftMonth(fromISODate(r.from));
    if (cmpOn && draftCmpMode !== "custom") setDraftCmp(resolveCompare(r, draftCmpMode));
  }

  function pickDay(iso: string) {
    const target = picking === "main" ? draft : draftCmp ?? draft;
    if (!anchor) {
      setAnchor(iso);
      const one = { from: iso, to: iso };
      picking === "main" ? setDraft(one) : setDraftCmp(one);
      if (picking === "main") setDraftPreset("custom");
      return;
    }
    const [from, to] = anchor <= iso ? [anchor, iso] : [iso, anchor];
    setAnchor(null);
    if (picking === "main") {
      setDraft({ from, to });
      setDraftPreset("custom");
      if (cmpOn && draftCmpMode !== "custom") setDraftCmp(resolveCompare({ from, to }, draftCmpMode));
    } else {
      setDraftCmp({ from, to });
      setDraftCmpMode("custom");
    }
    void target;
  }

  function apply() {
    const finalCmpMode: CompareMode = !cmpOn ? "none" : draftCmpMode;
    const finalCmp = !cmpOn ? null : draftCmpMode === "custom" ? draftCmp : resolveCompare(draft, draftCmpMode);

    if (onApply) {
      onApply({ preset: draftPreset, range: draft, compareMode: finalCmpMode, compare: finalCmp });
    } else {
      const q = new URLSearchParams(searchParams?.toString() ?? "");
      q.set("preset", draftPreset);
      if (draftPreset === "custom") {
        q.set("from", draft.from);
        q.set("to", draft.to);
      } else {
        q.delete("from");
        q.delete("to");
      }
      q.set("cmp", finalCmpMode);
      if (finalCmpMode === "custom" && finalCmp) {
        q.set("cmpFrom", finalCmp.from);
        q.set("cmpTo", finalCmp.to);
      } else {
        q.delete("cmpFrom");
        q.delete("cmpTo");
      }
      router.push(`${pathname}?${q.toString()}`);
    }
    setOpen(false);
  }

  const label = preset === "custom" ? `${fmt(range.from)} – ${fmt(range.to)}` : tr(`p_${preset}`);
  const Prev = locale === "en" ? ChevronLeft : ChevronRight;
  const Next = locale === "en" ? ChevronRight : ChevronLeft;

  return (
    <div className="relative" ref={boxRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 card px-3.5 py-2.5 text-[13px] text-text-primary"
      >
        <CalendarDays size={15} className="text-text-muted" />
        <span className="font-medium">{label}</span>
        {compare && (
          <span className="text-[11.5px] text-text-faint">
            {tr("vs")} {fmt(compare.from)} – {fmt(compare.to)}
          </span>
        )}
      </button>

      {open && (
        <div
          // ٧٢٠ بكسل معلَّقةً بحافة الزرّ تخرج من شاشة الهاتف مهما ضاق
          // العرض، لأنّ `94vw` تحدّد العرض ولا تحدّد أين يبدأ. تُثبَّت
          // بالشاشة تحت `sm`، وتعود مُعلَّقةً بالزرّ حيث المساحة تكفي.
          className="pop-shadow fixed inset-x-3 top-20 z-50 max-h-[80vh] overflow-y-auto card sm:absolute sm:inset-x-auto sm:top-auto sm:mt-2 sm:max-h-none sm:w-[min(94vw,720px)] sm:overflow-hidden sm:[inset-inline-end:0]"
        >
          <div className="flex flex-col sm:flex-row">
            {/* الاختصارات */}
            <div className="shrink-0 border-border p-3 sm:w-[168px] sm:border-e">
              <div className="mb-1 px-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-text-faint">
                {tr("quick")}
              </div>
              {QUICK_PRESETS.map((p) => (
                <PresetRow key={p} active={draftPreset === p} label={tr(`p_${p}`)} onClick={() => pickPreset(p)} />
              ))}
              <div className="mb-1 mt-3 px-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-text-faint">
                {tr("more")}
              </div>
              <div className="max-h-[210px] overflow-y-auto">
                {MORE_PRESETS.map((p) => (
                  <PresetRow key={p} active={draftPreset === p} label={tr(`p_${p}`)} onClick={() => pickPreset(p)} />
                ))}
              </div>
            </div>

            {/* التقويمان */}
            <div className="min-w-0 flex-1 p-3">
              {cmpOn && (
                <div className="card mb-2 flex gap-1 bg-surface-raised p-1">
                  <SegBtn active={picking === "main"} onClick={() => { setPicking("main"); setAnchor(null); }} label={tr("editMain")} />
                  <SegBtn active={picking === "compare"} onClick={() => { setPicking("compare"); setAnchor(null); }} label={tr("editCompare")} />
                </div>
              )}

              <div className="mb-2 flex items-center justify-between">
                <button
                  onClick={() => setLeftMonth(new Date(leftMonth.getFullYear(), leftMonth.getMonth() - 1, 1))}
                  className="rounded-lg p-1.5 text-text-muted hover:bg-surface-raised"
                  aria-label={tr("prevMonth")}
                >
                  <Prev size={16} />
                </button>
                <span className="text-[12.5px] font-medium text-text-primary">
                  {monthLabel(leftMonth, locale)} — {monthLabel(new Date(leftMonth.getFullYear(), leftMonth.getMonth() + 1, 1), locale)}
                </span>
                <button
                  onClick={() => setLeftMonth(new Date(leftMonth.getFullYear(), leftMonth.getMonth() + 1, 1))}
                  className="rounded-lg p-1.5 text-text-muted hover:bg-surface-raised"
                  aria-label={tr("nextMonth")}
                >
                  <Next size={16} />
                </button>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <Month
                  month={leftMonth}
                  locale={locale}
                  selection={picking === "main" ? draft : draftCmp}
                  secondary={picking === "main" ? draftCmp : draft}
                  anchor={anchor}
                  onPick={pickDay}
                />
                <Month
                  month={new Date(leftMonth.getFullYear(), leftMonth.getMonth() + 1, 1)}
                  locale={locale}
                  selection={picking === "main" ? draft : draftCmp}
                  secondary={picking === "main" ? draftCmp : draft}
                  anchor={anchor}
                  onPick={pickDay}
                />
              </div>
            </div>
          </div>

          {/* التذييل */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border p-3">
            <div className="flex flex-wrap items-center gap-2">
              {allowCompare && (
                <label className="flex cursor-pointer items-center gap-1.5 text-[12.5px] text-text-primary">
                  <span
                    className={`flex h-4 w-4 items-center justify-center rounded ${
                      cmpOn ? "bg-accent text-white" : "border border-border bg-surface"
                    }`}
                  >
                    {cmpOn && <Check size={11} />}
                  </span>
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={cmpOn}
                    onChange={(e) => {
                      setCmpOn(e.target.checked);
                      if (e.target.checked) setDraftCmp(resolveCompare(draft, draftCmpMode === "custom" ? "previous" : draftCmpMode));
                      else { setDraftCmp(null); setPicking("main"); }
                    }}
                  />
                  {tr("compare")}
                </label>
              )}

              {cmpOn && (
                <select
                  value={draftCmpMode}
                  onChange={(e) => {
                    const m = e.target.value as CompareMode;
                    setDraftCmpMode(m);
                    if (m !== "custom") setDraftCmp(resolveCompare(draft, m));
                  }}
                  className="field field-sm"
                >
                  {COMPARE_MODES.map((m) => (
                    <option key={m} value={m}>{tr(`cmp_${m}`)}</option>
                  ))}
                </select>
              )}

              <span className="text-[11.5px] text-text-faint">
                {tr("nDays", { n: daysBetween(draft.from, draft.to) })}
                {cmpOn && draftCmp && ` · ${fmt(draftCmp.from)} – ${fmt(draftCmp.to)}`}
              </span>
            </div>

            <div className="flex gap-2">
              <button onClick={() => setOpen(false)} className="card px-3.5 py-2 text-[12.5px] text-text-muted">
                {tr("cancel")}
              </button>
              <button onClick={apply} className="btn btn-primary">
                {tr("apply")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ==================== أجزاء ====================

function PresetRow({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-2 rounded-lg px-1.5 py-1.5 text-start text-[12.5px] ${
        active ? "bg-accent/10 text-accent" : "text-text-muted hover:bg-surface-raised hover:text-text-primary"
      }`}
    >
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${active ? "bg-accent" : "bg-border"}`} />
      {label}
    </button>
  );
}

function SegBtn({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 rounded-lg px-2 py-1.5 text-[12px] font-medium ${
        active ? "bg-surface text-text-primary shadow-sm" : "text-text-muted"
      }`}
    >
      {label}
    </button>
  );
}

function monthLabel(d: Date, locale: Locale): string {
  return d.toLocaleDateString(locale === "en" ? "en-GB" : "ar-EG", { month: "long", year: "numeric" });
}

function Month({
  month, locale, selection, secondary, anchor, onPick,
}: {
  month: Date;
  locale: Locale;
  selection: DateRange | null;
  secondary: DateRange | null;
  anchor: string | null;
  onPick: (iso: string) => void;
}) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const startPad = first.getDay(); // الأحد أوّل عمود - المعتاد في المنطقة
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const todayIso = toISODate(new Date());

  const cells = useMemo(() => {
    const out: (string | null)[] = Array(startPad).fill(null);
    for (let d = 1; d <= daysInMonth; d++) out.push(toISODate(new Date(month.getFullYear(), month.getMonth(), d)));
    while (out.length % 7 !== 0) out.push(null);
    return out;
  }, [month.getFullYear(), month.getMonth()]);

  const weekdays = useMemo(() => {
    const base = new Date(2024, 8, 1); // أحد
    return Array.from({ length: 7 }, (_, i) =>
      addDays(base, i).toLocaleDateString(locale === "en" ? "en-GB" : "ar-EG", { weekday: "narrow" })
    );
  }, [locale]);

  const inRange = (iso: string, r: DateRange | null) => !!r && iso >= r.from && iso <= r.to;
  const isEdge = (iso: string, r: DateRange | null) => !!r && (iso === r.from || iso === r.to);

  return (
    <div>
      <div className="mb-1 grid grid-cols-7 gap-0.5">
        {weekdays.map((w, i) => (
          <div key={i} className="text-center text-[10.5px] font-medium text-text-faint">{w}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {cells.map((iso, i) =>
          iso === null ? (
            <span key={i} />
          ) : (
            <button
              key={iso}
              onClick={() => onPick(iso)}
              className={`relative h-8 rounded-lg text-[12px] tabular-nums transition-colors ${
                isEdge(iso, selection) || iso === anchor
                  ? "bg-accent font-semibold text-white"
                  : inRange(iso, selection)
                    ? "bg-accent/12 text-accent"
                    : inRange(iso, secondary)
                      ? "bg-text-faint/12 text-text-muted"
                      : "text-text-primary hover:bg-surface-raised"
              }`}
            >
              {fromISODate(iso).getDate()}
              {iso === todayIso && (
                <span className="absolute inset-x-0 bottom-0.5 mx-auto h-0.5 w-3 rounded-full bg-current opacity-60" />
              )}
            </button>
          )
        )}
      </div>
    </div>
  );
}
