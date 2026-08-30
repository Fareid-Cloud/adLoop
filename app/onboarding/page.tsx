// app/onboarding/page.tsx
//
// الأونبوردينج الإجباري: يظهر قبل القائمة الجانبية وقبل أي شيء آخر في
// البرنامج، ولا ينتهي إلا بربط منصة واختيار حملات فعلاً (أو تخطٍّ صريح).
// السبب: البرنامج بلا حساب مربوط لا يعرض شيئاً ذا معنى، فبدء المستخدم من
// لوحة فارغة كان يترك انطباعاً بأن المنتج لا يعمل.

import { redirect } from "next/navigation";
import { getSessionUserFromCookies } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getConnectStates } from "@/lib/connectionState";
import { OnboardingFlow } from "./OnboardingFlow";
import { getActiveWorkspace } from "@/lib/activeWorkspace";
import { t, type Locale } from "@/lib/i18n/dictionary";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const user = await getSessionUserFromCookies();
  if (!user) redirect("/login");

  let workspace = await getActiveWorkspace(user.id);

  // لا يمكن ربط حملات بلا مساحة عمل - ننشئها ضمنياً بدل إظهار نموذج إضافي
  if (!workspace) {
    // 🔴 الاسم الافتراضيّ كان إنجليزياً مثبَّتاً **ويُخزَّن**، فيظهر في
    // ترويسة كلّ صفحة في المنتج لمشترك عربيّ وقع على الافتراضيّ. وهو نصٌّ
    // يملكه المشترك ويعدّله، فلا يصحّ تخزينه مفتاحاً - يُكتب بلغته هو لحظة
    // الإنشاء، ويبقى ملكاً له بعدها.
    const locale: Locale = (user.preferredLocale as Locale) ?? "ar";
    workspace = await prisma.workspace.create({
      data: {
        userId: user.id,
        name:
          user.companyName?.trim() ||
          user.name?.trim() ||
          t(locale, "common.defaultWorkspaceName"),
        currency: "SAR",
      },
    });
  }

  const [connectStates, campaignCount] = await Promise.all([
    getConnectStates(workspace.id, user.id),
    prisma.campaignLink.count({ where: { workspaceId: workspace.id } }),
  ]);

  // اكتمل فعلاً؟ نسجّل الإكمال (حتى لا تعود البوابة) ثم ندخله اللوحة
  const connected = connectStates.filter((s) => s.connected);
  if (connected.length > 0 && campaignCount > 0) {
    if (!user.onboardingCompleted) {
      await prisma.user.update({
        where: { id: user.id },
        data: { onboardingCompleted: true },
      });
    }
    redirect("/dashboard");
  }

  return (
    <OnboardingFlow
      workspaceId={workspace.id}
      connectStates={connectStates.map((s) => ({
        platform: s.platform,
        connected: s.connected,
        campaignCount: s.campaignCount,
      }))}
      campaignCount={campaignCount}
      locale={user.preferredLocale === "en" ? "en" : "ar"}
    />
  );
}
