// app/dashboard/CreateWorkspaceForm.tsx
//
// أول حاجة أي مستخدم جديد هيشوفها - من غيرها مفيش أي طريقة يبدأ بيها.
// بتسأل أيضاً "بتدير كام عميل؟" مرة واحدة بس (على مستوى الحساب، مش لكل
// Workspace) - بتتحفظ في الملف الشخصي، ومفيدة لتخصيص الافتراضيات لاحقاً.

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const VERTICALS = [
  { value: "ecommerce", label: "تجارة إلكترونية" },
  { value: "recruitment", label: "توظيف" },
  { value: "clinic", label: "عيادة / خدمات طبية" },
  { value: "real_estate", label: "عقارات" },
  { value: "b2b", label: "B2B / خدمات احترافية" },
];

const BUSINESS_SCALES = [
  { value: "solo", label: "بيزنس شخصي (عميل واحد بس)" },
  { value: "1_5", label: "1 - 5 عملاء" },
  { value: "5_20", label: "5 - 20 عميل" },
  { value: "20_50", label: "20 - 50 عميل" },
  { value: "50_plus", label: "أكتر من 50 عميل" },
];

export function CreateWorkspaceForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [vertical, setVertical] = useState("");
  const [businessScale, setBusinessScale] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const [workspaceRes] = await Promise.all([
      fetch("/api/workspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, industryVertical: vertical || null }),
      }),
      // بيتحفظ مرة واحدة بس على مستوى الحساب - مش هيتسأل تاني مع أي
      // Workspace جديد يتعمل بعد كده
      businessScale
        ? fetch("/api/user/profile", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ businessScale }),
          })
        : Promise.resolve(null),
    ]);

    setLoading(false);

    if (!workspaceRes.ok) {
      const data = await workspaceRes.json();
      setError(data.error ?? "حصل خطأ، حاول تاني");
      return;
    }

    router.refresh(); // يعيد تحميل الصفحة كـ Server Component عشان يجيب الـ Workspace الجديد
  }

  return (
    <div className="mx-auto mt-20 max-w-md rounded-2xl bg-surface p-7">
      <h1 className="mb-1.5 text-xl font-semibold text-text-primary">ابدأ بإنشاء مساحة عمل</h1>
      <p className="mb-5 text-sm text-text-muted">
        تمثّل مساحة العمل عميلاً أو مشروعاً واحداً (مثل «adLoop»)، ويمكنك إنشاء
        أكثر من واحدة لاحقاً.
      </p>

      <form onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="اسم مساحة العمل (مثال: adLoop)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="mb-3 block w-full rounded-xl bg-surface-raised px-3 py-2.5 text-sm text-text-primary outline-none"
        />

        <select
          value={vertical}
          onChange={(e) => setVertical(e.target.value)}
          className="mb-3 block w-full rounded-xl bg-surface-raised px-3 py-2.5 text-sm text-text-primary outline-none"
        >
          <option value="">المجال (اختياري - بيحدد المقاييس الافتراضية)</option>
          {VERTICALS.map((v) => (
            <option key={v.value} value={v.value}>
              {v.label}
            </option>
          ))}
        </select>

        <select
          value={businessScale}
          onChange={(e) => setBusinessScale(e.target.value)}
          className="mb-4 block w-full rounded-xl bg-surface-raised px-3 py-2.5 text-sm text-text-primary outline-none"
        >
          <option value="">بتدير كام عميل؟ (اختياري)</option>
          {BUSINESS_SCALES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>

        {error && <p className="mb-3 text-xs text-critical">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-accent py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          {loading ? "جارٍ الإنشاء..." : "إنشاء مساحة العمل"}
        </button>
      </form>
    </div>
  );
}
