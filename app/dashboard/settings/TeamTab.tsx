"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { TeamPanel } from "./TeamPanel";
import type { Locale } from "@/lib/i18n/dictionary";

/**
 * غلافُ تحميل لتبويب الفريق.
 *
 * البياناتُ بتتجاب عند فتح التبويب لا مع الصفحة: صفحةُ الإعدادات بتحمّل
 * تسع تبويبات، وجلبُ أعضاءِ كلّ مساحةٍ مع كلّ فتحةٍ للإعدادات استعلامان
 * زيادة لتبويبٍ أغلبُ الوقت مابيتفتحش.
 */
export function TeamTab({ workspaceId, locale }: { workspaceId: string; locale: Locale }) {
  const [data, setData] = useState<{
    members: Array<{ userId: string; name: string | null; email: string; role: string }>;
    invites: Array<{ id: string; email: string; role: string; expiresAt: string }>;
    seats: { viewer: number; operator: number };
  } | null>(null);

  useEffect(() => {
    let alive = true;
    fetch(`/api/workspaces/${workspaceId}/members`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (alive && d) setData(d); })
      .catch(() => {});
    return () => { alive = false; };
  }, [workspaceId]);

  if (!data) {
    return (
      <div className="card pad-lg flex items-center justify-center">
        <Loader2 size={16} className="animate-spin text-text-faint" />
      </div>
    );
  }

  return (
    <TeamPanel
      workspaceId={workspaceId}
      members={data.members}
      invites={data.invites}
      seats={data.seats}
      locale={locale}
    />
  );
}
