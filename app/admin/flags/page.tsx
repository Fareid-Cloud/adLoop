// app/admin/flags/page.tsx
//
// مفاتيح التشغيل العامة.
//
// **كل مفتاح هنا بيوقّف كود حقيقي.** القائمة مغلقة في `lib/featureFlags.ts`
// وكل مفتاح فيها متوصّل بموضع تنفيذ فعليّ - مفتاح بيتقفل وما بيوقّفش
// حاجة أسوأ من مفيش مفتاح، لأنّه بيدّي إحساس تحكّم في لحظة عطل.

import { Flag, Power } from "lucide-react";
import { listFeatureFlags } from "@/lib/featureFlags";
import { TABLE, TABLE_WRAP, THEAD_ROW, TH, TR, TD } from "@/app/components/ui/tableStyles";
import { AdminAction } from "../components/AdminAction";
import { AdminPageHeader, Badge } from "../components/AdminUI";

export const dynamic = "force-dynamic";

export default async function FlagsPage() {
  const flags = await listFeatureFlags();
  const off = flags.filter((f) => !f.enabled).length;

  return (
    <div>
      <AdminPageHeader
        title="Feature Flags"
        subtitle="Product-wide switches — independent of any plan or account"
        icon={Flag}
      />

      {off > 0 && (
        <div className="mb-4 rounded-2xl border border-critical/30 bg-critical/8 p-3 text-[12.5px] text-text-primary">
          <Power size={13} className="mb-0.5 me-1.5 inline text-critical" />
          {off} feature{off === 1 ? " is" : "s are"} currently switched off for every customer.
        </div>
      )}

      <div className={TABLE_WRAP}>
        <table className={TABLE}>
          <thead>
            <tr className={THEAD_ROW}>
              <th className={TH}>Feature</th>
              <th className={TH}>What it controls</th>
              <th className={TH}>State</th>
              <th className={TH}></th>
            </tr>
          </thead>
          <tbody>
            {flags.map((f) => (
              <tr key={f.key} className={TR}>
                <td className={TD}>
                  <div className="font-medium">{f.label}</div>
                  <div className="font-mono text-[11px] text-text-faint">{f.key}</div>
                </td>
                <td className={TD}>
                  <span className="text-[12px] leading-relaxed text-text-muted">{f.description}</span>
                </td>
                <td className={TD}>
                  <Badge tone={f.enabled ? "ok" : "bad"}>{f.enabled ? "on" : "off"}</Badge>
                </td>
                <td className={TD}>
                  <AdminAction
                    url={`/api/admin/flags/${encodeURIComponent(f.key)}`}
                    body={{ enabled: !f.enabled }}
                    label={f.enabled ? "Turn off" : "Turn on"}
                    confirmLabel={f.enabled ? "Off for everyone?" : "On for everyone?"}
                    tone={f.enabled ? "danger" : "default"}
                    size="sm"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-[11.5px] leading-relaxed text-text-faint">
        A flag that cannot be read anywhere is worse than no flag at all, so the list is fixed in code rather than
        free-form rows. If the database is unreachable, every flag falls back to <em>on</em> — a network blip must not
        silently disable half the product.
      </p>
    </div>
  );
}
