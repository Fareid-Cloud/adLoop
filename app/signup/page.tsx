// app/signup/page.tsx
//
// Server Component: مستخدم مسجّل دخول بالفعل مالوش لزمة يشوف فورم التسجيل.
import { redirect } from "next/navigation";
import { getSessionUserFromCookies } from "@/lib/auth";
import { SignupForm } from "./SignupForm";

export default async function SignupPage() {
  const user = await getSessionUserFromCookies();
  if (user) redirect("/dashboard");
  return <SignupForm />;
}
