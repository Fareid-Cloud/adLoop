// app/dashboard/campaigns/competitor-ads/page.tsx
//
// السؤال: "منافسيني بيعملوا إعلانات إيه الآن؟" - الـ API البرمجي
// لمكتبة إعلانات ميتا مش شغال لسوقنا (مصر/الخليج برة نطاق تغطيته
// التجارية - اتأكدنا بالبحث)، فبدل تكامل آلي معطّل، ده رابط مباشر
// لموقع المكتبة نفسه (شغال لأي دولة، بدون أي مصادقة).

"use client";

import { useState } from "react";
import { ExternalLink } from "lucide-react";

const COUNTRIES = [
  { code: "EG", label: "مصر" },
  { code: "SA", label: "السعودية" },
  { code: "AE", label: "الإمارات" },
  { code: "KW", label: "الكويت" },
];

export default function CompetitorAdsPage() {
  const [brand, setBrand] = useState("");
  const [country, setCountry] = useState("EG");

  const url = brand
    ? `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=${country}&q=${encodeURIComponent(brand)}&media_type=all`
    : null;

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-2 text-[26px] font-semibold text-text-primary">إعلانات المنافسين</h1>
      <p className="mb-6 text-xs text-text-faint">
        رابط مباشر لمكتبة إعلانات ميتا العامة - يعرض كل إعلان يعمل حالياً
        لأي صفحة أو اسم تجاري، في أي دولة. ملاحظة صريحة: هذا يفتح موقع
        ميتا نفسه في تبويب جديد، وليست بيانات داخل AdLoop مباشرة - الواجهة
        البرمجية (API) غير متاحة لسوقنا حالياً، فهذه أدق طريقة متاحة فعلياً.
      </p>

      <div className="rounded-2xl bg-surface p-5">
        <input
          type="text"
          placeholder="اسم المنافس أو الصفحة (مثال: نايكي مصر)"
          value={brand}
          onChange={(e) => setBrand(e.target.value)}
          className="mb-3 w-full rounded-xl bg-surface-raised px-3 py-2.5 text-sm text-text-primary outline-none"
        />

        <div className="mb-4 flex gap-2">
          {COUNTRIES.map((c) => (
            <button
              key={c.code}
              onClick={() => setCountry(c.code)}
              className={`rounded-full px-3 py-1.5 text-xs ${
                country === c.code ? "bg-accent text-white" : "bg-surface-raised text-text-muted"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>

        {url ? (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-1.5 rounded-xl bg-accent py-2.5 text-sm text-white no-underline"
          >
            <ExternalLink size={15} />
            افتح إعلانات "{brand}" في {COUNTRIES.find((c) => c.code === country)?.label}
          </a>
        ) : (
          <div className="rounded-xl bg-surface-raised py-2.5 text-center text-sm text-text-faint">
            اكتب اسم المنافس الأول
          </div>
        )}
      </div>
    </div>
  );
}
