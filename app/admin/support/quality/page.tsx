// app/admin/support/quality/page.tsx - تقييمُ العملاء للدعم، مقسوماً على الفريق
//
// صفحةٌ جنب الصندوق لا تبويبٌ في التحليلات: السؤال («فريقي بيخدم إزاي؟»)
// بيتسأل وإنت في الصندوق، لا وإنت بتبصّ على الإيراد.
//
// الصلاحية: `analytics.product`. مش `analytics.financial` - ده أداءُ خدمة
// لا فلوس؛ ومش مفتوحٌ لأيّ أدمن كمان، لأنّ فيه أسماءَ موظّفين مقارنةً
// ببعضها وتعليقاتِ عملاء عليهم.

import Link from "next/link";
import { Star, ArrowLeft } from "lucide-react";
import { redirect } from "next/navigation";
import { getSessionUserFromCookies } from "@/lib/auth";
import { resolveAdminRole, adminCapabilities } from "@/lib/adminRole";
import { lastNDays } from "@/lib/admin/shared";
import { getSupportQuality, MIN_SAMPLE } from "@/lib/admin/supportQuality";
import { RATING_POSITIVE_FROM } from "@/lib/supportRating";
import { AdminPageHeader, Card, SectionTitle, Badge, shortDate } from "../../components/AdminUI";
import { TABLE, TABLE_WRAP, THEAD_ROW, TH, TR, TD, TD_MUTED } from "@/app/components/ui/tableStyles";

export const dynamic = "force-dynamic";

/** نصُّ الأسباب هنا إنجليزيٌّ ثابت: اللوحةُ للمالك وفريقه، لغتُها واحدة
 *  - غير واجهة العميل اللي بتيجي من القاموس بلغته. */
const REASON_LABEL: Record<string, string> = {
  slow: "Slow to reply",
  unresolved: "Didn't solve it",
  unclear: "Explanation unclear",
  repeat: "Had to repeat",
  fast: "Fast reply",
  resolved: "Solved it",
  clear: "Clear explanation",
  friendly: "Respectful service",
};

const DAYS = [7, 30, 90] as const;

