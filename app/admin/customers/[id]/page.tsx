// app/admin/customers/[id]/page.tsx
//
// صفحة العميل الواحدة (Customer 360) - **كل ما يخصّ حساباً في شاشة واحدة**،
// لأنّ سؤال الدعم الحقيقي مابيجيش مقسوماً على صفحات: "الحساب ده مالوش
// بيانات، هو دافع؟ عنده كام مساحة؟ آخر مزامنة إمتى؟ كتب لنا قبل كده؟"
//
// الأفعال جنب البيانات اللي بتفسّرها مش في صفحة إعدادات منفصلة: قرار
// التمديد بيتاخد وأنت شايف تاريخ دفعه، مش بعد ما تنساه.

import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft, Ban, CheckCircle2, Eye, RefreshCw, Star, Building2, Plug, CreditCard,
  Gauge, LifeBuoy, ScrollText, Sparkles,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getSessionUserFromCookies } from "@/lib/auth";
import { resolveAdminRole, adminCapabilities } from "@/lib/adminRole";
import { getEntitlements } from "@/lib/entitlements";
import { PLANS } from "@/lib/plans";
import { getCustomerBilling } from "@/lib/admin/business";
import { getAccountUsage } from "@/lib/admin/usage";
import { AT_RISK_DAYS, atRiskThreshold } from "@/lib/admin/customers";
import { TABLE, TABLE_WRAP, THEAD_ROW, TH, TH_NUM, TR, TD, TD_NUM, TD_MUTED } from "@/app/components/ui/tableStyles";
import { AdminAction } from "../../components/AdminAction";
import { AdminPageHeader, Badge, Card, SectionTitle, money, shortDate, dateTime, ago, pct } from "../../components/AdminUI";
import { OverrideEditor, SubscriptionEditor, EmailComposer, NotesEditor } from "./CustomerEditors";

export const dynamic = "force-dynamic";

