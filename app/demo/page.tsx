// app/demo/page.tsx
//
// باب العرض التجريبي.
//
// **البذر لا يحدث أثناء رندر الصفحة.** كان يحدث هناك، فيُبقي Next الصفحة
// السابقة معروضة حتى ينتهي - دقيقة كاملة بلا أي مؤشّر على أن شيئاً يجري.
// الآن تُرسم الشاشة فوراً، والتجهيز يجري خلفها بحالة ظاهرة.

import { redirect } from "next/navigation";
import { getSessionUserFromCookies } from "@/lib/auth";
import { DemoLoader } from "./DemoLoader";
import { type Locale } from "@/lib/i18n/dictionary";

export const dynamic = "force-dynamic";

export default async function DemoEntryPage() {
  const user = await getSessionUserFromCookies();
  if (!user) redirect("/signup?next=/demo");

  const locale: Locale = (user.preferredLocale as Locale) ?? "ar";
  return <DemoLoader locale={locale} />;
}
