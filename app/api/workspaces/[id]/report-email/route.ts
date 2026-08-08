// app/api/workspaces/[id]/report-email/route.ts
//
// يُرسل التقرير بإعداداته الحالية إلى عنوان يكتبه المستخدم.
//
// التقرير يُعاد حسابه هنا من نفس الإعدادات لا يُستقبل من المتصفّح: إرسال
// أرقام جاءت من العميل يعني أن أي شخص يستطيع إرسال بريد بأرقام يخترعها.

import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { runReport, METRICS, type DataSource, type Dimension, type MetricKey } from "@/lib/reports/reportEngine";
import { periodFromParams } from "@/lib/dateRange";
import { t, platformLabel, type Locale } from "@/lib/i18n/dictionary";
import { renderEmail, EMAIL_BRAND } from "@/lib/emailTemplate";
import { getAppUrl } from "@/lib/appUrl";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const VALID_METRICS = new Set<string>(METRICS.map((m) => m.key));
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const workspace = await prisma.workspace.findFirst({ where: { id, userId: user.id } });
  if (!workspace) return NextResponse.json({ error: "not found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const to = typeof body?.email === "string" ? body.email.trim() : "";
  if (!EMAIL_RE.test(to) || to.length > 200) {
    return NextResponse.json({ error: "invalid email" }, { status: 400 });
  }

  if (!resend) {
    console.warn("RESEND_API_KEY غير مضبوط - تعذّر إرسال التقرير");
    return NextResponse.json({ error: "email not configured" }, { status: 503 });
  }

  const query = typeof body?.query === "string" ? body.query : "";
  const sp = new URLSearchParams(query.startsWith("?") ? query.slice(1) : query);
  const asRecord: Record<string, string> = {};
  sp.forEach((v, k) => { asRecord[k] = v; });

  const period = periodFromParams(asRecord);
  const locale: Locale = (user.preferredLocale as Locale) ?? "ar";
  const source = (["REPORTED", "VERIFIED", "BOTH"].includes(asRecord.src) ? asRecord.src : "VERIFIED") as DataSource;
  const dimension = (asRecord.dim ?? "platform") as Dimension;
  const metrics = (asRecord.m?.split(",").filter((m) => VALID_METRICS.has(m as MetricKey)) as MetricKey[]) ?? [
    "cost", "conversions", "cpa",
  ];

  const campaignLinks = await prisma.campaignLink.findMany({
    where: { workspaceId: id },
    select: { externalCampaignId: true, campaignName: true },
  });
  const campaignNames = new Map(
    campaignLinks.map((c: { externalCampaignId: string; campaignName: string }) => [c.externalCampaignId, c.campaignName])
  );

  const result = await runReport(
    id,
    {
      source,
      dimension,
      metrics: metrics.length ? metrics : (["cost", "conversions", "cpa"] as MetricKey[]),
      filters: { platforms: asRecord.pf ? asRecord.pf.split(",") : undefined },
      range: period.range,
      compare: period.compare,
    },
    { currency: workspace.currency, campaignNames }
  );

  const dir = locale === "ar" ? "rtl" : "ltr";
  const title = t(locale, "reports.title");
  const rows = result.rows
    .slice(0, 25)
    .map(
      (r) => `<tr>
        <td style="padding:8px 10px;border-bottom:1px solid #E5E7EB;">${escapeHtml(r.platform ? platformLabel(locale, r.platform) : r.label)}</td>
        ${metrics
          .map((m) => `<td style="padding:8px 10px;border-bottom:1px solid #E5E7EB;text-align:${locale === "ar" ? "left" : "right"};">${fmt(r.values[m])}</td>`)
          .join("")}
      </tr>`
    )
    .join("");

  // 🔴 الحكم لم يكن في البريد إطلاقاً: يصل جدولٌ من أرقام بلا الجملة التي
  // تلخّصه - وهي أوّل ما يُقرأ في الصفحة نفسها. مَن يفتح البريد على هاتفه
  // يريد النتيجة، لا أن يستخرجها من ستّة صفوف.
  const topVerdict = [...result.verdicts].sort(
    (a, b) => (b.financialImpact ?? 0) - (a.financialImpact ?? 0)
  )[0];

  const verdictHtml = topVerdict?.winnerLabel
    ? `<div style="border:1px solid ${EMAIL_BRAND.line};border-radius:12px;padding:16px 18px;">
        <div style="color:${EMAIL_BRAND.faint};font-size:11.5px;font-weight:600;text-transform:uppercase;letter-spacing:.04em;margin-bottom:6px;">${escapeHtml(t(locale, "reports.verdictTitle"))}</div>
        <div style="color:${EMAIL_BRAND.ink};font-size:17px;font-weight:600;line-height:1.5;">${escapeHtml(
          t(locale, "reports.verdictLead", {
            winner: topVerdict.winnerPlatform ? platformLabel(locale, topVerdict.winnerPlatform) : topVerdict.winnerLabel,
            pct: Math.round(topVerdict.differencePct ?? 0),
            metric: t(locale, `reports.m${topVerdict.metric[0].toUpperCase()}${topVerdict.metric.slice(1)}`),
          })
        )}</div>
        ${
          topVerdict.financialImpact && topVerdict.financialImpact > 0
            ? `<div style="margin-top:10px;color:${EMAIL_BRAND.muted};font-size:13px;">${escapeHtml(
                t(locale, topVerdict.impactKind === "saving" ? "reports.impactSaving" : "reports.impactGain")
              )}: <strong style="color:#16A34A;">${fmt(topVerdict.financialImpact)} ${escapeHtml(workspace.currency)}</strong></div>`
            : ""
        }
      </div>`
    : "";

  const summary = result.summary
    .map((line) => `<li style="margin-bottom:6px;">${escapeHtml(t(locale, `reports.${line.key}`, line.vars))}</li>`)
    .join("");

  await resend.emails.send({
    from: process.env.NOTIFICATION_FROM_EMAIL || "AdLoop <onboarding@resend.dev>",
    to,
    subject: sanitizeHeader(`[${workspace.name}] ${title} — ${period.range.from} → ${period.range.to}`),
    html: renderEmail({
      locale,
      art: "report",
      eyebrow: `${workspace.name} · ${period.range.from} → ${period.range.to}`,
      title,
      blocks: [
        ...(verdictHtml ? [{ html: verdictHtml }] : []),
        // الجدول markup جاهز - كلّ قيمة فيه مرّت بـ`escapeHtml` عند بنائها
        {
          html: `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
                        style="border-collapse:collapse;width:100%;font-size:13px;">
            <thead><tr>
              <th style="text-align:${dir === "rtl" ? "right" : "left"};padding:9px 10px;border-bottom:1px solid ${EMAIL_BRAND.line};color:${EMAIL_BRAND.faint};font-weight:600;font-size:11.5px;text-transform:uppercase;letter-spacing:.03em;">—</th>
              ${metrics
                .map(
                  (m) =>
                    `<th style="text-align:${dir === "rtl" ? "right" : "left"};padding:9px 10px;border-bottom:1px solid ${EMAIL_BRAND.line};color:${EMAIL_BRAND.faint};font-weight:600;font-size:11.5px;text-transform:uppercase;letter-spacing:.03em;">${escapeHtml(t(locale, `reports.m${m[0].toUpperCase()}${m.slice(1)}`))}</th>`
                )
                .join("")}
            </tr></thead>
            <tbody>${rows}</tbody>
          </table>`,
        },
        { heading: t(locale, "reports.summaryTitle") },
        {
          html: `<ul style="color:${EMAIL_BRAND.muted};font-size:13.5px;line-height:1.8;padding-inline-start:18px;margin:0;">${summary}</ul>`,
        },
        { text: t(locale, "reports.summaryNote") },
      ],
      cta: {
        label: locale === "ar" ? "افتح التقرير الكامل" : "Open the full report",
        url: `${getAppUrl()}/dashboard/reports`,
      },
      preferencesUrl: `${getAppUrl()}/dashboard/settings?tab=workspace`,
    }),
  });

  return NextResponse.json({ ok: true });
}

function fmt(v: number | null | undefined): string {
  if (v === null || v === undefined) return "—";
  return v.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** منع حقن هيدرات بريدية عبر أسطر جديدة في العنوان */
function sanitizeHeader(s: string): string {
  return s.replace(/[\r\n]+/g, " ").slice(0, 180);
}
