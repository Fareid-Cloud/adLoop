// lib/qualitySignals.ts
//
// حسابين مهمين: (1) سرعة رد فريق المبيعات الحقيقية (مش الرد الأوتوماتيك)
// و(2) كشف أنماط الكليكات المشبوهة (بوتات)

// ==================== سرعة الرد الحقيقية ====================

export interface MessageEvent {
  fromCustomer: boolean; // true = رسالة من العميل، false = رد من الفريق
  text: string;
  timestamp: Date;
}

export function computeRealResponseTimeMinutes(
  messages: MessageEvent[],
  autoReplyText: string | null
): number | null {
  const sorted = [...messages].sort(
    (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
  );

  const firstCustomerMsg = sorted.find((m) => m.fromCustomer);
  if (!firstCustomerMsg) return null;

  // بنلاقي أول رد من الفريق بعد رسالة العميل، ونستبعد أي رد يشتبه إنه أوتوماتيك
  const teamReplies = sorted.filter(
    (m) => !m.fromCustomer && m.timestamp > firstCustomerMsg.timestamp
  );

  for (const reply of teamReplies) {
    const secondsDiff =
      (reply.timestamp.getTime() - firstCustomerMsg.timestamp.getTime()) / 1000;

    // فلتر 1: رد أسرع من 5 ثواني = مستحيل يكون إنسان، غالباً أوتوماتيك
    if (secondsDiff < 5) continue;

    // فلتر 2: مطابقة نص الرد التلقائي المحفوظ (لو العميل حدده)
    if (autoReplyText && isSimilarText(reply.text, autoReplyText)) continue;

    // ده أول رد "حقيقي" فعلاً
    return Math.round((secondsDiff / 60) * 10) / 10;
  }

  return null; // لسه محدش رد فعلياً
}

// مقارنة نص تقريبية (بتتجاهل المسافات الزيادة والحالة) بدل تطابق حرفي 100%
function isSimilarText(a: string, b: string): boolean {
  const normalize = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
  return normalize(a) === normalize(b);
}

// ==================== كشف أنماط البوتات (شامل، مش إشارة واحدة) ====================
// كان عندنا إشارة واحدة بس (تكرار IP). ده مش كافي - بوت ذكي بيغيّر IP كل
// مرة، أو بيدوس بمعدل بطيء يهرب من العتبة. الحل: نجمع كذا إشارة مستقلة
// مع بعض، وكل ما إشارات أكتر اتفقت على نفس الزائر، زادت الثقة إنه بوت.
//
// ملاحظة صريحة عن حدود الحل ده: كشف "IP من مركز بيانات" (زي AWS/Azure -
// إشارة قوية جداً على البوتات) محتاج خدمة استخبارات IP خارجية مدفوعة
// (زي IPQualityScore أو MaxMind) - مش موجودة عندنا، ومسجّلة backlog.
// الإشارات تحت كلها مجانية (من بيانات بنجمعها أصلاً، مفيش خدمة خارجية).

export interface ClickEvent {
  ipAddress: string | null;
  clickedAt: Date;
  userAgent?: string | null;
  sessionId?: string | null;
  resultedInConversion?: boolean; // هل الجلسة دي اتحولت فعلياً في النهاية
}

export interface BotFlagResult {
  ipAddress: string;
  clickCount: number;
  suspicionScore: number; // 0-100 - مش قرار ثنائي، درجة ثقة مركّبة من كذا إشارة
  signals: string[]; // إيه الإشارات اللي اتفعّلت بالذات، عشان يبان للمستخدم ليه اتعلّم
  isSuspicious: boolean; // suspicionScore >= 50
}

const KNOWN_BOT_USER_AGENT_PATTERNS = [
  /bot/i, /crawler/i, /spider/i, /headless/i, /phantomjs/i, /puppeteer/i, /selenium/i, /curl/i, /python-requests/i,
];

export function detectSuspiciousIPs(
  clicks: ClickEvent[],
  options: { windowMinutes?: number; maxClicksPerWindow?: number } = {}
): BotFlagResult[] {
  const windowMinutes = options.windowMinutes ?? 10;
  const maxClicksPerWindow = options.maxClicksPerWindow ?? 5;

  const byIp = new Map<string, ClickEvent[]>();
  for (const click of clicks) {
    if (!click.ipAddress) continue;
    if (!byIp.has(click.ipAddress)) byIp.set(click.ipAddress, []);
    byIp.get(click.ipAddress)!.push(click);
  }

  const results: BotFlagResult[] = [];

  for (const [ip, ipClicks] of byIp.entries()) {
    const signals: string[] = [];
    let score = 0;

    const sorted = [...ipClicks].sort((a, b) => a.clickedAt.getTime() - b.clickedAt.getTime());

    // إشارة 1: تكرار كليكات في نافذة زمنية قصيرة (الإشارة الأصلية)
    let maxInWindow = 0;
    for (let i = 0; i < sorted.length; i++) {
      let count = 1;
      for (let j = i + 1; j < sorted.length; j++) {
        const diffMinutes = (sorted[j].clickedAt.getTime() - sorted[i].clickedAt.getTime()) / 60000;
        if (diffMinutes <= windowMinutes) count++;
        else break;
      }
      maxInWindow = Math.max(maxInWindow, count);
    }
    if (maxInWindow > maxClicksPerWindow) {
      signals.push(`${maxInWindow} كليكة من نفس الـ IP خلال ${windowMinutes} دقيقة`);
      score += 40;
    }

    // إشارة 2: User Agent معروف كأداة آلية (بوت/سكريبت)، مش متصفح بشري حقيقي
    const hasBotUserAgent = ipClicks.some(
      (c) => c.userAgent && KNOWN_BOT_USER_AGENT_PATTERNS.some((p) => p.test(c.userAgent!))
    );
    if (hasBotUserAgent) {
      signals.push("متصفح/أداة آلية معروفة (User Agent)");
      score += 40;
    }

    // إشارة 3: كليكات كتير، صفر تحويل نهائي - أقوى إشارة فعلية على إعلانات
    // مهدرة، حتى لو منقدرش نثبت 100% إنه بوت (ممكن يكون جمهور خطأ برضو)
    const conversionTracked = ipClicks.some((c) => c.resultedInConversion !== undefined);
    if (conversionTracked && ipClicks.length >= 5 && !ipClicks.some((c) => c.resultedInConversion)) {
      signals.push(`${ipClicks.length} كليكة من نفس المصدر بدون أي تحويل واحد`);
      score += 20;
    }

    const suspicionScore = Math.min(100, score);

    results.push({
      ipAddress: ip,
      clickCount: sorted.length,
      suspicionScore,
      signals,
      isSuspicious: suspicionScore >= 50,
    });
  }

  return results;
}
