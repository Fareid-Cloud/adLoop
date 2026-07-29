"use client";

// درج جانبي لتفاصيل التكامل - يُفتح من اليمين فوق الصفحة، لا صفحة جديدة.
//
// السبب ليس ذوقاً بصرياً: المستخدم يفحص التكاملات وهو يقارن بينها. نقله
// إلى صفحة مستقلّة يفقده السياق ويجبره على الرجوع بعد كل واحد. الدرج
// يُبقي القائمة خلفه فينتقل من تكامل لآخر بلا فقدان مكانه.

import { useEffect } from "react";
import {
  X, CheckCircle2, AlertTriangle, XCircle, Clock, Users, Shield,
  History, Unlink, RefreshCw, Loader2,
} from "lucide-react";
import { PlatformLogo } from "@/app/components/PlatformLogo";
import type { ActiveIntegration } from "@/lib/integrationsStatus";

const HEALTH_META = {
  HEALTHY: { label: "سليم", icon: CheckCircle2, className: "text-verified bg-verified/10 border-verified/30" },
  NEEDS_ATTENTION: { label: "يحتاج انتباهاً", icon: AlertTriangle, className: "text-gap bg-gap/10 border-gap/30" },
  BROKEN: { label: "متوقّف", icon: XCircle, className: "text-critical bg-critical/10 border-critical/30" },
} as const;

