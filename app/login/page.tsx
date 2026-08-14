// app/login/page.tsx
//
// Server Component: لو المستخدم مسجّل دخول بالفعل، بنحوّله مباشرة للوحة
// التحكم بدل ما نوريه فورم دخول لا يحتاجه. الفورم نفسه في LoginForm (Client).
import { redirect } from "next/navigation";
import { getSessionUserFromCookies } from "@/lib/auth";
import { LoginForm } from "./LoginForm";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; expired?: string }>;
}) {
  const { next, expired } = await searchParams;
  // مسار داخلي فقط: قبول أيّ قيمة يجعل الرابط أداة تحويل إلى موقع خارجي
  // بعد تسجيل دخول ناجح (open redirect).
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";

  const user = await getSessionUserFromCookies();
  if (user) redirect(safeNext);
  // سبب الوصول يُقال للمستخدم: من وصل إلى هنا لأنّ جلسته انتهت يظنّ
  // أنّه خرج بالخطأ أو أنّ شيئاً تعطّل، ما لم تُقل له العلّة.
  return <LoginForm nextPath={safeNext} expired={expired === "1"} />;
}
