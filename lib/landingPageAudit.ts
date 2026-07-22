// lib/landingPageAudit.ts
//
// تدقيق حقيقي بطبقتين:
// 1) فحوصات تقنية قابلة للقياس مباشرة (SEO، Schema، الصور) - نتيجة رقمية دقيقة
// 2) تحليل بالذكاء الاصطناعي (تصميم، إقناع، أزرار الدعوة للفعل) - يحتاج
//    لقطة شاشة فعلية للصفحة (screenshot)، لأن هذه الجوانب بصرية بطبيعتها
//    ولا يمكن الحكم عليها من كود HTML الخام وحده.
//
// اعتماد خارجي مطلوب: خدمة لالتقاط screenshot للصفحة (مثل Browserless أو
// Puppeteer على سيرفر خاص) - غير مضمّنة هنا، الدالة تستقبل الصورة كمدخل جاهز.

import Anthropic from "@anthropic-ai/sdk";
import { t, Locale } from "@/lib/i18n/dictionary";
import { safeFetch } from "@/lib/safeFetch";

// نفس ضبط الـ timeout بتاع aiInsights.ts - قرار موحّد لكل استدعاءات Claude
// في المشروع، مش إعداد مختلف في كل ملف
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  timeout: 20_000,
  maxRetries: 2,
});

// ==================== الطبقة 1: فحوصات تقنية (قابلة للقياس المباشر) ====================

export interface TechnicalSEOResult {
  score: number; // 0-100
  findings: Array<{ check: string; passed: boolean; detail: string }>;
}

