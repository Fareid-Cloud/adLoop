// app/mcp/authorize/page.tsx
//
// نقطة التفويض: تتحقّق من الطلب، ثمّ تسأل المشترك.
//
// 🔴 **الموافقة صريحة، ولا تُصدَر شفرةٌ بلا ضغطة.** لو أصدرناها لمجرّد أنّ
// المستخدم مسجَّلُ الدخول، لكفى موقعاً خبيثاً أن يفتح هذا العنوان ليخرج
// بتوكنٍ يقرأ بيانات مساحته - وهو الهجوم الذي وُجدت شاشة الموافقة لأجله.

import { redirect } from "next/navigation";
import { getSessionUserFromCookies } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { findClient, redirectUriAllowed } from "@/lib/mcp/oauth";
import { ct, type ConsentLocale } from "@/lib/mcp/consentText";
import { workspaceAccess } from "@/lib/workspaceAccess";

export const dynamic = "force-dynamic";

function Problem({ locale, message }: { locale: ConsentLocale; message: string }) {
  return (
    <main dir={locale === "ar" ? "rtl" : "ltr"} className="mx-auto max-w-md px-5 py-16">
      <h1 className="mb-2 text-[18px] font-semibold text-text-primary">{ct(locale, "errTitle")}</h1>
      <p className="text-[13.5px] leading-6 text-text-muted">{message}</p>
    </main>
  );
}

export default async function AuthorizePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const one = (k: string): string => {
    const v = sp[k];
    return (Array.isArray(v) ? v[0] : v) ?? "";
  };

  const user = await getSessionUserFromCookies();
  if (!user) {
    // العودة إلى الطلب نفسه بعد الدخول - لا إلى اللوحة، وإلّا ضاع التفويض
    const params = new URLSearchParams();
    for (const k of Object.keys(sp)) params.set(k, one(k));
    redirect(`/login?next=${encodeURIComponent(`/mcp/authorize?${params.toString()}`)}`);
  }

  const locale: ConsentLocale = user.preferredLocale === "en" ? "en" : "ar";

  const clientId = one("client_id");
  const redirectUri = one("redirect_uri");
  const challenge = one("code_challenge");
  const method = one("code_challenge_method") || "S256";
  const state = one("state");

  if (!clientId || !redirectUri) return <Problem locale={locale} message={ct(locale, "errClient")} />;
  // PKCE إجباريّ في OAuth 2.1 - ولا استثناء لعميلٍ «موثوق»
  if (!challenge || method !== "S256") return <Problem locale={locale} message={ct(locale, "errParams")} />;

  const client = await findClient(clientId);
  if (!client) return <Problem locale={locale} message={ct(locale, "errClient")} />;
  if (!redirectUriAllowed(client.redirectUris, redirectUri)) {
    return <Problem locale={locale} message={ct(locale, "errRedirect")} />;
  }

  const workspace = await prisma.workspace.findFirst({
    where: { ...workspaceAccess(user.id) },
    select: { id: true, name: true },
    orderBy: { createdAt: "asc" },
  });
  if (!workspace) return <Problem locale={locale} message={ct(locale, "errNoWorkspace")} />;

  return (
    <main dir={locale === "ar" ? "rtl" : "ltr"} className="mx-auto max-w-md px-5 py-14">
      <h1 className="mb-3 text-[19px] font-semibold text-text-primary">{ct(locale, "title")}</h1>
      <p className="mb-5 text-[13.5px] leading-6 text-text-muted">
        {ct(locale, "intro", { client: client.clientName })}
      </p>

      <div className="card mb-5 p-4">
        <p className="mb-1 text-[11.5px] text-text-faint">{ct(locale, "workspaceLabel")}</p>
        <p className="text-[14px] font-medium text-text-primary">{workspace.name}</p>
      </div>

      <div className="card mb-5 p-4">
        <p className="mb-2 text-[12px] font-medium text-text-primary">{ct(locale, "scopeTitle")}</p>
        <ul className="space-y-1.5 text-[13px] leading-6 text-text-muted">
          <li>{ct(locale, "scopeRead")}</li>
          <li>{ct(locale, "scopeNoWrite")}</li>
        </ul>
      </div>

      <p className="mb-5 text-[12.5px] leading-6 text-text-muted">{ct(locale, "expiry")}</p>

      <form method="POST" action="/api/mcp/oauth/approve" className="flex gap-2.5">
        <input type="hidden" name="client_id" value={clientId} />
        <input type="hidden" name="redirect_uri" value={redirectUri} />
        <input type="hidden" name="code_challenge" value={challenge} />
        <input type="hidden" name="code_challenge_method" value={method} />
        <input type="hidden" name="state" value={state} />
        <input type="hidden" name="workspace_id" value={workspace.id} />
        <button type="submit" name="decision" value="approve" className="btn btn-primary flex-1">
          {ct(locale, "approve")}
        </button>
        <button type="submit" name="decision" value="deny" className="btn btn-secondary flex-1">
          {ct(locale, "deny")}
        </button>
      </form>

      <p className="mt-4 text-[12px] leading-6 text-text-faint">{ct(locale, "revokeHint")}</p>
    </main>
  );
}
