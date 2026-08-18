// app/api/workspaces/[id]/competitors/[competitorId]/ads/route.ts
//
// إعلان مرصود. `lastSeenAt` هو ما يجعل مدّة البقاء ذات معنى - لذلك
// "أكّد أنه ما زال يعمل" عملية أولى الدرجة لا تفصيلة.

import { NextRequest, NextResponse } from "next/server";
import { workspaceAccess } from "@/lib/workspaceAccess";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

const FORMATS = ["IMAGE", "VIDEO", "CAROUSEL", "TEXT"];
/** صورة الإعلان تُخزَّن كـdata URI - نفس نهج الصورة الشخصية، بحدّ صريح */
const MAX_IMAGE_CHARS = 1_400_000;
const MAX_ADS_PER_COMPETITOR = 200;

async function owned(req: NextRequest, workspaceId: string, competitorId: string) {
  const user = await getSessionUser(req);
  if (!user) return false;
  const row = await prisma.competitor.findFirst({
    where: { id: competitorId, workspaceId, workspace: workspaceAccess(user.id) },
    select: { id: true },
  });
  return !!row;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; competitorId: string }> }
) {
  const { id, competitorId } = await params;
  if (!(await owned(req, id, competitorId))) return NextResponse.json({ error: "not found" }, { status: 404 });

  const body = await req.json().catch(() => null);

  const count = await prisma.competitorAd.count({ where: { competitorId } });
  if (count >= MAX_ADS_PER_COMPETITOR) return NextResponse.json({ error: "limit reached" }, { status: 400 });

  const image = typeof body?.imageUrl === "string" ? body.imageUrl : null;
  if (image && image.length > MAX_IMAGE_CHARS) {
    return NextResponse.json({ error: "image too large" }, { status: 413 });
  }

  // تاريخ أوّل رصد يدوي: الإعلان قد يكون يعمل منذ شهر قبل أن تلاحظه،
  // وتثبيته على "اليوم" يمحو أهمّ إشارة في الصفحة.
  const firstSeen = parseDate(body?.firstSeenAt) ?? new Date();
  const now = new Date();

  const ad = await prisma.competitorAd.create({
    data: {
      competitorId,
      workspaceId: id,
      platform: typeof body?.platform === "string" ? body.platform.slice(0, 24) : "META_ADS",
      format: FORMATS.includes(body?.format) ? body.format : "IMAGE",
      headline: str(body?.headline, 200),
      body: str(body?.body, 2000),
      ctaLabel: str(body?.ctaLabel, 60),
      landingUrl: safeUrl(body?.landingUrl),
      sourceUrl: safeUrl(body?.sourceUrl),
      imageUrl: image,
      firstSeenAt: firstSeen > now ? now : firstSeen,
      lastSeenAt: now,
      tags: Array.isArray(body?.tags)
        ? body.tags.filter((t: unknown) => typeof t === "string").slice(0, 8).map((t: string) => t.slice(0, 24))
        : [],
    },
  });
  return NextResponse.json({ ad });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; competitorId: string }> }
) {
  const { id, competitorId } = await params;
  if (!(await owned(req, id, competitorId))) return NextResponse.json({ error: "not found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const adId = typeof body?.adId === "string" ? body.adId : "";
  if (!adId) return NextResponse.json({ error: "adId required" }, { status: 400 });

  const existing = await prisma.competitorAd.findFirst({
    where: { id: adId, competitorId },
    select: { id: true },
  });
  if (!existing) return NextResponse.json({ error: "not found" }, { status: 404 });

  const data: Record<string, unknown> = {};
  // "ما زال يعمل" = تأكيد رصد اليوم، فتمتدّ المدّة
  if (body?.confirmRunning === true) { data.lastSeenAt = new Date(); data.stillRunning = true; }
  if (body?.stillRunning === false) data.stillRunning = false;
  if (typeof body?.headline === "string") data.headline = body.headline.slice(0, 200);

  const ad = await prisma.competitorAd.update({ where: { id: adId }, data });
  return NextResponse.json({ ad });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; competitorId: string }> }
) {
  const { id, competitorId } = await params;
  if (!(await owned(req, id, competitorId))) return NextResponse.json({ error: "not found" }, { status: 404 });

  const adId = new URL(req.url).searchParams.get("adId");
  if (!adId) return NextResponse.json({ error: "adId required" }, { status: 400 });

  const existing = await prisma.competitorAd.findFirst({ where: { id: adId, competitorId }, select: { id: true } });
  if (!existing) return NextResponse.json({ error: "not found" }, { status: 404 });

  await prisma.competitorAd.delete({ where: { id: adId } });
  return NextResponse.json({ ok: true });
}

function str(v: unknown, max: number): string | null {
  return typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null;
}

function parseDate(v: unknown): Date | null {
  if (typeof v !== "string" || !v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function safeUrl(v: unknown): string | null {
  if (typeof v !== "string" || !v.trim()) return null;
  try {
    const u = new URL(v.trim().startsWith("http") ? v.trim() : `https://${v.trim()}`);
    return u.protocol === "http:" || u.protocol === "https:" ? u.toString().slice(0, 500) : null;
  } catch {
    return null;
  }
}