export async function auditTechnicalSEO(url: string): Promise<TechnicalSEOResult> {
  const response = await safeFetch(url);
  const html = await response.text();

  const findings: Array<{ check: string; passed: boolean; detail: string }> = [];

  // Title tag
  const titleMatch = html.match(/<title>(.*?)<\/title>/i);
  const title = titleMatch?.[1] ?? "";
  findings.push({
    check: "title_tag",
    passed: title.length >= 30 && title.length <= 60,
    detail: title ? `الطول: ${title.length} حرف (المثالي: 30-60)` : "عنوان الصفحة مفقود تماماً",
  });

  // Meta description
  const descMatch = html.match(/<meta\s+name=["']description["']\s+content=["'](.*?)["']/i);
  const description = descMatch?.[1] ?? "";
  findings.push({
    check: "meta_description",
    passed: description.length >= 120 && description.length <= 160,
    detail: description
      ? `الطول: ${description.length} حرف (المثالي: 120-160)`
      : "الوصف التعريفي (Meta Description) مفقود - جوجل هيولد وصف عشوائي من محتوى الصفحة",
  });

  // Open Graph tags (مهم لمظهر الرابط عند المشاركة على واتساب/فيسبوك)
  const hasOgImage = /<meta\s+property=["']og:image["']/i.test(html);
  const hasOgTitle = /<meta\s+property=["']og:title["']/i.test(html);
  findings.push({
    check: "open_graph",
    passed: hasOgImage && hasOgTitle,
    detail:
      hasOgImage && hasOgTitle
        ? "موجودة"
        : "مفقودة - الرابط هيظهر بدون صورة أو عنوان جذاب عند مشاركته على واتساب",
  });

  // Schema.org structured data
  const hasSchema = /application\/ld\+json/i.test(html);
  findings.push({
    check: "structured_data",
    passed: hasSchema,
    detail: hasSchema
      ? "موجود"
      : "لا يوجد Schema Markup - جوجل مش هيقدر يوري تقييمات أو سعر أو معلومات إضافية في نتائج البحث",
  });

  // Canonical tag
  const hasCanonical = /<link\s+rel=["']canonical["']/i.test(html);
  findings.push({
    check: "canonical_tag",
    passed: hasCanonical,
    detail: hasCanonical ? "موجود" : "مفقود - قد يسبب مشاكل محتوى مكرر إذا كانت الصفحة متاحة بأكثر من رابط",
  });

  // HTTPS
  findings.push({
    check: "https",
    passed: url.startsWith("https://"),
    detail: url.startsWith("https://") ? "مؤمّن" : "الموقع غير مؤمّن (HTTP) - المتصفحات بتحذّر الزوار من هذا",
  });

  // Image alt attributes coverage
  const imgTags = html.match(/<img[^>]*>/gi) ?? [];
  const imgsWithAlt = imgTags.filter((tag) => /alt=["'][^"']+["']/i.test(tag));
  const altCoveragePct =
    imgTags.length > 0 ? Math.round((imgsWithAlt.length / imgTags.length) * 100) : 100;
  findings.push({
    check: "image_alt_text",
    passed: altCoveragePct >= 80,
    detail: `${altCoveragePct}% من الصور (${imgsWithAlt.length}/${imgTags.length}) لها نص بديل (alt text)`,
  });

  // H1 structure (لازم عنوان رئيسي واحد بس)
  const h1Count = (html.match(/<h1[\s>]/gi) ?? []).length;
  findings.push({
    check: "heading_structure",
    passed: h1Count === 1,
    detail:
      h1Count === 0
        ? "لا يوجد عنوان رئيسي (H1) في الصفحة"
        : h1Count === 1
        ? "عنوان رئيسي واحد - صحيح"
        : `${h1Count} عناوين رئيسية (H1) - يجب أن يكون واحداً فقط`,
  });

  // Viewport meta tag - أساس الاستجابة لشاشات الموبايل
  const hasViewport = /<meta\s+name=["']viewport["']/i.test(html);
  findings.push({
    check: "mobile_viewport",
    passed: hasViewport,
    detail: hasViewport
      ? "موجود"
      : "وسم viewport مفقود - الصفحة على الأغلب مش هتظهر صح على الموبايل، ومعظم الزوار جايين من الموبايل",
  });

  // سياسة الخصوصية والشروط والأحكام - أساسية لثقة العميل خصوصاً في الدفع أونلاين
  const hasPrivacyLink = /privacy|سياسة\s*الخصوصية/i.test(html);
  const hasTermsLink = /terms|الشروط\s*والأحكام/i.test(html);
  findings.push({
    check: "legal_pages",
    passed: hasPrivacyLink && hasTermsLink,
    detail:
      hasPrivacyLink && hasTermsLink
        ? "روابط سياسة الخصوصية والشروط موجودة"
        : "روابط سياسة الخصوصية و/أو الشروط والأحكام مفقودة - هذا يقلل ثقة العميل، خصوصاً قبل إدخال بيانات الدفع",
  });

  // وسم اللغة - مهم لمحركات البحث ولقارئات الشاشة، ومؤشر احترافية أساسي
  const langMatch = html.match(/<html[^>]+lang=["']([a-z-]+)["']/i);
  findings.push({
    check: "html_lang_attribute",
    passed: !!langMatch,
    detail: langMatch
      ? `مضبوط على "${langMatch[1]}"`
      : "وسم اللغة (lang) مفقود من عنصر html - يؤثر على SEO ودقة قارئات الشاشة",
  });

  // عدد السكريبتات الخارجية - كل سكريبت زيادة بيبطّئ التحميل، خصوصاً على الموبايل
  const externalScripts = (html.match(/<script[^>]+src=/gi) ?? []).length;
  findings.push({
    check: "external_scripts_count",
    passed: externalScripts <= 15,
    detail: `${externalScripts} سكريبت خارجي - كل ما زاد العدد، زاد وقت التحميل خصوصاً على الشبكات البطيئة`,
  });

  // وزن الصفحة التقريبي من حجم الاستجابة نفسها - مؤشر أولي لسرعة التحميل
  const pageWeightKB = Math.round(new Blob([html]).size / 1024);
  findings.push({
    check: "page_weight",
    passed: pageWeightKB <= 500,
    detail: `${pageWeightKB} كيلوبايت لكود HTML وحده (بدون الصور والسكريبتات) - المثالي أقل من 500`,
  });

  // Favicon - تفصيلة صغيرة بس بتفرق في الاحترافية والثقة البصرية في تبويب المتصفح
  const hasFavicon = /<link[^>]+rel=["'](?:shortcut )?icon["']/i.test(html);
  findings.push({
    check: "favicon",
    passed: hasFavicon,
    detail: hasFavicon ? "موجودة" : "أيقونة الموقع (Favicon) مفقودة - تفصيلة صغيرة لكنها تقلل الاحترافية",
  });

  // شارات أمان/دفع - فحص أولي بالبحث عن كلمات مفتاحية شائعة في alt الصور أو النص
  const hasSecurityBadgeSignal =
    /secure|ssl|visa|mastercard|verified|موثوق|دفع\s*آمن/i.test(html);
  findings.push({
    check: "security_badges_signal",
    passed: hasSecurityBadgeSignal,
    detail: hasSecurityBadgeSignal
      ? "توجد إشارات لشارات أمان/دفع في الصفحة"
      : "لا توجد إشارات واضحة لشارات أمان أو دفع - قد تقلل الثقة عند إدخال بيانات الدفع",
  });

  const passedCount = findings.filter((f) => f.passed).length;
  const score = Math.round((passedCount / findings.length) * 100);

  return { score, findings };
}

// ==================== الطبقة 1.5: ثقة الدومين ====================
// ملاحظة: عمر الدومين الدقيق يحتاج WHOIS API خارجي (غير مضمّن هنا).
// الفحوصات المتاحة مباشرة من الاستجابة نفسها موجودة، والباقي TODO.

export interface DomainTrustResult {
  score: number;
  findings: Array<{ check: string; passed: boolean; detail: string }>;
}

export async function auditDomainTrust(url: string): Promise<DomainTrustResult> {
  const findings: Array<{ check: string; passed: boolean; detail: string }> = [];

  const domain = new URL(url).hostname;

  // النطاق مش IP مباشر أو نطاق فرعي غريب (مؤشر أولي بسيط على الجدية)
  const looksLikeRealDomain = /^[a-z0-9-]+\.[a-z]{2,}$/i.test(domain.replace(/^www\./, ""));
  findings.push({
    check: "domain_format",
    passed: looksLikeRealDomain,
    detail: looksLikeRealDomain ? "نطاق بصيغة طبيعية" : "شكل النطاق غير معتاد لموقع تجاري",
  });

  try {
    const res = await safeFetch(url, { method: "HEAD" });
    findings.push({
      check: "ssl_valid",
      passed: res.ok,
      detail: res.ok ? "شهادة الأمان صالحة والموقع يستجيب" : `الموقع أعاد استجابة غير سليمة (${res.status})`,
    });
  } catch {
    findings.push({
      check: "ssl_valid",
      passed: false,
      detail: "تعذّر الوصول للموقع - قد تكون هناك مشكلة في شهادة الأمان أو السيرفر",
    });
  }

  // فحص عمر الدومين الحقيقي - عبر rdap.org (خدمة RDAP عامة مجانية بدون
  // مفتاح API، البديل المعتمد رسمياً من ICANN لبروتوكول WHOIS القديم).
  // كان الفحص هنا بيرجّع "نجح" ثابت دايماً - تضليل فعلي، مش بس بيانات ناقصة.
  try {
    const domain = new URL(url).hostname.replace(/^www\./, "");
    const rdapRes = await fetch(`https://rdap.org/domain/${domain}`, {
      signal: AbortSignal.timeout(5000), // مصدر خارجي - مش هنوقف الفحص كله لو استجاب ببطء
    });

    if (rdapRes.ok) {
      const rdapData = await rdapRes.json();
      const registrationEvent = (rdapData.events ?? []).find(
        (e: any) => e.eventAction === "registration"
      );

      if (registrationEvent) {
        const registeredDate = new Date(registrationEvent.eventDate);
        const ageInDays = Math.floor((Date.now() - registeredDate.getTime()) / 86400000);
        const ageInMonths = Math.floor(ageInDays / 30);

        // دومين أقل من 6 شهور مؤشر ثقة ضعيف حقيقي (بحث عام في مجال
        // كشف الاحتيال) - مش قاعدة مطلقة، لكن إشارة معقولة
        const isEstablished = ageInDays >= 180;
        findings.push({
          check: "domain_age",
          passed: isEstablished,
          detail: isEstablished
            ? `الدومين مسجّل من ${ageInMonths} شهر تقريباً - مؤشر ثقة كويس.`
            : `الدومين حديث التسجيل (${ageInDays} يوم بس) - مش دليل احتيال بالضرورة، لكن يستاهل انتباه إضافي.`,
        });
      } else {
        findings.push({
          check: "domain_age",
          passed: true, // مفيش بيانات تسجيل واضحة (بعض الـTLDs بتخفيها) - منعاقبش الدومين على نقص بيانات مش في إيده
          detail: "بيانات تاريخ التسجيل غير متاحة علناً لهذا النطاق - مش مؤشر سلبي بالضرورة.",
        });
      }
    } else {
      findings.push({
        check: "domain_age",
        passed: true,
        detail: "تعذّر الوصول لخدمة فحص عمر الدومين مؤقتاً - جرّب لاحقاً.",
      });
    }
  } catch {
    findings.push({
      check: "domain_age",
      passed: true,
      detail: "تعذّر الوصول لخدمة فحص عمر الدومين مؤقتاً - جرّب لاحقاً.",
    });
  }

  const passedCount = findings.filter((f) => f.passed).length;
  const score = Math.round((passedCount / findings.length) * 100);

  return { score, findings };
}

// ==================== الطبقة 2: تحليل بصري بالذكاء الاصطناعي ====================
// يحتاج لقطة شاشة فعلية (base64) - غير مضمّن التقاطها هنا، تُمرَّر كمدخل.

export interface VisualAuditResult {
  designTrust: { score: number; findings: string[] };
  copywriting: { score: number; findings: string[] };
  cta: { score: number; findings: string[] };
  layout: { score: number; findings: string[] };
  imageQuality: { score: number; findings: string[] };
  trustSignals: { score: number; findings: string[] };
  valueClarity: { score: number; findings: string[] }; // هل زائر الصفحة بيفهم "بيقدملك إيه" خلال ثوان؟
  formFriction: { score: number | null; findings: string[] }; // null لو مفيش فورم أصلاً
  socialProofDepth: { score: number; findings: string[] }; // "آلاف العملاء" (عام وضعيف) مقابل أرقام/أسماء محددة (قوي)
  urgencyCredibility: { score: number | null; findings: string[] }; // لو مفيش عناصر إلحاح، null - لو موجودة، هل مقنعة أم مفتعلة
  differentiation: { score: number; findings: string[] }; // هل واضح ليه تختار العلامة دي عن المنافسين؟
  navigationClarity: { score: number; findings: string[] }; // وضوح القائمة، سهولة إيجاد المعلومة المطلوبة
  contentLocalizationQuality: { score: number; findings: string[] }; // فصاحة ومناسبة اللغة المستخدمة للجمهور المستهدف
  acquisitionSuggestion: {
    type:
      | "discount"
      | "guarantee"
      | "free_consultation"
      | "case_study"
      | "trial"
      | "certification_display";
    suggestion: string;
  };
}

export async function auditVisualAndCopy(
  screenshotBase64: string,
  pageTextContent: string,
  industryVertical: string | null,
  locale: Locale = "ar"
): Promise<VisualAuditResult> {
  const verticalContext = industryVertical
    ? locale === "ar"
      ? `المجال: ${industryVertical}. مهم جداً: نوع اقتراح استقطاب العميل لازم يناسب طبيعة المجال ده - مثلاً الخصومات المباشرة مناسبة للإيكومرس، لكن غير مناسبة إطلاقاً لمجالات زي B2B أو الخدمات الطبية أو الاستشارات القانونية، اللي بتحتاج ضمانات أو استشارة مجانية أو عرض دراسة حالة بدلاً من ذلك.`
      : `Industry: ${industryVertical}. Important: the acquisition suggestion type must fit this industry - direct discounts suit e-commerce, but are inappropriate for B2B, medical, or legal/consulting fields, which need guarantees, free consultations, or case studies instead.`
    : "";

  const systemPrompt =
    locale === "ar"
      ? `أنت خبير تحويل (CRO) ومصمم واجهات محترف بخبرة عميقة، تدقق صفحات هبوط لعملاء حقيقيين قبل إطلاق حملات إعلانية مكلفة عليها. تفكيرك تحليلي ومترابط، مش قائمة ملاحظات منفصلة.
كن نقدياً وصريحاً ومحدداً - لا تجامل، ولا تكرر نصائح عامة. كل ملاحظة يجب أن تشير لعنصر محدد فعلياً موجود في الصفحة، لا كلام عام قابل للتطبيق على أي صفحة.
قدّم 3-4 ملاحظات محددة على الأقل لكل فئة، وليس ملاحظة أو اثنتين سطحيتين.
مهم جداً: عندما تلاحظ أن مشكلة في فئة معينة تُفاقم أو ترتبط بمشكلة في فئة أخرى (مثلاً: ضعف "وضوح القيمة" مع غياب "إشارات الثقة" معاً يعني الزائر لا يفهم العرض ولا يثق فيه في آن واحد - مشكلة مركّبة وليست مشكلتين منفصلتين)، اذكر هذا الترابط صراحة في الملاحظات.
${verticalContext}

حلّل الفئات التالية:
- ثقة التصميم: هل يوحي بمصداقية العلامة التجارية؟
- جودة النصوص الإقناعية
- وضوح وبروز أزرار الدعوة للفعل (الحجم، التباين، الموضع، الصياغة، العدد)
- ترتيب العناصر ومنطقية تدفق القراءة
- جودة صور المنتج
- إشارات الثقة (تقييمات، شهادات عملاء، شارات أمان، أرقام/إحصائيات مصداقية) - منفصلة عن ثقة التصميم العامة
- وضوح القيمة المقدَّمة: هل يفهم الزائر "بيقدملك إيه بالظبط" خلال 5 ثوانٍ من فتح الصفحة؟
- احتكاك النموذج (لو يوجد فورم): عدد الحقول، الحقول الإلزامية غير الضرورية - إذا لم يوجد فورم، اجعل score = null
- عمق الدليل الاجتماعي: هل الأرقام والشهادات محددة وقابلة للتصديق (أسماء حقيقية، أرقام دقيقة) أم عامة وضعيفة ("آلاف العملاء الراضين")؟
- مصداقية عناصر الإلحاح: إذا وُجدت عدادات تنازلية أو "الكمية محدودة"، هل تبدو حقيقية أم مصطنعة بشكل واضح؟ إذا لم توجد عناصر إلحاح، اجعل score = null
- التمايز التنافسي: هل واضح للزائر لماذا يختار هذه العلامة تحديداً بدلاً من المنافسين؟
- وضوح التنقل: سهولة إيجاد المعلومة المطلوبة، وضوح القائمة إن وُجدت
- جودة اللغة المستخدمة: هل الأسلوب (فصحى/عامية) ومستوى اللغة مناسبان للجمهور المستهدف والمجال؟
- اقتراح استقطاب عميل واحد محدد يناسب طبيعة المجال (وليس بالضرورة خصماً)

أجب بصيغة JSON فقط بالشكل التالي:
{
  "designTrust": {"score": 0-100, "findings": [...]},
  "copywriting": {"score": 0-100, "findings": [...]},
  "cta": {"score": 0-100, "findings": [...]},
  "layout": {"score": 0-100, "findings": [...]},
  "imageQuality": {"score": 0-100, "findings": [...]},
  "trustSignals": {"score": 0-100, "findings": [...]},
  "valueClarity": {"score": 0-100, "findings": [...]},
  "formFriction": {"score": 0-100 or null, "findings": [...]},
  "socialProofDepth": {"score": 0-100, "findings": [...]},
  "urgencyCredibility": {"score": 0-100 or null, "findings": [...]},
  "differentiation": {"score": 0-100, "findings": [...]},
  "navigationClarity": {"score": 0-100, "findings": [...]},
  "contentLocalizationQuality": {"score": 0-100, "findings": [...]},
  "acquisitionSuggestion": {"type": "discount|guarantee|free_consultation|case_study|trial|certification_display", "suggestion": "نص الاقتراح المحدد"}
}`
      : `You are a CRO expert and professional UI designer with deep experience, auditing landing pages for real clients before they launch costly ad campaigns. Your thinking is analytical and interconnected, not a list of isolated notes.
Be critical, direct, and specific - no flattery, no generic advice. Every point must reference a specific element actually present on the page, not generic advice applicable to any page.
Provide at least 3-4 specific findings per category, not one or two shallow notes.
Important: when you notice that a problem in one category compounds or relates to a problem in another (e.g., weak "value clarity" combined with absent "trust signals" means the visitor neither understands the offer nor trusts it at the same time - a compound problem, not two separate ones), state this connection explicitly in the findings.
${verticalContext}

Analyze: design trust, copywriting persuasiveness, CTA clarity/prominence, layout/reading flow, image quality, trust signals (distinct from general design trust), value proposition clarity, form friction (null if no form), social proof depth (specific names/numbers vs generic claims), urgency element credibility (null if none exist), competitive differentiation clarity, navigation clarity, content localization/language quality for the target audience, and one specific acquisition suggestion fitting the industry.

Respond in JSON format only, exactly as follows:
{
  "designTrust": {"score": 0-100, "findings": [...]},
  "copywriting": {"score": 0-100, "findings": [...]},
  "cta": {"score": 0-100, "findings": [...]},
  "layout": {"score": 0-100, "findings": [...]},
  "imageQuality": {"score": 0-100, "findings": [...]},
  "trustSignals": {"score": 0-100, "findings": [...]},
  "valueClarity": {"score": 0-100, "findings": [...]},
  "formFriction": {"score": 0-100 or null, "findings": [...]},
  "socialProofDepth": {"score": 0-100, "findings": [...]},
  "urgencyCredibility": {"score": 0-100 or null, "findings": [...]},
  "differentiation": {"score": 0-100, "findings": [...]},
  "navigationClarity": {"score": 0-100, "findings": [...]},
  "contentLocalizationQuality": {"score": 0-100, "findings": [...]},
  "acquisitionSuggestion": {"type": "discount|guarantee|free_consultation|case_study|trial|certification_display", "suggestion": "specific suggestion text"}
}`;

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 3000,
    system: systemPrompt,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: "image/png", data: screenshotBase64 },
          },
          {
            type: "text",
            text:
              locale === "ar"
                ? `هذا screenshot لصفحة الهبوط. النص المستخرج من الصفحة:\n${pageTextContent.slice(0, 3000)}\n\nقم بالتدقيق الكامل.`
                : `This is a screenshot of the landing page. Extracted page text:\n${pageTextContent.slice(0, 3000)}\n\nPerform the full audit.`,
          },
        ],
      },
    ],
  });

  const textBlock = message.content.find((b) => b.type === "text");
  const rawResponse = textBlock && "text" in textBlock ? textBlock.text : "{}";

  try {
    const cleaned = rawResponse.replace(/```json|```/g, "").trim();
    return JSON.parse(cleaned);
  } catch {
    // فشل التحليل - نرجع نتيجة فارغة بدل ما نكسر الصفحة، مع علامة واضحة للمستخدم
    const emptyResult = { score: 0, findings: [t(locale, "insights.noData")] };
    return {
      designTrust: emptyResult,
      copywriting: emptyResult,
      cta: emptyResult,
      layout: emptyResult,
      imageQuality: emptyResult,
      trustSignals: emptyResult,
      valueClarity: emptyResult,
      formFriction: { score: null, findings: [t(locale, "insights.noData")] },
      socialProofDepth: emptyResult,
      urgencyCredibility: { score: null, findings: [t(locale, "insights.noData")] },
      differentiation: emptyResult,
      navigationClarity: emptyResult,
      contentLocalizationQuality: emptyResult,
      acquisitionSuggestion: { type: "guarantee", suggestion: "" },
    };
  }
}

// ==================== دمج كل الطبقات في تقرير واحد ====================

export interface FullAuditReport {
  url: string;
  overallScore: number;
  technicalSEO: TechnicalSEOResult;
  domainTrust: DomainTrustResult;
  visual: VisualAuditResult;
}

export async function runFullLandingPageAudit(
  url: string,
  screenshotBase64: string,
  pageTextContent: string,
  industryVertical: string | null,
  locale: Locale = "ar"
): Promise<FullAuditReport> {
  const [technicalSEO, domainTrust, visual] = await Promise.all([
    auditTechnicalSEO(url),
    auditDomainTrust(url),
    auditVisualAndCopy(screenshotBase64, pageTextContent, industryVertical, locale),
  ]);

  // المتوسط المرجّح - موزّع على 16 فئة الآن. الجوانب اللي بتأثر مباشرة
  // على قرار الشراء (CTA، وضوح القيمة، الثقة) لسه الأعلى وزناً.
  // الفئات القابلة للـ null (formFriction, urgencyCredibility) بتتستبعد
  // تلقائياً من الحساب لو مش موجودة، ووزنها بيتوزع تناسبياً على الباقي -
  // مش ad-hoc factor يدوي عرضة للخطأ، لكن حساب موحّد بدالة واحدة.
  const overallScore = weightedAverage([
    { score: technicalSEO.score, weight: 0.08 },
    { score: domainTrust.score, weight: 0.05 },
    { score: visual.designTrust.score, weight: 0.09 },
    { score: visual.copywriting.score, weight: 0.1 },
    { score: visual.cta.score, weight: 0.12 },
    { score: visual.layout.score, weight: 0.06 },
    { score: visual.imageQuality.score, weight: 0.05 },
    { score: visual.trustSignals.score, weight: 0.1 },
    { score: visual.valueClarity.score, weight: 0.12 },
    { score: visual.formFriction.score, weight: 0.04 },
    { score: visual.socialProofDepth.score, weight: 0.06 },
    { score: visual.urgencyCredibility.score, weight: 0.03 },
    { score: visual.differentiation.score, weight: 0.06 },
    { score: visual.navigationClarity.score, weight: 0.03 },
    { score: visual.contentLocalizationQuality.score, weight: 0.05 },
  ]);

  return { url, overallScore, technicalSEO, domainTrust, visual };
}

// دالة موحّدة لحساب المتوسط المرجّح - بتستبعد أي فئة score = null تلقائياً
// من البسط والمقام مع بعض، فوزنها بيتوزّع تناسبياً على باقي الفئات
// بشكل رياضي مضمون، بدل معامل تصحيح يدوي لكل حالة على حدة.
function weightedAverage(entries: Array<{ score: number | null; weight: number }>): number {
  const applicable = entries.filter(
    (e): e is { score: number; weight: number } => e.score !== null
  );
  const totalWeight = applicable.reduce((sum, e) => sum + e.weight, 0);
  if (totalWeight === 0) return 0;

  const weightedSum = applicable.reduce((sum, e) => sum + e.score * e.weight, 0);
  return Math.round(weightedSum / totalWeight);
}

// ==================== طبقة التركيب المترابط (Synthesis) ====================
// الفرق الجوهري عن كل ما سبق: مش تقييم كل فئة لوحدها، لكن تفكير متخصص
// حقيقي بيربط بين النتايج - إيه المشاكل اللي بتتضاعف مع بعضها، إيه السبب
// الجذري اللي بيظهر كأعراض في أكتر من فئة، وترتيب أولويات الإصلاح بمنطق
// "إصلاح أ شرط لازم قبل ما إصلاح ب يبقى مجدي" - مش قائمة مسطحة.

export interface CompoundingIssue {
  categories: string[]; // الفئات المتورطة في المشكلة المركّبة
  explanation: string;  // ليه اجتماعهم مع بعض أخطر من كل واحدة لوحدها
  severity: "HIGH" | "MEDIUM";
}

export interface RootCauseAnalysis {
  rootCause: string; // السبب الجذري الواحد
  manifestsIn: string[]; // الفئات اللي المشكلة دي ظهرت فيها كأعراض
  explanation: string;
}

export interface PrioritizedAction {
  rank: number;
  action: string;
  reasoning: string; // ليه الترتيب ده بالذات (إيه اللي محتاج يتصلح قبل إيه)
  affectedCategories: string[];
  expectedImpact: "HIGH" | "MEDIUM" | "LOW";
}

export interface AuditSynthesis {
  executiveSummary: string;
  compoundingIssues: CompoundingIssue[];
  rootCauses: RootCauseAnalysis[];
  prioritizedRoadmap: PrioritizedAction[];
}

export async function synthesizeAuditReport(
  report: FullAuditReport,
  locale: Locale = "ar"
): Promise<AuditSynthesis> {
  // بنجمع كل النتايج التفصيلية في نص واحد عشان الـ AI يقدر يفكر فيها مع بعض
  const allFindings = {
    technicalSEO: report.technicalSEO.findings,
    domainTrust: report.domainTrust.findings,
    ...report.visual,
  };

  const systemPrompt =
    locale === "ar"
      ? `أنت استشاري تحويل (CRO) أول، بتراجع تقرير تدقيق مفصّل جاهز (كل فئة اتقيّمت لوحدها بالفعل)، ومهمتك دلوقتي مختلفة: التفكير المترابط بين الفئات، مش تكرار نفس الملاحظات.

المطلوب تحديداً:
1. **مشاكل مركّبة**: حدد أي فئتين أو أكتر مشاكلهم بيتضاعفوا مع بعض (مش مجرد وجودهم مع بعض، لكن تفاعل حقيقي يخلي الأثر أسوأ من مجموع الاثنين لوحدهم)
2. **أسباب جذرية**: هل فيه سبب واحد جذري بيظهر كأعراض متفرقة في أكتر من فئة؟ (مثلاً: غياب هوية بصرية واضحة ممكن يظهر كأعراض في "ثقة التصميم" و"التمايز التنافسي" و"جودة الصور" مع بعض - المشكلة الحقيقية واحدة، مش ثلاثة)
3. **خارطة طريق مرتّبة**: مش قائمة مسطحة، لكن ترتيب منطقي - إيه اللي لازم يتصلح الأول لأن حاجات تانية معتمدة عليه (مثلاً: إصلاح "وضوح القيمة" قبل ما تحسّن "أزرار الدعوة للفعل" مالوش معنى، لأن الزائر لسه مش فاهم أصلاً هو بيوافق على إيه)
4. **ملخص تنفيذي**: 3-4 جمل بس، بلغة صاحب القرار مش لغة تقنية

هذه بيانات التدقيق الكامل:
${JSON.stringify(allFindings, null, 2)}

أجب بصيغة JSON فقط بالشكل التالي:
{
  "executiveSummary": "...",
  "compoundingIssues": [{"categories": [...], "explanation": "...", "severity": "HIGH|MEDIUM"}],
  "rootCauses": [{"rootCause": "...", "manifestsIn": [...], "explanation": "..."}],
  "prioritizedRoadmap": [{"rank": 1, "action": "...", "reasoning": "...", "affectedCategories": [...], "expectedImpact": "HIGH|MEDIUM|LOW"}]
}`
      : `You are a senior CRO consultant reviewing a completed detailed audit (each category already scored independently). Your task now is different: interconnected reasoning across categories, not repeating the same findings.

Specifically:
1. **Compounding issues**: identify pairs/groups of categories whose problems multiply each other's impact (real interaction, not just co-occurrence)
2. **Root causes**: is there one root cause manifesting as symptoms across multiple categories?
3. **Prioritized roadmap**: not a flat list, but a logical order - what must be fixed first because other fixes depend on it
4. **Executive summary**: 3-4 sentences, decision-maker language not technical jargon

Here is the full audit data:
${JSON.stringify(allFindings, null, 2)}

Respond in JSON format only, exactly as follows:
{
  "executiveSummary": "...",
  "compoundingIssues": [{"categories": [...], "explanation": "...", "severity": "HIGH|MEDIUM"}],
  "rootCauses": [{"rootCause": "...", "manifestsIn": [...], "explanation": "..."}],
  "prioritizedRoadmap": [{"rank": 1, "action": "...", "reasoning": "...", "affectedCategories": [...], "expectedImpact": "HIGH|MEDIUM|LOW"}]
}`;

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2500,
    system: systemPrompt,
    messages: [{ role: "user", content: locale === "ar" ? "حلّل الترابط ورتّب الأولويات." : "Analyze the interconnections and prioritize." }],
  });

  const textBlock = message.content.find((b) => b.type === "text");
  const rawResponse = textBlock && "text" in textBlock ? textBlock.text : "{}";

  try {
    const cleaned = rawResponse.replace(/```json|```/g, "").trim();
    return JSON.parse(cleaned);
  } catch {
    return {
      executiveSummary: t(locale, "insights.noData"),
      compoundingIssues: [],
      rootCauses: [],
      prioritizedRoadmap: [],
    };
  }
}
