// lib/pageAudit.ts
//
// فحص صفحة واحد يجمع كل ما يمكن استخلاصه من **نداء شبكة واحد**: التتبع،
// وSEO، وأمان النقل (SSL/HTTPS)، ووسوم UTM في روابط الصفحة.
//
// السبب في دمجها: كلها تُقرأ من نفس ملف HTML. تقسيمها إلى نداءات منفصلة
// يعني تحميل الصفحة أربع مرات لكل فحص - إهدار بلا فائدة، وأبطأ للمستخدم.
// الأداء (PageSpeed) يبقى منفصلاً لأنه خدمة خارجية بمفتاح ومهلة مختلفة.

export interface SeoFindings {
  title: string | null;
  titleLength: number;
  metaDescription: string | null;
  metaDescriptionLength: number;
  h1Count: number;
  hasCanonical: boolean;
  hasOpenGraph: boolean;
  imagesMissingAlt: number;
  totalImages: number;
  isNoIndex: boolean;
  hasViewport: boolean;
  langAttribute: string | null;
}

export interface SecurityFindings {
  isHttps: boolean;
  /** موارد http داخل صفحة https - تُحجب في المتصفحات الحديثة */
  mixedContentCount: number;
  redirectedToHttps: boolean;
}

export interface UtmFindings {
  /** روابط خارجة تحمل وسوم UTM - مؤشر على ضبط التتبع في الحملات */
  linksWithUtm: number;
  totalOutboundLinks: number;
  /** روابط واتساب/محادثة - نقطة التحويل الأساسية في هذا المنتج */
  conversationLinks: number;
  conversationLinksWithTracking: number;
}

export interface PageAuditResult {
  seo: SeoFindings | null;
  security: SecurityFindings | null;
  utm: UtmFindings | null;
}

const attr = (tag: string, name: string): string | null => {
  const m = tag.match(new RegExp(`${name}\\s*=\\s*["']([^"']*)["']`, "i"));
  return m ? m[1].trim() : null;
};

export function auditPageHtml(html: string, finalUrl: string, originalUrl: string): PageAuditResult {
  // ==================== SEO ====================
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? titleMatch[1].replace(/\s+/g, " ").trim() : null;

  const metaTags = html.match(/<meta\b[^>]*>/gi) ?? [];
  const descTag = metaTags.find((t) => /name\s*=\s*["']description["']/i.test(t));
  const metaDescription = descTag ? attr(descTag, "content") : null;

  const robotsTag = metaTags.find((t) => /name\s*=\s*["']robots["']/i.test(t));
  const isNoIndex = robotsTag ? /noindex/i.test(attr(robotsTag, "content") ?? "") : false;

  const hasViewport = metaTags.some((t) => /name\s*=\s*["']viewport["']/i.test(t));
  const hasOpenGraph = metaTags.some((t) => /property\s*=\s*["']og:/i.test(t));

  const imgTags = html.match(/<img\b[^>]*>/gi) ?? [];
  const imagesMissingAlt = imgTags.filter((t) => !/\balt\s*=/i.test(t)).length;

  const htmlTag = html.match(/<html\b[^>]*>/i)?.[0] ?? "";

  const seo: SeoFindings = {
    title,
    titleLength: title?.length ?? 0,
    metaDescription,
    metaDescriptionLength: metaDescription?.length ?? 0,
    h1Count: (html.match(/<h1\b/gi) ?? []).length,
    hasCanonical: /<link\b[^>]*rel\s*=\s*["']canonical["']/i.test(html),
    hasOpenGraph,
    imagesMissingAlt,
    totalImages: imgTags.length,
    isNoIndex,
    hasViewport,
    langAttribute: attr(htmlTag, "lang"),
  };

  // ==================== أمان النقل ====================
  const isHttps = finalUrl.startsWith("https://");
  // موارد http صريحة داخل صفحة https فقط - الروابط النصية لا تُحجب
  const mixedContentCount = isHttps
    ? (html.match(/(?:src|href)\s*=\s*["']http:\/\/[^"']+["']/gi) ?? [])
        .filter((m) => /\.(js|css|png|jpe?g|gif|svg|webp|woff2?)/i.test(m)).length
    : 0;

  const security: SecurityFindings = {
    isHttps,
    mixedContentCount,
    redirectedToHttps: !originalUrl.startsWith("https://") && isHttps,
  };

  // ==================== UTM وروابط المحادثة ====================
  const anchors = html.match(/<a\b[^>]*href\s*=\s*["'][^"']+["'][^>]*>/gi) ?? [];
  const hrefs = anchors.map((a) => attr(a, "href") ?? "").filter(Boolean);

  const outbound = hrefs.filter((h) => /^https?:\/\//i.test(h));
  const conversation = hrefs.filter((h) =>
    /(wa\.me|api\.whatsapp\.com|m\.me|t\.me|tel:)/i.test(h)
  );

  const utm: UtmFindings = {
    linksWithUtm: outbound.filter((h) => /utm_(source|medium|campaign)=/i.test(h)).length,
    totalOutboundLinks: outbound.length,
    conversationLinks: conversation.length,
    // رابط المحادثة يجب أن يحمل معرّفاً يربطه بالنقرة - وإلا وصلت المحادثة
    // بلا مصدر معروف وضاع الإسناد تماماً
    conversationLinksWithTracking: conversation.filter((h) =>
      /(ref=|utm_|adloop|gclid|fbclid|ttclid)/i.test(h)
    ).length,
  };

  return { seo, security, utm };
}
