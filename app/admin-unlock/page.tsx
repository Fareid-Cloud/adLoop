// app/admin-unlock/page.tsx
//
// بوابة الدخول للوحة المالك.
//
// **ليه برّه `/admin` مش جوّاه:** لايوت اللوحة هو اللي بيفرض القفل، فأي
// صفحة تحته بتورث الفرض - وصفحة فتح القفل تحته معناها تحويلٌ إلى نفسها
// بلا نهاية. وضعها في مسار مستقلّ بيكسر الحلقة من أصلها بدل استثناءٍ
// مكتوب في اللايوت يسهل نسيانه عند أيّ تعديل.
//
// وبتعيد نفس فحوص اللايوت الثلاثة قبل ما تعرض النموذج: مش أدمن يتحوّل،
// معلَّق يتحوّل، وبلا تحقّق بخطوتين يروح يفعّله. الصفحة دي **مش** أضعف
// حلقة في السلسلة - هي نفس الباب بقفل زيادة.

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { ShieldCheck, ArrowLeft } from "lucide-react";
import { getSessionUserFromCookies } from "@/lib/auth";
import { resolveAdminRole } from "@/lib/adminRole";
import { ADMIN_UNLOCK_COOKIE, hasValidUnlockToken, UNLOCK_MINUTES } from "@/lib/adminElevation";
import { UnlockForm } from "./UnlockForm";

export const dynamic = "force-dynamic";

/** الوجهة لازم تكون داخل اللوحة: `next` بيجي من الرابط، وقبوله كما هو
 *  بيحوّل الصفحة لمُحوِّل مفتوح (open redirect) لأي موقع خارجي. */
function safeNext(raw: string | undefined): string {
  if (!raw) return "/admin";
  // مسار داخليّ فقط: يبدأ بـ`/admin` ولا يبدأ بـ`//` (اللي المتصفّح
  // بيقراه كنطاق خارجيّ بروتوكول نسبيّ).
  if (raw.startsWith("/admin") && !raw.startsWith("//")) return raw;
  return "/admin";
}

export default async function AdminUnlockPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const sp = await searchParams;
  const next = safeNext(sp.next);

  const user = await getSessionUserFromCookies();
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`);
  if (!resolveAdminRole(user)) redirect("/dashboard");
  if (user.isSuspended) redirect("/dashboard");
  if (!user.mfaEnabled) redirect("/dashboard/settings?tab=security&mfaRequired=1");

  // مفتوح بالفعل؟ مايتسألش تاني - الرجوع للوحة من زرار المتصفّح ما يستاهلش
  // كلمة سر جديدة ما دام القفل لسه صالحاً.
  const token = (await cookies()).get(ADMIN_UNLOCK_COOKIE)?.value;
  if (hasValidUnlockToken(token, user.id)) redirect(next);

  return (
    <main className="grid min-h-dvh place-items-center bg-surface px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <span className="mb-3 grid size-11 place-items-center rounded-2xl bg-critical/12 text-critical">
            <ShieldCheck size={22} />
          </span>
          <h1 className="text-xl font-semibold text-text-primary">Owner console</h1>
          <p className="mt-1 text-[13px] text-text-muted">
            Confirm it&apos;s you before opening the console. Being signed in is not enough.
          </p>
        </div>

        <UnlockForm next={next} minutes={UNLOCK_MINUTES} email={user.email} />

        {/* 🔴 **مخرجٌ من الشاشة دي.** القفلُ بيتطلّب كلمةَ سرّ أو كودَ
            تحقّق، ومَن مش ماسكٌ تليفونَه في اللحظة دي كان محبوساً: مافيش
            رابطٌ واحد يخرجه، والرجوعُ بزرّ المتصفّح بيرجّعه للقفل تاني. */}
        <a
          href="/dashboard"
          className="mt-4 inline-flex items-center gap-1.5 text-[12.5px] text-text-faint no-underline transition-colors hover:text-text-primary"
        >
          <ArrowLeft size={14} className="rtl:rotate-180" />
          Back to dashboard
        </a>
      </div>
    </main>
  );
}
