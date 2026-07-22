import { redirect } from "next/navigation";

// الصفحة الرئيسية (/) - بتحوّل للوحة التحكم. لو المستخدم مش مسجّل دخول،
// الـ middleware بيحوّله تلقائياً لصفحة الدخول. من غير الملف ده، فتح رابط
// الموقع الأساسي كان بيدّي 404.
export default function Home() {
  redirect("/dashboard");
}
