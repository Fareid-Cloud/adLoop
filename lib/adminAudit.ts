// lib/adminAudit.ts
//
// نقطة واحدة لتسجيل أي فعل قوي بيعمله الأدمن - قوة زي View As أو تعليق
// حساب لازم تيجي مع تسجيل، مش اختياري.

import { prisma } from "@/lib/prisma";

export async function logAdminAction(params: {
  adminUserId: string;
  action: string;
  targetUserId?: string;
  targetWorkspaceId?: string;
  details?: string;
}) {
  await prisma.adminAuditLog.create({
    data: {
      adminUserId: params.adminUserId,
      action: params.action,
      targetUserId: params.targetUserId,
      targetWorkspaceId: params.targetWorkspaceId,
      details: params.details,
    },
  });
}
