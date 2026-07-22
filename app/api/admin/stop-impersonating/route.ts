// app/api/admin/stop-impersonating/route.ts

import { NextRequest, NextResponse } from "next/server";
import { createSessionToken } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const adminId = req.cookies.get("impersonating_by")?.value;
  if (!adminId) return NextResponse.json({ error: "not impersonating" }, { status: 400 });

  const adminToken = createSessionToken(adminId);

  const response = NextResponse.json({ success: true });
  response.cookies.set("session", adminToken, {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge: 60 * 60 * 24 * 30, path: "/",
  });
  response.cookies.delete("impersonating_by");

  return response;
}
