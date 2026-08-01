// app/demo/page.tsx
//
// باب العرض التجريبي. المسجَّل يدخل مباشرةً بعد تجهيز مساحته، وغير
// المسجَّل يُوجَّه إلى التسجيل ثم يعود إلى هنا تلقائياً.

import { redirect } from "next/navigation";
import { getSessionUserFromCookies } from "@/lib/auth";
import { seedDemoWorkspace } from "@/lib/demo";

export const dynamic = "force-dynamic";

export default async function DemoEntryPage() {
  const user = await getSessionUserFromCookies();
  if (!user) redirect("/signup?next=/demo");

  const locale = (user.preferredLocale as "ar" | "en") ?? "ar";
  const workspaceId = await seedDemoWorkspace(user.id, locale);

  // الكوكي نفسه الذي يستخدمه مبدّل المساحات - الديمو مساحة عادية لا مسار
  // موازٍ، فيعمل معها كل ما في المنتج بلا استثناء
  redirect(`/dashboard?ws=${workspaceId}`);
}
