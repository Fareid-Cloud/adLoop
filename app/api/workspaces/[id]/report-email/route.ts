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
import { t, type Locale } from "@/lib/i18n/dictionary";

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
        <td style="padding:8px 10px;border-bottom:1px solid #E5E7EB;">${escapeHtml(r.label)}</td>
        ${metrics
          .map((m) => `<td style="padding:8px 10px;border-bottom:1px solid #E5E7EB;text-align:${locale === "ar" ? "left" : "right"};">${fmt(r.values[m])}</td>`)
          .join("")}
      </tr>`
    )
    .join("");

  const summary = result.summary
    .map((line) => `<li style="margin-bottom:6px;">${escapeHtml(t(locale, `reports.${line.key}`, line.vars))}</li>`)
    .join("");

  await resend.emails.send({
    from: process.env.NOTIFICATION_FROM_EMAIL || "AdLoop <onboarding@resend.dev>",
    to,
    subject: sanitizeHeader(`[${workspace.name}] ${title} — ${period.range.from} → ${period.range.to}`),
    html: `<div dir="${dir}" style="font-family:sans-serif;padding:20px;color:#171C27;">
      <h2 style="margin:0 0 4px;">${escapeHtml(title)}</h2>
      <p style="color:#5C6478;margin:0 0 16px;font-size:13px;">${escapeHtml(workspace.name)} · ${period.range.from} → ${period.range.to}</p>
      <table style="border-collapse:collapse;width:100%;font-size:13px;">
        <thead><tr>
          <th style="text-align:start;padding:8px 10px;border-bottom:2px solid #E5E7EB;">—</th>
          ${metrics.map((m) => `<th style="text-align:start;padding:8px 10px;border-bottom:2px solid #E5E7EB;">${escapeHtml(t(locale, `reports.m${m[0].toUpperCase()}${m.slice(1)}`))}</th>`).join("")}
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <h3 style="margin:20px 0 6px;font-size:14px;">${escapeHtml(t(locale, "reports.summaryTitle"))}</h3>
      <ul style="color:#5C6478;font-size:13px;padding-inline-start:18px;margin:0;">${summary}</ul>
      <p style="color:#9AA1B0;font-size:11px;margin-top:24px;">${escapeHtml(t(locale, "reports.summaryNote"))}</p>
    </div>`,
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
