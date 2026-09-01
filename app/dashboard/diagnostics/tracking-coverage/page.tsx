// app/dashboard/diagnostics/tracking-coverage/page.tsx
//
// الوسمُ انتقل إلى `/dashboard/tracking` - قسمٌ من الدرجة الأولى.
//
// **ولم يكن موضعُه السابق خطأً في التصنيف وحده.** كان تحت «صحة الحساب»،
// وهو القسم الذي يُفتَح حين يُشكّ في عطل - بينما الوسمُ هو أوّلُ ما يجب
// أن يُفعَل، وبدونه لا يملك المنتج نقرةً واحدةً يقارن بها ما تدّعيه
// المنصّة. أي أنّ أهمّ خطوةٍ في التفعيل كانت أعمقَ ما في القائمة.
//
// ويبقى هذا المسار محوِّلاً: روابطُ محفوظةٌ ورسائلُ قديمة تشير إليه.

import { redirect } from "next/navigation";

export default function MovedTrackingCoverage() {
  redirect("/dashboard/tracking");
}