export default async function SupportQualityPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  const sp = await searchParams;
  const days = (DAYS as readonly number[]).includes(Number(sp.days)) ? Number(sp.days) : 30;

  const user = await getSessionUserFromCookies();
  const caps = adminCapabilities(resolveAdminRole(user));
  if (!caps.includes("analytics.product")) redirect("/admin/support");

  const q = await getSupportQuality(lastNDays(days));
  const maxBar = Math.max(1, ...Object.values(q.distribution));

  return (
    <div>
      <AdminPageHeader
        title="Service quality"
        subtitle="What customers said about the support they got — split by who handled it"
        icon={Star}
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Link
          href="/admin/support"
          className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-[12.5px] text-text-muted no-underline transition-colors hover:bg-surface-raised hover:text-text-primary"
        >
          <ArrowLeft size={14} className="rtl:rotate-180" /> Inbox
        </Link>
        <span className="ms-auto flex items-center gap-1">
          {DAYS.map((d) => (
            <Link
              key={d}
              href={`/admin/support/quality?days=${d}`}
              className={`rounded-lg px-2.5 py-1 text-[12px] no-underline transition-colors ${
                days === d
                  ? "bg-critical/12 text-critical"
                  : "text-text-muted hover:bg-surface-raised hover:text-text-primary"
              }`}
            >
              {d}d
            </Link>
          ))}
        </span>
      </div>

      {q.asked === 0 ? (
        <Card>
          <p className="m-0 text-[13px] text-text-muted">
            No ratings yet in this period. Customers are asked once a conversation goes quiet for two
            hours after a reply, or as soon as it is marked Done.
          </p>
        </Card>
      ) : (
        <>
          {/* ═══ الأربعةُ الأساسية ═══ */}
          <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat
              label="Average score"
              value={q.avg === null ? "—" : q.avg.toFixed(1)}
              hint={`out of 5 · ${q.rated} rated`}
            />
            <Stat
              label="Satisfied"
              value={q.positivePct === null ? "—" : `${Math.round(q.positivePct)}%`}
              hint={`rated ${RATING_POSITIVE_FROM} or above`}
            />
            {/* نسبةُ الردّ بتقيس **الأداة** لا الفريق: لو قليلة، الأرقامُ
                اللي فوقها رأيُ أقلّيةٍ لا رأيَ العملاء. */}
            <Stat
              label="Response rate"
              value={`${Math.round(q.responsePct)}%`}
              hint={`${q.rated} of ${q.asked} asked`}
            />
            <Stat label="Dismissed" value={String(q.dismissed)} hint="chose “Not now”" />
          </div>

          <div className="mb-4 grid gap-3 lg:grid-cols-2">
            {/* ═══ التوزيع - المتوسّطُ وحده بيخبّي الاستقطاب ═══ */}
            <Card>
              <SectionTitle hint="An average of 3 can be everyone lukewarm, or half delighted and half angry — only the spread tells them apart.">
                Score spread
              </SectionTitle>
              <div className="mt-2 flex flex-col gap-1.5">
                {[5, 4, 3, 2, 1].map((n) => {
                  const v = q.distribution[n] ?? 0;
                  const tone = n >= RATING_POSITIVE_FROM ? "bg-success" : n === 3 ? "bg-warning" : "bg-critical";
                  return (
                    <div key={n} className="flex items-center gap-2">
                      <span className="w-3 shrink-0 text-[12px] tabular-nums text-text-muted">{n}</span>
                      <span className="h-2 flex-1 overflow-hidden rounded-full bg-surface-raised">
                        <span
                          className={`block h-full rounded-full ${tone}`}
                          style={{ width: `${(v / maxBar) * 100}%` }}
                        />
                      </span>
                      <span className="w-8 shrink-0 text-end text-[12px] tabular-nums text-text-faint">{v}</span>
                    </div>
                  );
                })}
              </div>
            </Card>

            {/* ═══ الأسباب - «إيه اللي بيتكرّر» ═══ */}
            <Card>
              <SectionTitle hint="Picked from a closed list, so the same complaint counts as the same complaint.">
                What customers pointed at
              </SectionTitle>
              {q.reasons.length === 0 ? (
                <p className="m-0 mt-2 text-[12.5px] text-text-faint">No reasons picked yet.</p>
              ) : (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {q.reasons.map((r) => (
                    <span
                      key={r.reason}
                      className="rounded-full border border-border-visible px-2.5 py-1 text-[11.5px] text-text-muted"
                    >
                      {REASON_LABEL[r.reason] ?? r.reason}
                      <span className="ms-1.5 tabular-nums text-text-faint">{r.n}</span>
                    </span>
                  ))}
                </div>
              )}
            </Card>
          </div>

          {/* ═══ الفريق ═══ */}
          <SectionTitle hint={`Fewer than ${MIN_SAMPLE} ratings is marked — one 5 is not a track record.`}>
            By who handled it
          </SectionTitle>
          <div className={TABLE_WRAP}>
            <table className={TABLE}>
              <thead>
                <tr className={THEAD_ROW}>
                  <th className={TH}>Agent</th>
                  <th className={TH}>Rated</th>
                  <th className={TH}>Average</th>
                  <th className={TH}>Satisfied</th>
                  <th className={TH}>Most mentioned</th>
                </tr>
              </thead>
              <tbody>
                {q.agents.map((a) => (
                  <tr key={a.agentId ?? "none"} className={TR}>
                    <td className={TD}>
                      {a.name}
                      {a.thin && (
                        <span className="ms-2">
                          <Badge tone="muted">low sample</Badge>
                        </span>
                      )}
                    </td>
                    <td className={TD_MUTED}>{a.rated}</td>
                    <td className={TD}>{a.avg.toFixed(1)}</td>
                    <td className={TD}>
                      <Badge tone={a.positivePct >= 80 ? "ok" : a.positivePct >= 60 ? "warn" : "bad"}>
                        {Math.round(a.positivePct)}%
                      </Badge>
                    </td>
                    <td className={TD_MUTED}>
                      {a.topReasons.length === 0
                        ? "—"
                        : a.topReasons.map((r) => `${REASON_LABEL[r.reason] ?? r.reason} (${r.n})`).join(" · ")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ═══ الكلامُ نفسه ═══
              الأرقامُ بتقول «فيه مشكلة»، والتعليقُ بيقول «هي إيه». */}
          {q.comments.length > 0 && (
            <div className="mt-5">
              <SectionTitle hint="Each one opens the conversation it came from.">
                In their words
              </SectionTitle>
              <div className="mt-2 flex flex-col gap-2">
                {q.comments.map((c) => (
                  <Link
                    key={c.id}
                    href={`/admin/support?thread=${c.threadId}`}
                    className="block rounded-xl border border-border bg-surface p-3 no-underline transition-colors hover:border-border-visible"
                  >
                    <div className="mb-1 flex flex-wrap items-center gap-2 text-[11.5px] text-text-faint">
                      <span
                        className={`grid size-5 place-items-center rounded-md text-[11px] tabular-nums text-white ${
                          (c.score ?? 0) >= RATING_POSITIVE_FROM
                            ? "bg-success"
                            : c.score === 3
                              ? "bg-warning"
                              : "bg-critical"
                        }`}
                      >
                        {c.score ?? "—"}
                      </span>
                      <span className="text-text-muted">{c.customer}</span>
                      <span>·</span>
                      <span>{c.agentName}</span>
                      <span className="ms-auto">{shortDate(c.createdAt)}</span>
                    </div>
                    <p className="m-0 text-[12.5px] text-text-primary">{c.comment}</p>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <Card>
      <p className="m-0 text-[11.5px] uppercase tracking-wider text-text-faint">{label}</p>
      <p className="m-0 mt-1 text-[26px] font-semibold tabular-nums leading-none text-text-primary">{value}</p>
      <p className="m-0 mt-1.5 text-[11.5px] text-text-muted">{hint}</p>
    </Card>
  );
}
