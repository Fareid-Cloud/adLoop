// app/dashboard/integrations/mcp/page.tsx
//
// القسم انتقل إلى `/dashboard/mcp` حين صار قسماً مستقلّاً. والتحويل يبقى
// لأنّ الرابط القديم قد يكون نُسخ أو حُفظ بالفعل - وصفحةُ ٤٠٤ مكان قسمٍ
// موجود تُقرأ عطلاً لا نقلاً.

import { redirect } from "next/navigation";

export default function MovedMcpPage() {
  redirect("/dashboard/mcp");
}
