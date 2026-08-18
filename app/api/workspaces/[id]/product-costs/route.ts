// app/api/workspaces/[id]/product-costs/route.ts
//
// تكلفة البضاعة: سحب من المتجر، أو تصدير/استيراد CSV.
//
// المساران موجودان لأن ثلاثاً من المنصات الخمس لا تُعرّض التكلفة إطلاقاً -
// فمن يستخدمها يحتاج طريقاً لا يمرّ بالمنصة، وإلا بقي قسم التسعير معطَّلاً.

import { NextRequest, NextResponse } from "next/server";
import { workspaceAccess } from "@/lib/workspaceAccess";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { syncCostsFromStore } from "@/lib/ecommerce/costSync";
import { applyCostImport, buildCostCsv } from "@/lib/ecommerce/costImport";

/** حدّ حجم الملف - ملف تكلفة لعشرة آلاف منتج أقلّ من هذا بكثير */
const MAX_CSV_BYTES = 2_000_000;

async function authorize(req: NextRequest, workspaceId: string) {
  const user = await getSessionUser(req);
  if (!user) return null;
  const workspace = await prisma.workspace.findFirst({
    where: { id: workspaceId, ...workspaceAccess(user.id) },
    select: { id: true },
  });
  return workspace ? user : null;
}

/** تصدير ملف جاهز للتعبئة */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!(await authorize(req, id))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const csv = await buildCostCsv(id);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="adloop-product-costs.csv"`,
    },
  });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!(await authorize(req, id))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const mode = body?.mode;

  if (mode === "sync") {
    const result = await syncCostsFromStore(id);
    return NextResponse.json(result);
  }

  if (mode === "import") {
    const csv = typeof body?.csv === "string" ? body.csv : "";
    if (!csv) return NextResponse.json({ error: "empty file" }, { status: 400 });
    if (csv.length > MAX_CSV_BYTES) {
      return NextResponse.json({ error: "file too large" }, { status: 413 });
    }
    const result = await applyCostImport(id, csv);
    return NextResponse.json(result);
  }

  return NextResponse.json({ error: "unknown mode" }, { status: 400 });
}