export default async function CustomerDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const admin = await getSessionUserFromCookies();
  const caps = adminCapabilities(resolveAdminRole(admin));
  const canMoney = caps.includes("analytics.financial");
  const canOverride = caps.includes("customers.override");
  const canSubscription = caps.includes("customers.subscription");
  const canEmail = caps.includes("customers.email");

  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true, email: true, name: true, companyName: true, username: true, country: true,
      businessScale: true, adSpendMonthly: true, howHeard: true, referralSource: true,
      createdAt: true, lastLoginAt: true, lastActiveAt: true, emailVerified: true,
      isSuspended: true, isVip: true, isAdmin: true, adminRole: true, mfaEnabled: true,
      preferredLocale: true, adminNotes: true, adminTags: true,
      subscriptionPlan: true, subscriptionStatus: true, currentPeriodEnd: true, cancelAtPeriodEnd: true,
      planLimitOverrides: true, featureOverrides: true,
      customPriceOverrideCents: true, customPriceCurrency: true, billingCountry: true,
      workspaces: {
        select: {
          id: true, name: true, currency: true, industryVertical: true, createdAt: true,
          _count: { select: { campaignLinks: true } },
        },
        orderBy: { createdAt: "asc" },
      },
      connectedPlatforms: { select: { id: true, platform: true, expiresAt: true, connectedAt: true } },
    },
  });
  if (!user) notFound();

  const [entitlements, billing, usage, threads, audit, emails, events, syncRuns] = await Promise.all([
    getEntitlements(id),
    canMoney ? getCustomerBilling(id) : Promise.resolve(null),
    getAccountUsage(id),
    prisma.supportThread.findMany({
      where: { OR: [{ userId: id }, { email: user.email }] },
      orderBy: { updatedAt: "desc" },
      take: 10,
      select: { id: true, subject: true, status: true, category: true, createdAt: true, closedAt: true },
    }),
    prisma.adminAuditLog.findMany({ where: { targetUserId: id }, orderBy: { createdAt: "desc" }, take: 15 }),
    prisma.adminEmailLog.findMany({ where: { userId: id }, orderBy: { sentAt: "desc" }, take: 10 }),
    prisma.subscriptionEvent.findMany({ where: { userId: id }, orderBy: { createdAt: "desc" }, take: 15 }),
    user.workspaces.length > 0
      ? prisma.syncRun.findMany({
          where: { workspaceId: { in: user.workspaces.map((w) => w.id) } },
          orderBy: { startedAt: "desc" },
          take: 8,
          select: { id: true, platform: true, status: true, startedAt: true, errorMessage: true, workspaceId: true },
        })
      : Promise.resolve([]),
  ]);

  const atRisk = !user.lastLoginAt || user.lastLoginAt < atRiskThreshold();
  // نفس القاعدة اللي بيطبّقها `/api/admin/impersonate` بالظبط: المالك
  // بيتعرّف ببريده مش بالحقل، فالواجهة لازم تسأل نفس السؤال - غير كده
  // بتعرض زرّ "View as" بيرجع 403، أو تخفي شارة الدور عن صاحب اللوحة.
  const targetRole = resolveAdminRole(user);
  const paidPlans = PLANS.filter((p) => p.key !== "free" && !p.contactOnly).map((p) => p.key);

  return (
    <div>
      <Link href="/admin/customers" className="mb-3 inline-flex items-center gap-1 text-[12.5px] text-text-muted no-underline hover:text-text-primary">
        <ArrowLeft size={13} /> All customers
      </Link>

      <AdminPageHeader
        title={user.name || user.email}
        subtitle={[user.email, user.companyName, user.country].filter(Boolean).join(" · ")}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <AdminAction
              url={`/api/admin/customers/${id}/vip`}
              label={user.isVip ? "Remove VIP" : "Mark VIP"}
              confirmLabel="Confirm?"
              icon="Star"
              size="sm"
            />
            <AdminAction
              url={`/api/admin/customers/${id}/resync`}
              label="Force re-sync"
              confirmLabel="Re-sync now?"
              icon="RefreshCw"
              size="sm"
              disabled={user.workspaces.length === 0}
            />
            {targetRole === null && (
              <AdminAction
                url="/api/admin/impersonate"
                body={{ targetUserId: id }}
                label="View as"
                confirmLabel="Enter account?"
                icon="Eye"
                tone="primary"
                size="sm"
                needsElevation
                onDoneRedirect="/dashboard"
              />
            )}
            <AdminAction
              url="/api/admin/suspend-user"
              body={{ targetUserId: id, suspend: !user.isSuspended }}
              label={user.isSuspended ? "Unsuspend" : "Suspend"}
              confirmLabel={user.isSuspended ? "Restore access?" : "Lock them out?"}
              icon={user.isSuspended ? "CheckCircle2" : "Ban"}
              tone={user.isSuspended ? "default" : "danger"}
              size="sm"
              needsElevation
            />
          </div>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-1.5">
        <Badge tone={user.subscriptionStatus === "ACTIVE" ? "ok" : user.subscriptionStatus === "PAST_DUE" ? "bad" : "muted"}>
          {entitlements.planKey} · {entitlements.state.toLowerCase()}
        </Badge>
        {user.isVip && <Badge tone="warn"><Star size={9} /> VIP</Badge>}
        {user.isSuspended && <Badge tone="bad">suspended</Badge>}
        {atRisk && <Badge tone="warn">no login in {AT_RISK_DAYS}d</Badge>}
        {!user.emailVerified && <Badge tone="warn">email unverified</Badge>}
        {user.mfaEnabled && <Badge tone="ok">2FA on</Badge>}
        {targetRole && <Badge tone="info">{targetRole}</Badge>}
        {user.adminTags.map((t) => <Badge key={t} tone="muted">{t}</Badge>)}
      </div>

      {/* ==================== ملخّص ==================== */}
      <div className="grid gap-3 lg:grid-cols-4">
        <Card>
          <SectionTitle>Account</SectionTitle>
          <Row label="Signed up" value={shortDate(user.createdAt)} />
          <Row label="Last login" value={user.lastLoginAt ? `${shortDate(user.lastLoginAt)} (${ago(user.lastLoginAt)})` : "never"} />
          <Row label="Last active" value={ago(user.lastActiveAt)} />
          <Row label="Locale" value={user.preferredLocale} />
          <Row label="Scale" value={user.businessScale ?? "—"} />
          <Row label="Heard via" value={user.howHeard ?? user.referralSource ?? "—"} />
        </Card>

        <Card>
          <SectionTitle>Subscription</SectionTitle>
          <Row label="Plan" value={user.subscriptionPlan ?? "free"} />
          <Row label="Status" value={user.subscriptionStatus} />
          <Row label="Renews / ends" value={shortDate(user.currentPeriodEnd)} />
          <Row label="Cancel at end" value={user.cancelAtPeriodEnd ? "yes" : "no"} />
          {user.customPriceOverrideCents && (
            <Row
              label="Custom price"
              value={`${(user.customPriceOverrideCents / 100).toLocaleString("en-US")} ${user.customPriceCurrency ?? "?"}/mo`}
            />
          )}
          {canMoney && billing && (
            <Row label="Lifetime paid" value={money(billing.lifetimeUsdCents)} />
          )}
        </Card>

        <Card>
          <SectionTitle>Footprint</SectionTitle>
          <Row label="Workspaces" value={String(user.workspaces.length)} />
          <Row label="Platform grants" value={String(user.connectedPlatforms.length)} />
          <Row label="Campaign links" value={String(user.workspaces.reduce((s, w) => s + w._count.campaignLinks, 0))} />
          <Row label="Support threads" value={String(threads.length)} />
        </Card>

        <Card>
          <SectionTitle>Usage this period</SectionTitle>
          {usage ? (
            <>
              <Row label="AI insights" value={String(usage.aiRefreshMonthly)} />
              <Row label="Image audits" value={String(usage.imageQualityMonthly)} />
              <Row label="Deep scans" value={`${usage.siteScanMonthly} / ${usage.deepScanAllowance}`} />
              <Row label="Credits bought" value={String(usage.creditsPurchased)} />
              <Row label="Managed spend" value={`$${usage.spendUsd.toLocaleString("en-US", { maximumFractionDigits: 0 })}`} />
              {usage.blockedAt && <Row label="Blocked at" value={shortDate(usage.blockedAt)} />}
            </>
          ) : (
            <p className="text-[12px] text-text-faint">No usage recorded.</p>
          )}
        </Card>
      </div>

      {/* ==================== الاستحقاقات الفعلية ==================== */}
      <SectionTitle hint="what getEntitlements() actually returns for this account right now">
        Effective entitlements
      </SectionTitle>
      <Card>
        <div className="grid gap-x-6 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
          {Object.entries(entitlements.limits).map(([k, v]) => (
            <Row key={k} label={k} value={String(v)} />
          ))}
        </div>
      </Card>

      {canOverride && (
        <>
          <SectionTitle hint="applies to this account only — the public catalogue is untouched">
            Overrides
          </SectionTitle>
          <Card>
            <OverrideEditor
              userId={id}
              limits={(user.planLimitOverrides as Record<string, number> | null) ?? null}
              features={(user.featureOverrides as Record<string, unknown> | null) ?? null}
              customPrice={
                user.customPriceOverrideCents
                  ? { amount: user.customPriceOverrideCents / 100, currency: user.customPriceCurrency ?? "EGP" }
                  : null
              }
              billingCountry={user.billingCountry}
            />
          </Card>
        </>
      )}

      {canSubscription && (
        <>
          <SectionTitle>Subscription actions</SectionTitle>
          <Card>
            <SubscriptionEditor userId={id} plans={paidPlans} currentPlan={user.subscriptionPlan} />
          </Card>
        </>
      )}

      {/* ==================== مساحات العمل ==================== */}
      <SectionTitle>Workspaces & connections</SectionTitle>
      {user.workspaces.length === 0 ? (
        <Card><p className="text-[12.5px] text-text-faint">This account has no workspaces yet.</p></Card>
      ) : (
        <div className={TABLE_WRAP}>
          <table className={TABLE}>
            <thead>
              <tr className={THEAD_ROW}>
                <th className={TH}><Building2 size={11} className="inline" /> Workspace</th>
                <th className={TH}>Currency</th>
                <th className={TH}>Vertical</th>
                <th className={TH_NUM}>Campaign links</th>
                <th className={TH}>Last sync</th>
                <th className={TH}></th>
              </tr>
            </thead>
            <tbody>
              {user.workspaces.map((w) => {
                const run = syncRuns.find((r) => r.workspaceId === w.id);
                return (
                  <tr key={w.id} className={TR}>
                    <td className={TD}>{w.name}</td>
                    <td className={TD}>{w.currency}</td>
                    <td className={TD_MUTED}>{w.industryVertical ?? "—"}</td>
                    <td className={TD_NUM}>{w._count.campaignLinks}</td>
                    <td className={TD_MUTED}>
                      {run ? (
                        <span className={run.status === "FAILED" ? "text-critical" : run.status === "RUNNING" ? "text-accent" : undefined}>
                          {run.status.toLowerCase()} · {ago(run.startedAt)}
                          {run.errorMessage && <div className="text-[11px] text-critical">{run.errorMessage}</div>}
                        </span>
                      ) : "never"}
                    </td>
                    <td className={TD}>
                      <AdminAction
                        url={`/api/admin/system/resync/${w.id}`}
                        label="Re-sync"
                        confirmLabel="Run now?"
                        icon="RefreshCw"
                        size="sm"
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {user.connectedPlatforms.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {user.connectedPlatforms.map((c) => {
            const expiring = c.expiresAt && c.expiresAt.getTime() - Date.now() < 7 * 86_400_000;
            return (
              <Badge key={c.id} tone={expiring ? "warn" : "muted"}>
                <Plug size={9} /> {c.platform}
                {c.expiresAt && ` · expires ${shortDate(c.expiresAt)}`}
              </Badge>
            );
          })}
        </div>
      )}

      {/* ==================== الفوترة ==================== */}
      {canMoney && billing && (
        <>
          <SectionTitle hint={`${billing.intents.length} most recent`}>
            <CreditCard size={11} className="inline" /> Billing history
          </SectionTitle>
          {billing.intents.length === 0 ? (
            <Card><p className="text-[12.5px] text-text-faint">No payment attempts recorded.</p></Card>
          ) : (
            <div className={TABLE_WRAP}>
              <table className={TABLE}>
                <thead>
                  <tr className={THEAD_ROW}>
                    <th className={TH}>Date</th>
                    <th className={TH}>Kind</th>
                    <th className={TH}>Plan / credits</th>
                    <th className={TH_NUM}>Amount</th>
                    <th className={TH}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {billing.intents.map((i) => (
                    <tr key={i.id} className={TR}>
                      <td className={TD_MUTED}>{shortDate(i.paidAt ?? i.createdAt)}</td>
                      <td className={TD}>{i.kind.toLowerCase()}</td>
                      <td className={TD}>{i.planKey ? `${i.planKey} (${i.cycle})` : `${i.credits} credits`}</td>
                      <td className={TD_NUM}>{money(i.amountCents, i.currency)}</td>
                      <td className={TD}>
                        <Badge tone={i.status === "PAID" ? "ok" : i.status === "FAILED" ? "bad" : "muted"}>
                          {i.status.toLowerCase()}
                        </Badge>
                        {i.failureReason && <div className="text-[11px] text-critical">{i.failureReason}</div>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* ==================== أحداث الاشتراك ==================== */}
      {events.length > 0 && (
        <>
          <SectionTitle>Subscription events</SectionTitle>
          <Card>
            <ul className="m-0 list-none space-y-1.5 p-0">
              {events.map((e) => (
                <li key={e.id} className="flex flex-wrap items-baseline gap-2 text-[12.5px]">
                  <Badge tone={e.actorAdminId ? "info" : "muted"}>{e.type.toLowerCase()}</Badge>
                  <span className="text-text-muted">
                    {e.fromPlan && e.toPlan && e.fromPlan !== e.toPlan ? `${e.fromPlan} → ${e.toPlan}` : e.toPlan ?? e.fromPlan ?? ""}
                  </span>
                  {e.actorAdminId && <span className="text-[11px] text-accent">manual</span>}
                  {e.note && <span className="text-[11.5px] text-text-faint">{e.note}</span>}
                  <span className="ms-auto text-[11px] text-text-faint">{dateTime(e.createdAt)}</span>
                </li>
              ))}
            </ul>
          </Card>
        </>
      )}

      {/* ==================== الاستهلاك مقابل المخصّص ==================== */}
      {usage && (
        <>
          <SectionTitle hint="metered per account, not per workspace — by design">
            <Gauge size={11} className="inline" /> Usage & limits
          </SectionTitle>
          <Card>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Meter label="AI credits" used={usage.aiRefreshMonthly} allowance={usage.creditAllowance} extra={usage.creditsPurchased} />
              <Meter label="Deep scans" used={usage.siteScanMonthly} allowance={usage.deepScanAllowance} />
              <Meter label="Image audits" used={usage.imageQualityMonthly} allowance={null} />
              <div>
                <div className="text-[11px] uppercase tracking-wide text-text-faint">Estimated model tokens</div>
                <div className="mt-0.5 text-lg font-semibold tabular-nums text-text-primary">
                  {(usage.estimatedTokens / 1000).toFixed(0)}k
                </div>
                <div className="text-[11px] text-text-faint">
                  {usage.estimatedCostUsd !== null
                    ? `~$${usage.estimatedCostUsd.toFixed(2)} at the configured rate`
                    : "set CLAUDE_COST_PER_MTOK_USD for a cost figure"}
                </div>
              </div>
            </div>
            {(usage.warnedAt || usage.blockedAt) && (
              <p className="mt-3 text-[12px] text-gap">
                {usage.blockedAt
                  ? `Sync was blocked on ${shortDate(usage.blockedAt)} for exceeding the plan cap.`
                  : `Warned on ${shortDate(usage.warnedAt)} at 80% of the plan cap.`}
              </p>
            )}
            {caps.includes("customers.override") && (
              <div className="mt-3">
                <AdminAction
                  url={`/api/admin/system/reset-limits/${id}`}
                  label="Reset AI counters"
                  confirmLabel="Give back the quota?"
                  icon="Sparkles"
                  size="sm"
                  needsElevation
                />
              </div>
            )}
          </Card>
        </>
      )}

      {/* ==================== الدعم ==================== */}
      <SectionTitle><LifeBuoy size={11} className="inline" /> Support history</SectionTitle>
      <Card>
        {threads.length === 0 ? (
          <p className="text-[12.5px] text-text-faint">This customer has never written in.</p>
        ) : (
          <ul className="m-0 list-none space-y-1.5 p-0">
            {threads.map((t) => (
              <li key={t.id} className="flex flex-wrap items-baseline gap-2 text-[12.5px]">
                <Badge tone={t.status === "CLOSED" ? "muted" : t.status === "OPEN" ? "warn" : "info"}>
                  {t.status.toLowerCase()}
                </Badge>
                <Link href={`/admin/support?thread=${t.id}`} className="text-text-primary no-underline hover:underline">
                  {t.subject}
                </Link>
                {t.category && <span className="text-[11px] text-text-faint">{t.category}</span>}
                <span className="ms-auto text-[11px] text-text-faint">{shortDate(t.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {canEmail && (
        <>
          <SectionTitle>Send an email</SectionTitle>
          <Card>
            <EmailComposer userId={id} email={user.email} />
            {emails.length > 0 && (
              <div className="mt-4 border-t border-border pt-3">
                <div className="mb-1.5 text-[11px] uppercase tracking-wide text-text-faint">Previously sent</div>
                <ul className="m-0 list-none space-y-1 p-0">
                  {emails.map((e) => (
                    <li key={e.id} className="flex items-baseline justify-between gap-2 text-[12px]">
                      <span className="truncate text-text-muted">{e.subject}</span>
                      <span className="shrink-0 text-[11px] text-text-faint">{shortDate(e.sentAt)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Card>
        </>
      )}

      {/* ==================== ملاحظات ==================== */}
      <SectionTitle>Internal notes</SectionTitle>
      <Card>
        <NotesEditor userId={id} notes={user.adminNotes} tags={user.adminTags} />
      </Card>

      {/* ==================== سجلّ التدقيق ==================== */}
      <SectionTitle><ScrollText size={11} className="inline" /> Admin actions on this account</SectionTitle>
      <Card>
        {audit.length === 0 ? (
          <p className="text-[12.5px] text-text-faint">Nothing has been done to this account from the panel.</p>
        ) : (
          <ul className="m-0 list-none space-y-1.5 p-0">
            {audit.map((a) => (
              <li key={a.id} className="text-[12px]">
                <span className="font-mono text-[10.5px] uppercase tracking-wide text-text-faint">{a.action}</span>
                <div className="text-text-muted">{a.details}</div>
                <div className="text-[10.5px] text-text-faint">{dateTime(a.createdAt)}</div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-0.5 text-[12.5px]">
      <span className="shrink-0 text-text-faint">{label}</span>
      <span className="truncate text-end text-text-primary" title={value}>{value}</span>
    </div>
  );
}

function Meter({
  label, used, allowance, extra,
}: {
  label: string; used: number; allowance: number | null; extra?: number;
}) {
  // -1 معناها بلا حدّ في كل فحوص الحدود - شريط نسبة مالوش معنى هنا،
  // فبنعرض العدد وبس بدل شريط دايماً فاضي.
  const unlimited = allowance === -1;
  const ratio = allowance && allowance > 0 ? Math.min(100, (used / allowance) * 100) : null;
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-text-faint">{label}</div>
      <div className="mt-0.5 text-lg font-semibold tabular-nums text-text-primary">
        {used}
        {!unlimited && allowance !== null && <span className="text-[12px] font-normal text-text-faint"> / {allowance}</span>}
        {unlimited && <span className="text-[12px] font-normal text-text-faint"> / ∞</span>}
      </div>
      {ratio !== null && (
        <div className="mt-1 h-1 w-full overflow-hidden rounded bg-surface-raised">
          <div
            className={`h-full ${ratio >= 90 ? "bg-critical" : ratio >= 70 ? "bg-gap" : "bg-verified"}`}
            style={{ width: `${ratio}%` }}
          />
        </div>
      )}
      {ratio !== null && <div className="mt-0.5 text-[10.5px] text-text-faint">{pct(ratio)} used</div>}
      {extra !== undefined && extra > 0 && (
        <div className="text-[10.5px] text-text-faint">+{extra} purchased</div>
      )}
    </div>
  );
}
