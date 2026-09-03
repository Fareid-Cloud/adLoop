// app/admin/channels/page.tsx
//
// ربطُ واتساب بيزنس وماسنجر بالصندوق.
//
// **الصفحةُ دي هي الفرق بين «الكود جاهز» و«الميزة شغّالة».** الربط لو
// كان متغيّراتِ بيئة، تغييرُ رقمٍ أو تجديدُ توكن يتطلّب نشرة - ونشرةٌ
// عشان رقم تليفون احتجازٌ لا إعداد.
//
// ومابتعرضش قيمةَ أيّ سرّ بعد حفظه، ولا حتى مقصوصة. عرضُ آخر أربعة أحرف
// عادةٌ منتشرة وبتقلّل الأمان بلا فايدة حقيقية: صاحبُه عارفه، والمهاجم
// بياخد منها بداية.

import { Radio, CheckCircle2, AlertTriangle } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { AdminPageHeader, Card, SectionTitle, Badge, ago } from "../components/AdminUI";
import { ConnectForm, ChannelToggle } from "./ChannelsClient";

export const dynamic = "force-dynamic";

export default async function ChannelsPage() {
  const connections = await prisma.channelConnection.findMany({
    orderBy: { createdAt: "asc" },
    // بلا `accessToken` ولا `appSecret` في الاختيار: السرُّ مايخرجش من
    // الخادم أصلاً، فلا يُسرَّب بتغييرٍ في الواجهة بعد كده.
    select: {
      id: true, channel: true, externalId: true, label: true,
      active: true, lastEventAt: true, createdAt: true,
    },
  });

  const base = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const webhookUrl = base ? `${base.replace(/\/$/, "")}/api/webhooks/messaging` : null;

  return (
    <div>
      <AdminPageHeader
        title="Messaging channels"
        subtitle="Connect a WhatsApp Business number or a Facebook page so their messages land in the inbox"
        icon={Radio}
      />

      <Card className="mb-4">
        <SectionTitle hint="the same URL for both channels">Webhook URL</SectionTitle>
        {webhookUrl ? (
          <>
            <code className="block overflow-x-auto rounded-lg bg-surface-raised px-3 py-2 text-[12px] text-text-primary">
              {webhookUrl}
            </code>
            <p className="m-0 mt-2 text-[11.5px] leading-relaxed text-text-faint">
              Paste this into Meta as the callback URL, with the verify token you set below. One URL serves both
              WhatsApp and Messenger — Meta sends them in the same shape, and the connection is identified by the
              signature on each request, not by the address.
            </p>
          </>
        ) : (
          <p className="m-0 text-[12.5px] text-gap">
            <AlertTriangle size={13} className="mb-0.5 me-1 inline" />
            Set NEXT_PUBLIC_APP_URL before connecting a channel — without it there is no address to give Meta.
          </p>
        )}
      </Card>

      {connections.length > 0 && (
        <div className="mb-4 space-y-2">
          {connections.map((c) => {
            // 🔴 **«محفوظ» مش «شغّال».** الدليل الوحيد إنّ الربط تمّ هو
            // وصولُ حدثٍ فعليّ. ربطٌ بتوقيعٍ غلط بيبان سليماً هنا للأبد
            // وهو مابيستقبلش رسالة واحدة - فبيتقال صراحةً.
            const live = !!c.lastEventAt;
            return (
              <Card key={c.id}>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-[13px] font-medium text-text-primary">{c.label}</span>
                      <Badge tone={c.active ? "ok" : "muted"}>{c.active ? "active" : "paused"}</Badge>
                      {live ? (
                        <Badge tone="ok"><CheckCircle2 size={9} className="me-0.5 inline" />receiving</Badge>
                      ) : (
                        <Badge tone="warn">no events yet</Badge>
                      )}
                    </div>
                    <div className="mt-0.5 text-[11px] text-text-faint">
                      {c.channel} · {c.externalId}
                      {c.lastEventAt && ` · last message ${ago(c.lastEventAt)}`}
                    </div>
                  </div>
                  <ChannelToggle id={c.id} active={c.active} />
                </div>
                {!live && (
                  <p className="m-0 mt-2 border-t border-border pt-2 text-[11.5px] leading-relaxed text-text-faint">
                    Saved, but nothing has arrived. Check the callback URL and verify token in Meta, and that the
                    app is subscribed to the <code>messages</code> field. A wrong signature is rejected silently by
                    design — it looks identical to no one having written.
                  </p>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <ConnectForm />
    </div>
  );
}
