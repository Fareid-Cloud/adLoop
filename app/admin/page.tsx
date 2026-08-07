// app/admin/page.tsx

import { prisma } from "@/lib/prisma";
import { UserActions } from "./UserActions";
import { MetricCard } from "@/app/components/ui/MetricCard";
import { Users, Building2, Plug, AlertTriangle } from "lucide-react";
import { TH } from "@/app/components/ui/tableStyles";

const AT_RISK_DAYS = 14; // مفيش دخول من أسبوعين = مؤشر خطر، مش قرار نهائي

export default async function AdminDashboard() {
  const atRiskThreshold = new Date();
  atRiskThreshold.setDate(atRiskThreshold.getDate() - AT_RISK_DAYS);

  const [users, workspaces, connectedPlatforms, activeIssuesByWorkspace, recentFeedback, lastCronRun, recentAuditLog] =
    await Promise.all([
      prisma.user.findMany({
        orderBy: { createdAt: "desc" },
        select: {
          id: true, email: true, name: true, createdAt: true, isSuspended: true,
          aiRefreshMonthlyCount: true, businessScale: true, emailVerified: true, lastLoginAt: true,
        },
      }),
      prisma.workspace.findMany({
        include: { user: { select: { email: true } } },
        orderBy: { createdAt: "desc" },
      }),
      prisma.connectedPlatform.groupBy({ by: ["platform"], _count: true }),
      prisma.dailyTask.groupBy({
        by: ["workspaceId"],
        where: { completed: false },
        _count: true,
      }),
      prisma.feedback.findMany({
        orderBy: { createdAt: "desc" },
        take: 10,
        include: { user: { select: { email: true } } },
      }).catch(() => []),
      prisma.cronRunLog.findFirst({ orderBy: { runAt: "desc" } }).catch(() => null),
      prisma.adminAuditLog.findMany({ orderBy: { createdAt: "desc" }, take: 10 }).catch(() => []),
    ]);

  const issuesMap = new Map<string, number>(
    activeIssuesByWorkspace.map((i: any) => [i.workspaceId, i._count])
  );

  const atRiskUsers = users.filter(
    (u: any) => !u.lastLoginAt || u.lastLoginAt < atRiskThreshold
  );

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-text-primary">نظرة عامة على المنصة</h1>

      {/* ملخص سريع */}
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="إجمالي المشتركين" value={users.length} icon={Users} />
        <StatCard label="مساحات العمل" value={workspaces.length} icon={Building2} />
        <StatCard
          label="حسابات مربوطة"
          value={connectedPlatforms.reduce((s: number, p: any) => s + p._count, 0)}
          icon={Plug}
        />
        <StatCard
          label="عملاء في خطر"
          value={atRiskUsers.length}
          critical={atRiskUsers.length > 0}
          icon={AlertTriangle}
        />
      </div>

      <div className="mb-6 rounded-2xl bg-gap/10 p-4 text-xs text-gap">
        <strong>ملاحظة صريحة:</strong> بيانات الاشتراكات والمدفوعات غير متاحة هنا
        لأن نظام الدفع نفسه غير مبني بعد (مسجّل في README.md كفجوة MVP حرجة).
        كل حاجة تانية هنا (المشتركين، الحسابات، الاستهلاك، المشاكل) بيانات حقيقية.
      </div>

      {/* صحة النظام */}
      <SectionTitle>صحة النظام (آخر مزامنة يومية)</SectionTitle>
      <div className="card mb-6 p-4">
        {lastCronRun ? (
          <div className="flex items-center justify-between text-sm">
            <span className="text-text-primary">
              {new Date(lastCronRun.runAt).toLocaleString("ar")}
            </span>
            <span className={lastCronRun.failed > 0 ? "text-critical" : "text-verified"}>
              {lastCronRun.succeeded}/{lastCronRun.totalWorkspaces} نجحت
              {lastCronRun.failed > 0 && ` — ${lastCronRun.failed} فشلت`}
            </span>
            <span className="text-text-faint">
              {lastCronRun.durationMs ? `${Math.round(lastCronRun.durationMs / 1000)}ث` : "—"}
            </span>
          </div>
        ) : (
          <p className="text-xs text-text-faint">لا يوجد تشغيل مسجّل بعد — سيظهر بعد أول تشغيل للـ Cron.</p>
        )}
      </div>

      {/* المشتركين */}
      <SectionTitle>المشتركين</SectionTitle>
      <div className="card mb-6 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-start text-xs text-text-faint">
              <th className={TH}>البريد</th>
              <th className={TH}>مؤكد؟</th>
              <th className={TH}>آخر دخول</th>
              <th className={TH}>استهلاك AI</th>
              <th className={TH}>إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u: any) => {
              const isAtRisk = !u.lastLoginAt || u.lastLoginAt < atRiskThreshold;
              return (
                <tr key={u.id} className="border-b border-border text-text-primary last:border-0">
                  <td className="px-4 py-2.5">
                    {u.email} {u.isSuspended && <span className="text-critical">(معلّق)</span>}
                  </td>
                  <td className="px-4 py-2.5">{u.emailVerified ? "✓" : "✗"}</td>
                  <td className={`px-4 py-2.5 text-xs ${isAtRisk ? "text-gap" : "text-text-faint"}`}>
                    {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString("ar") : "لم يسجّل الدخول بعد"}
                  </td>
                  <td className="px-4 py-2.5 font-mono">{u.aiRefreshMonthlyCount}/120</td>
                  <td className="px-4 py-2.5">
                    <UserActions userId={u.id} isSuspended={u.isSuspended} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* مساحات العمل ومشاكلها */}
      <SectionTitle>مساحات العمل والمشاكل النشطة</SectionTitle>
      <div className="mb-6 flex flex-col gap-2">
        {workspaces.map((w: any) => {
          const issueCount = issuesMap.get(w.id) ?? 0;
          return (
            <div key={w.id} className="card flex items-center justify-between p-4">
              <div>
                <div className="text-sm text-text-primary">{w.name}</div>
                <div className="text-xs text-text-faint">{w.user.email} — {w.industryVertical ?? "غير محدد"}</div>
              </div>
              <span className={`font-mono text-sm ${issueCount > 0 ? "text-critical" : "text-verified"}`}>
                {issueCount} مشكلة نشطة
              </span>
            </div>
          );
        })}
      </div>

      {/* الفيدباك */}
      <SectionTitle>آخر الملاحظات من المستخدمين</SectionTitle>
      {recentFeedback.length === 0 ? (
        <p className="mb-6 text-sm text-text-faint">لا توجد ملاحظات بعد.</p>
      ) : (
        <div className="mb-6 flex flex-col gap-2">
          {recentFeedback.map((f: any) => (
            <div key={f.id} className="card p-4">
              <div className="mb-1 flex items-center justify-between">
                <span className="text-xs text-text-faint">{f.user.email}</span>
                <span className="text-xs text-text-faint">
                  {new Date(f.createdAt).toLocaleDateString("ar")}
                </span>
              </div>
              <p className="text-sm text-text-primary">{f.message}</p>
            </div>
          ))}
        </div>
      )}

      {/* سجل تدقيق الأدمن */}
      <SectionTitle>سجل تدقيق الأدمن (آخر 10)</SectionTitle>
      {recentAuditLog.length === 0 ? (
        <p className="text-sm text-text-faint">لا توجد إجراءات إدارية مسجّلة بعد.</p>
      ) : (
        <div className="flex flex-col gap-1">
          {recentAuditLog.map((log: any) => (
            <div key={log.id} className="card px-4 py-2 text-xs text-text-faint">
              {new Date(log.createdAt).toLocaleString("ar")} — {log.action} — {log.details}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// غلاف رفيع حول بطاقة المؤشّر الموحّدة - لوحة المالك تتبع نظام التصميم
// نفسه بدل نسخة مبسّطة تتباعد عنه
function StatCard({
  label,
  value,
  critical,
  icon,
}: {
  label: string;
  value: number;
  critical?: boolean;
  icon: typeof Users;
}) {
  return (
    <MetricCard
      label={label}
      value={value.toLocaleString("en-US")}
      icon={icon}
      tone={critical ? "critical" : "accent"}
    />
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-2 text-sm font-semibold text-text-primary">{children}</h2>;
}
