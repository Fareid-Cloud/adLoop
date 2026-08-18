"use client";

// app/components/SearchHighlight.tsx
//
// 🔴 **البحث كان يفتح الصفحة ويترك القارئ يدوّر.**
//
// نتيجةٌ اسمُها «حملة الشتاء» تفتح صفحة الحملات - وفيها أربعون صفّاً،
// فيبدأ يبحث بعينه عن الشيء الذي بحث عنه أصلاً. الرحلةُ إلى الصفحة نصفُ
// الطريق، والنصف الآخر أن ينزل عند العنصر نفسه ويُعلَّم.
//
// **يعمل بلا تعديلٍ في كلّ صفحة:** يكفي أن يحمل العنصر
// `data-search-id="<المعرّف>"`، وهو المعرّف نفسه الذي وضعه البحث في
// `?highlight=`. لا سياق ولا حالة عامّة - سمةٌ واحدة.

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { t, type Locale } from "@/lib/i18n/dictionary";

export function SearchHighlight({ locale }: { locale: Locale }) {
  const params = useSearchParams();
  const pathname = usePathname();
  const id = params.get("highlight");

  useEffect(() => {
    if (!id) return;

    // البيانات تصل بعد التصيير الأوّل في أغلب الصفحات، فالعنصر قد لا
    // يكون موجوداً بعد. المراقب ينتظره بدل مؤقّتٍ يخمّن متى يظهر.
    let cancelled = false;
    let observer: MutationObserver | null = null;

    function apply(el: Element) {
      if (cancelled) return;
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("search-found");
      // يزول بعد ثوانٍ: علامةٌ تبقى تصير جزءاً من الصفحة، فتُقرأ حالةً
      // دائمة لا إشارةَ وصول.
      setTimeout(() => el.classList.remove("search-found"), 2600);
      observer?.disconnect();
    }

    // 🔴 هدفان لا واحد: كيانٌ بمعرّفه، وعنوانُ قسمٍ باسمه المعروض.
    //
    // العناوين لا تحمل `data-search-id`، ولا يصحّ أن تحمله: ثمانيةٌ
    // وثلاثون عنواناً توسَم بيدٍ هي قائمةٌ موازيةٌ لفهرسٍ يُولَّد من الكود،
    // وأوّلُ عنوانٍ يُضاف بعدها يظهر في البحث ولا يُهبَط عنده - عطلٌ صامت.
    // والفهرس مُولَّدٌ من العناوين نفسها، فالاسم رابطٌ قائمٌ لا مخترَع.
    // نسخةٌ مضيَّقة النوع: التضييق عند الحارس أعلاه لا يعبر إلى دالةٍ
    // مُعرَّفة قد تُستدعى لاحقاً (المراقب يناديها بعد حين).
    const targetId: string = id;
    const sectionKey = targetId.startsWith("s:") ? targetId.slice(2) : null;
    const wantedText = sectionKey === null ? null : t(locale, sectionKey).trim();

    function locate(): Element | null {
      if (wantedText !== null) {
        if (wantedText === sectionKey) return null; // مفتاحٌ بلا ترجمة
        const heads = Array.from(document.querySelectorAll("h1, h2, h3, h4"));
        return heads.find((el) => el.textContent?.trim() === wantedText) ?? null;
      }
      return document.querySelector(`[data-search-id="${CSS.escape(targetId)}"]`);
    }

    const found = locate();
    if (found) {
      apply(found);
      return;
    }

    observer = new MutationObserver(() => {
      const el = locate();
      if (el) apply(el);
    });
    observer.observe(document.body, { childList: true, subtree: true });

    // لا ننتظر إلى الأبد: معرّفٌ لعنصرٍ لم يعد موجوداً يترك مراقباً
    // يعمل على كلّ تغيير في الصفحة بلا نهاية.
    const stop = setTimeout(() => observer?.disconnect(), 8000);
    return () => {
      cancelled = true;
      clearTimeout(stop);
      observer?.disconnect();
    };
  }, [id, pathname, locale]);

  return null;
}
