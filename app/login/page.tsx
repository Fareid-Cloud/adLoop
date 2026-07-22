// app/login/page.tsx
//
// Server Component: لو المستخدم مسجّل دخول بالفعل، بنحوّله مباشرة للوحة
// التحكم بدل ما نوريه فورم دخول لا يحتاجه. الفورم نفسه في LoginForm (Client).
import { redirect } from "next/navigation";
import { getSessionUserFromCookies } from "@/lib/auth";
import { LoginForm } from "./LoginForm";

export default async function LoginPage() {
  const user = await getSessionUserFromCookies();
  if (user) redirect("/dashboard");
  return <LoginForm />;
}
