// app/signup/page.tsx
//
// Server Component: مستخدم مسجّل دخول بالفعل مالوش لزمة يشوف فورم التسجيل.
//
// 🔴 **كانت بتتجاهل `next` تماماً - فالدعوةُ بتضيع.**
// اللي بيفتح رابطَ دعوةٍ وهو مش مسجَّل بيتحوّل لـ`/login?next=/invite/…`،
// وبيدوس «أنشئ حساباً» فيروح لصفحةٍ نسيت الوجهة، وبعد التسجيل بيقع على
// الداشبورد. الدعوةُ اتقبلتش، ومافيش رسالةُ خطأ تقول ليه - هو شايف حسابَه
// شغّالاً فبيفتكر إنّها اتقبلت.
import { redirect } from "next/navigation";
import { getSessionUserFromCookies } from "@/lib/auth";
import { safeNext } from "@/lib/safeNext";
import { SignupForm } from "./SignupForm";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const sp = await searchParams;
  const next = safeNext(sp.next);

  const user = await getSessionUserFromCookies();
  if (user) redirect(next);
  return <SignupForm nextPath={next} />;
}