export function IntegrationDrawer({
  integration,
  onClose,
  onDisconnect,
  onSync,
  busy,
  error,
  relativeTime,
}: {
  integration: ActiveIntegration | null;
  onClose: () => void;
  onDisconnect: (key: string) => void;
  onSync: () => void;
  busy: string | null;
  error: string | null;
  relativeTime: (d: Date | string | null) => string;
}) {
  // إغلاق بمفتاح Escape - سلوك متوقَّع في أي درج، وغيابه يُشعر بأنه عالق
  useEffect(() => {
    if (!integration) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [integration, onClose]);

  if (!integration) return null;

  const health = HEALTH_META[integration.health];
  const HealthIcon = health.icon;

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* الطبقة الخلفية - الضغط عليها يغلق */}
      <div
        className="flex-1 bg-black/40 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden
      />

      <aside className="pop-shadow flex h-full w-full max-w-md flex-col border-s border-border bg-bg">
        {/* الرأس ثابت - يبقى اسم التكامل وزرّ الإغلاق ظاهرين أثناء التمرير */}
        <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <span
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
              style={{ background: `color-mix(in srgb, ${integration.color} 12%, transparent)` }}
            >
              {integration.platform ? (
                <PlatformLogo platform={integration.platform} size={20} />
              ) : (
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: integration.color }} />
              )}
            </span>
            <div className="min-w-0">
              <div className="truncate text-[15px] font-semibold text-text-primary">{integration.name}</div>
              <div className="text-[12px] text-text-muted">{integration.nameAr}</div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-text-muted transition-colors hover:bg-surface-2 hover:text-text-primary"
            aria-label="إغلاق"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {/* ==== الحالة ==== */}
          <Section title="الحالة" icon={HealthIcon}>
            <div className={`rounded-xl border px-3 py-2.5 ${health.className}`}>
              <div className="mb-1 flex items-center gap-1.5 text-[13px] font-semibold">
                <HealthIcon size={14} />
                {health.label}
              </div>
              <p className="text-[12px] leading-relaxed opacity-90">{integration.healthReason}</p>
            </div>
          </Section>

          {/* ==== الحسابات ==== */}
          <Section title={`الحسابات (${integration.accountCount})`} icon={Users}>
            {integration.accountNames.length === 0 ? (
              <p className="text-[12.5px] text-text-muted">
                لم تُختَر أي حملة بعد. اختر حملاتك حتى تبدأ المزامنة.
              </p>
            ) : (
              <div className="flex flex-col gap-1.5">
                {integration.accountNames.map((name) => (
                  <div
                    key={name}
                    className="rounded-lg border border-border bg-surface px-3 py-2 text-[12.5px] text-text-primary"
                  >
                    {name}
                  </div>
                ))}
              </div>
            )}
          </Section>

          {/* ==== آخر مزامنة ==== */}
          <Section title="آخر مزامنة" icon={Clock}>
            <div className="grid grid-cols-2 gap-2">
              <Fact label="آخر نجاح" value={relativeTime(integration.lastSyncAt)} />
              <Fact
                label="صفوف آخر ٧ أيام"
                value={integration.recordsLast7Days.toLocaleString("en-US")}
              />
              <Fact label="تاريخ الربط" value={relativeTime(integration.connectedAt)} />
              <Fact
                label="انتهاء الصلاحية"
                value={integration.expiresAt ? relativeTime(integration.expiresAt) : "لا تنتهي"}
              />
            </div>
          </Section>

          {/* ==== الصلاحيات ==== */}
          <Section title="الصلاحيات" icon={Shield}>
            <ul className="flex flex-col gap-1.5">
              {integration.permissions.map((p) => (
                <li key={p} className="flex items-start gap-2 text-[12.5px] leading-relaxed text-text-muted">
                  <CheckCircle2 size={13} className="mt-0.5 shrink-0 text-verified" />
                  {p}
                </li>
              ))}
            </ul>
          </Section>

          {/* ==== سجلّ المزامنة ==== */}
          <Section title="سجلّ المزامنة" icon={History}>
            {integration.recentRuns.length === 0 ? (
              <p className="text-[12.5px] leading-relaxed text-text-muted">
                لا توجد عمليات مزامنة مسجَّلة بعد. المتاجر تعمل بالويب هوك لا بالمزامنة الدورية، فلا
                يظهر لها سجلّ هنا.
              </p>
            ) : (
              <div className="flex flex-col">
                {integration.recentRuns.map((run) => (
                  <div
                    key={run.id}
                    className="flex items-start gap-2.5 border-b border-border/50 py-2 last:border-0"
                  >
                    <span
                      className={`mt-1 h-2 w-2 shrink-0 rounded-full ${
                        run.status === "SUCCESS"
                          ? "bg-verified"
                          : run.status === "FAILED"
                            ? "bg-critical"
                            : "bg-gap"
                      }`}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 text-[12px]">
                        <span className="font-medium text-text-primary">
                          {run.status === "SUCCESS" ? "نجحت" : run.status === "FAILED" ? "فشلت" : "قيد التشغيل"}
                        </span>
                        <span className="text-text-faint">{relativeTime(run.startedAt)}</span>
                        <span className="text-text-faint">
                          {run.trigger === "MANUAL" ? "يدوية" : "تلقائية"}
                        </span>
                        {run.durationMs !== null && (
                          <span className="text-text-faint tabular-nums">
                            {Math.round(run.durationMs / 100) / 10}ث
                          </span>
                        )}
                      </div>
                      {run.recordsWritten !== null && run.recordsWritten > 0 && (
                        <div className="text-[11.5px] text-text-faint">
                          {run.recordsWritten.toLocaleString("en-US")} صفّاً جديداً
                        </div>
                      )}
                      {run.errorMessage && (
                        <div className="mt-0.5 text-[11.5px] leading-relaxed text-critical">
                          {run.errorMessage}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Section>

          {error && (
            <div className="mb-4 rounded-xl border border-critical/30 bg-critical/10 px-3 py-2 text-[12.5px] text-critical">
              {error}
            </div>
          )}
        </div>

        {/* الإجراءات ثابتة أسفل الدرج - لا يبحث عنها المستخدم بالتمرير */}
        <div className="flex items-center gap-2 border-t border-border px-5 py-4">
          <button
            onClick={onSync}
            disabled={busy !== null}
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-2.5 text-[12.5px] font-medium text-text-primary transition-colors hover:bg-surface-2 disabled:opacity-60"
          >
            {busy === "sync" ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            مزامنة الآن
          </button>
          <button
            onClick={() => onDisconnect(integration.key)}
            disabled={busy !== null}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-critical/40 bg-critical/10 px-3 py-2.5 text-[12.5px] font-medium text-critical transition-colors hover:bg-critical/20 disabled:opacity-60"
          >
            {busy === "disconnect" ? <Loader2 size={14} className="animate-spin" /> : <Unlink size={14} />}
            فصل الربط
          </button>
        </div>
      </aside>
    </div>
  );
}

function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: typeof Users;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-5">
      <div className="mb-2 flex items-center gap-1.5 text-[12.5px] font-semibold text-text-muted">
        <Icon size={13} />
        {title}
      </div>
      {children}
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface px-3 py-2">
      <div className="text-[11.5px] text-text-faint">{label}</div>
      <div className="mt-0.5 text-[12.5px] font-medium text-text-primary">{value}</div>
    </div>
  );
}
