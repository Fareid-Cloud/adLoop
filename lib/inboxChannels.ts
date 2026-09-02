// lib/inboxChannels.ts
//
// 🔴 **ثابتاتُ القنوات وحدها - وصفرُ استيراد، عن قصد.**
//
// كانت في `lib/inbox.ts` جنب منطق الخادم، و`InboxClient.tsx` (كلاينت
// كومبوننت) بيستورد منها الاسمَ والنوع. ولمّا `lib/inbox.ts` استورد
// `sendPushToUser`، جرّ معاه `web-push` ومنه `https-proxy-agent` -
// مكتباتُ Node - إلى حزمةِ المتصفّح، فسقط البناء بـ`module-not-found`.
//
// **و`tsc --noEmit` مابيمسكش ده إطلاقاً**: الأنواع سليمة، والعطب في
// حدود الحزم لا في الأنواع. مابيظهرش إلّا في `next build` حقيقيّ.
//
// فالقاعدة (موثَّقة في `CLAUDE.md`): أيّ ثابتٍ أو نوعٍ يحتاجه كلاينت
// كومبوننت يعيش في ملفٍّ **بلا أيّ استيراد**. الملفّ ده هو ذلك الملفّ،
// وإضافةُ أيّ `import` فيه بتعيد العطب.

export const CHANNELS = ["WEB", "WHATSAPP", "MESSENGER"] as const;
export type Channel = (typeof CHANNELS)[number];

export const CHANNEL_LABEL: Record<Channel, string> = {
  WEB: "Website",
  WHATSAPP: "WhatsApp",
  MESSENGER: "Messenger",
};

export function isChannel(v: string | null | undefined): v is Channel {
  return !!v && (CHANNELS as readonly string[]).includes(v);
}
