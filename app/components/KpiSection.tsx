"use client";

// غلاف اختيار المؤشرات. الاختيار يُحفظ محلياً (localStorage) لا في قاعدة
// البيانات - تفضيل عرض بحت، وبيوفّر نداءات/نقل بيانات بلا داعٍ.
// السيرفر يحسب كل المؤشرات مرة واحدة (نفس الاستعلام)، والعميل يعرض المختار
// فقط - فتغيير الاختيار فوري بلا أي طلب جديد.

import { useEffect, useState } from "react";
import { KpiStrip } from "@/app/components/KpiStrip";
import { DEFAULT_KPIS, type KpiKey, type KpiResult } from "@/lib/kpiEngine";

const STORAGE_KEY = "adloop-kpis";

export function KpiSection({
  all,
  currency,
  locale,
}: {
  all: KpiResult[];
  currency: string;
  locale: "ar" | "en";
}) {
  const [selected, setSelected] = useState<KpiKey[]>(DEFAULT_KPIS);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as KpiKey[];
        if (Array.isArray(parsed) && parsed.length >= 4) setSelected(parsed);
      }
    } catch { /* تفضيل عرض فقط - نتجاهل أي خطأ ونكمل بالافتراضي */ }
  }, []);

  function change(next: KpiKey[]) {
    setSelected(next);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
  }

  const byKey = new Map(all.map((r) => [r.key, r]));
  const results = selected.map((k) => byKey.get(k)).filter(Boolean) as KpiResult[];

  return <KpiStrip results={results} selected={selected} currency={currency} locale={locale} onChangeSelection={change} />;
}
