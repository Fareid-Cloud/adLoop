// app/dashboard/CreateWorkspaceForm.tsx
//
// أوّل ما يراه أي مستخدم جديد - بدونها لا سبيل للبدء أصلاً. تسأل أيضاً
// "كم عميلاً تدير؟" مرّة واحدة فقط (على مستوى الحساب لا لكل مساحة عمل)
// - تُحفظ في الملف الشخصي، وتفيد في تخصيص الافتراضيات لاحقاً.

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { t, type Locale } from "@/lib/i18n/dictionary";
import { Select } from "@/app/components/ui/Select";

const VERTICALS = [
  { value: "ecommerce", key: "vEcommerce" },
  { value: "recruitment", key: "vRecruitment" },
  { value: "clinic", key: "vClinic" },
  { value: "real_estate", key: "vRealEstate" },
  { value: "b2b", key: "vB2b" },
];

const BUSINESS_SCALES = [
  { value: "solo", key: "sSolo" },
  { value: "1_5", key: "s1_5" },
  { value: "5_20", key: "s5_20" },
  { value: "20_50", key: "s20_50" },
  { value: "50_plus", key: "s50_plus" },
];

export function CreateWorkspaceForm({ locale }: { locale: Locale }) {
  const tr = (k: string) => t(locale, `newWorkspace.${k}`);
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
      // يُحفظ مرّة واحدة على مستوى الحساب - لا يُسأل عنه مجدّداً مع أي
      // مساحة عمل جديدة تُنشأ بعد ذلك
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
      setError(data.error ?? tr("genericError"));
      return;
    }

    router.refresh(); // يعيد تحميل الصفحة كمكوّن خادم كي يجلب مساحة العمل الجديدة
  }

  return (
    <div className="card mx-auto mt-20 max-w-md p-7">
      <h1 className="mb-1.5 text-xl font-semibold text-text-primary">{tr("title")}</h1>
      <p className="mb-5 text-sm text-text-muted">
        {tr("intro")}
      </p>

      <form onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder={tr("namePlaceholder")}
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="field mb-3 w-full"
        />

        <Select
          locale={locale}
          value={vertical}
          onChange={setVertical}
          placeholder={tr("verticalPlaceholder")}
          ariaLabel={tr("verticalPlaceholder")}
          className="mb-3"
          options={VERTICALS.map((v) => ({ value: v.value, label: tr(v.key) }))}
        />

        <Select
          locale={locale}
          value={businessScale}
          onChange={setBusinessScale}
          placeholder={tr("scalePlaceholder")}
          ariaLabel={tr("scalePlaceholder")}
          className="mb-4"
          options={BUSINESS_SCALES.map((s) => ({ value: s.value, label: tr(s.key) }))}
        />

        {error && <p className="mb-3 text-xs text-critical">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="btn btn-primary btn-block"
        >
          {loading ? tr("creating") : tr("create")}
        </button>
      </form>
    </div>
  );
}
