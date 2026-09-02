// app/api/workspaces/[id]/report-views/route.ts
//
// العروض المحفوظة: نحفظ *إعدادات* التقرير لا نتيجته. النتيجة تُحسب عند كل
// فتح من بيانات اليوم، وإلا صار العرض صورة قديمة تُتّخذ عليها قرارات جديدة.

import { NextRequest, NextResponse } from "next/server";
import { workspaceAccess, ownRowFilter } from "@/lib/workspaceAccess";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { METRICS } from "@/lib/reports/reportEngine";
import { logFeatureUse } from "@/lib/productTelemetry";

const VALID_METRICS = new Set<string>(METRICS.map((m) => m.key));
const VALID_SOURCES = ["REPORTED", "VERIFIED", "BOTH"];
const VALID_DIMENSIONS = ["none", "platform", "campaign", "creative", "day", "week", "month", "placement"];
const MAX_VIEWS = 50;

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const workspace = await prisma.workspace.findFirst({ where: { id, ...workspaceAccess(user.id) }, select: { id: true } });
  if (!workspace) return NextResponse.json({ error: "not found" }, { status: 404 });

  const views = await prisma.savedReportView.findMany({
    // المساحة اتفحصت فوق؛ وده فلترُ صاحبِ الرأي نفسه - الآراء
    // المحفوظة شخصيّة، فعضوٌ في المساحة مايشوفش ترتيبَ أعمدةِ غيره.
    where: { workspaceId: id, ...ownRowFilter(user.id) },
    orderBy: [{ isFavorite: "desc" }, { updatedAt: "desc" }],
    take: MAX_VIEWS,
  });
  return NextResponse.json({ views });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const workspace = await prisma.workspace.findFirst({ where: { id, ...workspaceAccess(user.id) }, select: { id: true } });
  if (!workspace) return NextResponse.json({ error: "not found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim().slice(0, 80) : "";
  if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });

  // لا نخزّن ما وصل كما هو: الإعدادات تُعاد بناؤها من قيم معروفة فقط، حتى
  // لا يتحوّل حقل Json إلى مدخل غير مفحوص يعود لاحقاً إلى الاستعلام.
  const raw = body?.config ?? {};
  const config = {
    source: VALID_SOURCES.includes(raw.source) ? raw.source : "VERIFIED",
    dimension: VALID_DIMENSIONS.includes(raw.dimension) ? raw.dimension : "platform",
    metrics: Array.isArray(raw.metrics) ? raw.metrics.filter((m: string) => VALID_METRICS.has(m)).slice(0, 20) : [],
    preset: typeof raw.preset === "string" ? raw.preset.slice(0, 24) : "last30",
    range: {
      from: typeof raw.range?.from === "string" ? raw.range.from.slice(0, 10) : "",
      to: typeof raw.range?.to === "string" ? raw.range.to.slice(0, 10) : "",
    },
    compareMode: typeof raw.compareMode === "string" ? raw.compareMode.slice(0, 20) : "previous",
    platforms: Array.isArray(raw.platforms) ? raw.platforms.filter((p: unknown) => typeof p === "string").slice(0, 10) : [],
  };

  // الحدُّ لكلّ صاحبِ رأي لا لكلّ مساحة: الآراء شخصيّة، وعدُّها
  // مساحيّاً كان هيخلّي عضواً يستهلك حدَّ غيره.
  const count = await prisma.savedReportView.count({ where: { workspaceId: id, ...ownRowFilter(user.id) } });
  if (count >= MAX_VIEWS) return NextResponse.json({ error: "limit reached" }, { status: 400 });

  const view = await prisma.savedReportView.create({
    data: { workspaceId: id, ...ownRowFilter(user.id), name, config },
  });
  logFeatureUse(user.id, "saved_view_created", id);
  return NextResponse.json({ view });
}
