// app/components/PlatformLogo.tsx
//
// لوجوهات المنصات كـ SVG مضمّن (recognizable brand marks). المستخدم أكّد
// إنه هيتولّى موضوع حقوق الملكية. تُستخدم في القائمة الجانبية، الجداول،
// صفحات الدخول/التسجيل، والدائرة.

export type PlatformKey =
  | "GOOGLE_ADS" | "META_ADS" | "FACEBOOK" | "INSTAGRAM" | "TIKTOK_ADS"
  | "SNAPCHAT_ADS" | "MICROSOFT_ADS" | "LINKEDIN_ADS" | "WHATSAPP"
  | "MESSENGER" | "X_ADS" | "SHOPIFY" | "SALLA" | "ZID" | "WOOCOMMERCE"
  | "EASY_ORDERS" | "GA4" | "CLARITY" | "BOSTA" | "ARAMEX" | "MYLERZ" | "SMSA";

export function PlatformLogo({ platform, size = 18 }: { platform: string; size?: number }) {
  // currentColor يجعل الأجزاء المحايدة تتبع لون النص، فتظل واضحة في
  // الوضعين الفاتح والداكن بدل أسود ثابت يذوب في الخلفية الداكنة.
  const s = { width: size, height: size, display: "block", color: "var(--text-primary)" } as const;
  switch (platform) {
    case "GOOGLE_ADS":
    case "GOOGLE":
      return (
        <svg viewBox="0 0 48 48" style={s} aria-label="Google">
          <path fill="#4285F4" d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z" />
          <path fill="#34A853" d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z" />
          <path fill="#FBBC05" d="M11.69 28.18C11.25 26.86 11 25.45 11 24s.25-2.86.69-4.18v-5.7H4.34C2.85 17.09 2 20.45 2 24s.85 6.91 2.34 9.88l7.35-5.7z" />
          <path fill="#EA4335" d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z" />
        </svg>
      );
    case "META_ADS":
    case "META":
      // العلامة رُسمت سابقاً كخطّ مفتوح فبدت مقطوعة عند كل الأحجام. هذه
      // حلقة لانهاية مغلقة فعلاً (تنتهي حيث تبدأ) بتدرّج ميتا الأزرق.
      return (
        <svg viewBox="0 0 48 48" style={s} aria-label="Meta" shapeRendering="geometricPrecision">
          <defs>
            <linearGradient id="adloop-meta" x1="6" y1="34" x2="42" y2="14" gradientUnits="userSpaceOnUse">
              <stop offset="0" stopColor="#0064E1" />
              <stop offset=".55" stopColor="#0080FB" />
              <stop offset="1" stopColor="#00A4FF" />
            </linearGradient>
          </defs>
          <path
            fill="none"
            stroke="url(#adloop-meta)"
            strokeWidth="4.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M24 24c-3.7-6.7-7.2-9.4-11-8.2-3.6 1.2-5.6 5-5.6 8.9s2 7.3 5.4 7.3c3.6 0 6.1-3.1 11.2-12 5.1-8.9 7.6-12 11.2-12 3.4 0 5.4 3.4 5.4 7.3s-2 7.7-5.6 8.9c-3.8 1.2-7.3-1.5-11-8.2z"
          />
        </svg>
      );
    case "FACEBOOK":
      return (
        <svg viewBox="0 0 48 48" style={s} aria-label="Facebook">
          <circle cx="24" cy="24" r="22" fill="#0866FF" />
          <path fill="#fff" d="M28.5 24H26v14h-6V24h-3v-5h3v-3.2c0-3.9 1.6-6.3 6.2-6.3H30v5h-2.4c-1.4 0-1.6.5-1.6 1.7V19h4l-.5 5z" />
        </svg>
      );
    case "INSTAGRAM":
      return (
        <svg viewBox="0 0 48 48" style={s} aria-label="Instagram">
          <defs><radialGradient id="ig" cx="0.3" cy="1" r="1"><stop offset="0" stopColor="#FED576" /><stop offset="0.35" stopColor="#F47133" /><stop offset="0.6" stopColor="#BC3081" /><stop offset="1" stopColor="#4C63D2" /></radialGradient></defs>
          <rect x="4" y="4" width="40" height="40" rx="12" fill="url(#ig)" />
          <circle cx="24" cy="24" r="9" fill="none" stroke="#fff" strokeWidth="3" />
          <circle cx="34.5" cy="13.5" r="2.5" fill="#fff" />
        </svg>
      );
    case "TIKTOK_ADS":
    case "TIKTOK":
      // النوتة الأساسية بلون النص لا بالأسود الثابت: الطبقة السوداء
      // السابقة كانت تختفي تماماً في الوضع الداكن فيبدو الشعار مشوّهاً.
      // الإزاحة بين الطبقات صغيرة (0.9) لتبقى العلامة واضحة عند 12–16px.
      return (
        <svg viewBox="0 0 48 48" style={s} aria-label="TikTok" shapeRendering="geometricPrecision">
          <g transform="translate(-1.1,-0.9)">
            <path fill="#25F4EE" d="M32 5c.5 4.6 3.2 7.5 7.7 7.8v5.3c-2.6.2-5-.6-7.7-2.2v10.7c0 8.2-6 13-12.5 11.5-7-1.6-9.2-10-4.1-15 1.9-1.9 4.5-2.6 7.4-2.2v5.5c-.7-.2-1.5-.3-2.3-.1-2 .4-3.2 2.2-2.7 4.2.5 2 2.7 3 4.7 2.3 1.6-.6 2.4-1.9 2.4-4V5H32z" />
          </g>
          <g transform="translate(1.1,0.9)">
            <path fill="#FE2C55" d="M32 5c.5 4.6 3.2 7.5 7.7 7.8v5.3c-2.6.2-5-.6-7.7-2.2v10.7c0 8.2-6 13-12.5 11.5-7-1.6-9.2-10-4.1-15 1.9-1.9 4.5-2.6 7.4-2.2v5.5c-.7-.2-1.5-.3-2.3-.1-2 .4-3.2 2.2-2.7 4.2.5 2 2.7 3 4.7 2.3 1.6-.6 2.4-1.9 2.4-4V5H32z" />
          </g>
          <path fill="currentColor" d="M32 5c.5 4.6 3.2 7.5 7.7 7.8v5.3c-2.6.2-5-.6-7.7-2.2v10.7c0 8.2-6 13-12.5 11.5-7-1.6-9.2-10-4.1-15 1.9-1.9 4.5-2.6 7.4-2.2v5.5c-.7-.2-1.5-.3-2.3-.1-2 .4-3.2 2.2-2.7 4.2.5 2 2.7 3 4.7 2.3 1.6-.6 2.4-1.9 2.4-4V5H32z" />
        </svg>
      );
    case "SNAPCHAT_ADS":
    case "SNAPCHAT":
      return (
        <svg viewBox="0 0 48 48" style={s} aria-label="Snapchat">
          <rect x="3" y="3" width="42" height="42" rx="11" fill="#FFFC00" />
          <path fill="#fff" d="M24 11c4 0 6.5 3 6.6 6.8l.1 2.4c1-.5 2.2-.3 2.7.5.4.7-.1 1.6-1.3 2.1-.6.3-1.5.5-1.5 1.1 0 1 3 3.4 5 3.9.6.1.7.6.3 1-.7.8-3 1-3.3 1.6-.2.5.3 1.4-.4 1.7-.6.3-1.9-.4-3.2-.1-1.2.2-2.2 1.9-5.3 1.9s-4.1-1.7-5.3-1.9c-1.3-.3-2.6.4-3.2.1-.7-.3-.2-1.2-.4-1.7-.3-.6-2.6-.8-3.3-1.6-.4-.4-.3-.9.3-1 2-.5 5-2.9 5-3.9 0-.6-.9-.8-1.5-1.1-1.2-.5-1.7-1.4-1.3-2.1.5-.8 1.7-1 2.7-.5l.1-2.4C17.5 14 20 11 24 11z" />
        </svg>
      );
    case "MICROSOFT_ADS":
    case "MICROSOFT":
      return (
        <svg viewBox="0 0 48 48" style={s} aria-label="Microsoft">
          <rect x="5" y="5" width="17" height="17" fill="#F25022" />
          <rect x="26" y="5" width="17" height="17" fill="#7FBA00" />
          <rect x="5" y="26" width="17" height="17" fill="#00A4EF" />
          <rect x="26" y="26" width="17" height="17" fill="#FFB900" />
        </svg>
      );
    case "LINKEDIN_ADS":
    case "LINKEDIN":
      return (
        <svg viewBox="0 0 48 48" style={s} aria-label="LinkedIn">
          <rect x="3" y="3" width="42" height="42" rx="6" fill="#0A66C2" />
          <path fill="#fff" d="M14 19h5v16h-5V19zm2.5-8a2.9 2.9 0 110 5.8 2.9 2.9 0 010-5.8zM22 19h4.8v2.2h.1c.7-1.3 2.4-2.6 4.9-2.6 5.2 0 6.2 3.4 6.2 7.9V35h-5v-7.6c0-1.8 0-4.1-2.5-4.1s-2.9 2-2.9 4v7.7h-5V19z" />
        </svg>
      );
    case "WHATSAPP":
      return (
        <svg viewBox="0 0 48 48" style={s} aria-label="WhatsApp">
          <circle cx="24" cy="24" r="22" fill="#25D366" />
          <path fill="#fff" d="M24 12c-6.6 0-12 5.4-12 12 0 2.1.6 4.2 1.6 6L12 36l6.2-1.6c1.7 1 3.7 1.5 5.8 1.5 6.6 0 12-5.4 12-12s-5.4-11.9-12-11.9zm7 16.9c-.3.8-1.7 1.6-2.4 1.7-.6.1-1.4.1-2.3-.1-.5-.2-1.2-.4-2.1-.8-3.7-1.6-6.1-5.3-6.3-5.6-.2-.3-1.5-2-1.5-3.8s.9-2.7 1.3-3.1c.3-.4.7-.5 1-.5h.7c.2 0 .5-.1.8.6l1.1 2.7c.1.2.2.5 0 .7l-.4.6c-.2.2-.4.5-.2.9.2.4.9 1.5 2 2.4 1.4 1.2 2.5 1.6 2.9 1.8.3.1.5.1.7-.1.2-.2.8-.9 1-1.2.2-.3.4-.3.7-.2l2.6 1.2c.3.2.5.2.6.4.1.2.1.7-.2 1.4z" />
        </svg>
      );
    case "MESSENGER":
      return (
        <svg viewBox="0 0 48 48" style={s} aria-label="Messenger">
          <defs>
            <linearGradient id="adloop-msgr" x1="12" y1="42" x2="36" y2="8" gradientUnits="userSpaceOnUse">
              <stop offset="0" stopColor="#0099FF" />
              <stop offset=".6" stopColor="#A033FF" />
              <stop offset="1" stopColor="#FF5280" />
            </linearGradient>
          </defs>
          <path fill="url(#adloop-msgr)" d="M24 4C12.7 4 4 12.3 4 23.5c0 6.4 2.9 12 7.4 15.7V46l6.8-3.7c1.8.5 3.7.8 5.8.8 11.3 0 20-8.3 20-19.6S35.3 4 24 4z" />
          <path fill="#fff" d="M12 29.4l9.7-10.3 5 5.2 8.9-5.2-9.7 10.3-5-5.2-8.9 5.2z" />
        </svg>
      );
    case "X_ADS":
    case "X":
      return (
        <svg viewBox="0 0 48 48" style={s} aria-label="X">
          <rect x="3" y="3" width="42" height="42" rx="10" fill="currentColor" />
          <path fill="var(--surface)" d="M31.6 12h4.3l-9.4 10.8L37.5 36h-8.6l-6.8-8.5L14.4 36H10l10-11.5L9.2 12h8.8l6.1 7.8L31.6 12zm-1.5 21.4h2.4L17.9 14.4h-2.6l14.8 19z" />
        </svg>
      );
    case "SHOPIFY":
      return (
        <svg viewBox="0 0 48 48" style={s} aria-label="Shopify">
          <path fill="#95BF47" d="M31.7 9.7c-.2-.1-.5-.1-.7 0l-2 .6c-.5-1.7-1.5-3.3-3.3-3.3h-.3C24.7 6.1 23.9 6 23 6c-3.4 0-5.9 3.2-6.8 7l-2.7.8c-.9.3-.9.3-1 1.1L10 39.6 30 43l9.5-2.1-7.8-31.2zM23 8.6h.3c-.6 1-1.1 2.5-1.4 4.5l-3.2 1c.8-2.9 2.4-5.5 4.3-5.5z" />
          <path fill="#5E8E3E" d="M31 9.7 30 42.9l9.5-2.1-7.8-31.1c-.2-.1-.5-.1-.7 0z" />
          <path fill="#fff" d="M26.7 20.4l-1.2 3.5s-1.1-.6-2.4-.6c-1.9 0-2 1.2-2 1.5 0 1.7 4.4 2.3 4.4 6.2 0 3.1-1.9 5-4.6 5-3.2 0-4.9-2-4.9-2l.9-2.9s1.7 1.5 3.1 1.5c.9 0 1.3-.7 1.3-1.3 0-2.2-3.6-2.3-3.6-5.9 0-3 2.2-5.9 6.5-5.9 1.8 0 2.5.5 2.5.5z" />
        </svg>
      );
    case "WOOCOMMERCE":
      return (
        <svg viewBox="0 0 48 48" style={s} aria-label="WooCommerce">
          <rect x="2" y="10" width="44" height="24" rx="6" fill="#96588A" />
          <path fill="#fff" d="M9.5 17.5c.6 0 1 .4 1.1 1l1 6.3 2.2-5.3c.2-.5.5-.8 1-.8s.8.3 1 .8l2.2 5.3 1-6.3c.1-.6.5-1 1.1-1 .7 0 1.2.6 1.1 1.3l-1.6 9c-.1.6-.6 1.1-1.2 1.1s-1-.3-1.2-.9l-2.4-5.6-2.4 5.6c-.2.6-.6.9-1.2.9s-1.1-.5-1.2-1.1l-1.6-9c-.1-.7.4-1.3 1.1-1.3zm18.6 0c2.9 0 4.9 2 4.9 5s-2 5-4.9 5-4.9-2-4.9-5 2-5 4.9-5zm0 2.5c-1.3 0-2.2 1-2.2 2.5s.9 2.5 2.2 2.5 2.2-1 2.2-2.5-.9-2.5-2.2-2.5zm10.3-2.5c2.9 0 4.9 2 4.9 5s-2 5-4.9 5-4.9-2-4.9-5 2-5 4.9-5zm0 2.5c-1.3 0-2.2 1-2.2 2.5s.9 2.5 2.2 2.5 2.2-1 2.2-2.5-.9-2.5-2.2-2.5z" />
          <path fill="#96588A" d="M18 33l-4 6 1-6z" />
        </svg>
      );
    case "GA4":
    case "GOOGLE_ANALYTICS":
      return (
        <svg viewBox="0 0 48 48" style={s} aria-label="Google Analytics">
          <rect x="30" y="6" width="10" height="36" rx="5" fill="#F9AB00" />
          <rect x="19" y="18" width="10" height="24" rx="5" fill="#E37400" />
          <circle cx="13" cy="37" r="5" fill="#E37400" />
        </svg>
      );
    case "CLARITY":
      return (
        <svg viewBox="0 0 48 48" style={s} aria-label="Microsoft Clarity">
          <circle cx="24" cy="24" r="20" fill="none" stroke="#0078D4" strokeWidth="4" />
          <circle cx="24" cy="24" r="8" fill="#0078D4" />
        </svg>
      );
    // العلامات الإقليمية: حرف مميّز داخل مربّع بلون العلامة الرسمي. لا
    // نخترع شعاراً غير حقيقي، ولا نترك مربّعاً رمادياً بلا هوية.
    case "SALLA":
      return <Letter mark="س" bg="#00C48C" size={size} label="Salla" />;
    case "ZID":
      return <Letter mark="ز" bg="#5D3EBC" size={size} label="Zid" />;
    case "EASY_ORDERS":
      return <Letter mark="E" bg="#FF6B35" size={size} label="Easy Orders" />;
    case "BOSTA":
      return <Letter mark="B" bg="#E30613" size={size} label="Bosta" />;
    case "ARAMEX":
      return <Letter mark="A" bg="#E4002B" size={size} label="Aramex" />;
    case "MYLERZ":
      return <Letter mark="M" bg="#00A9E0" size={size} label="Mylerz" />;
    case "SMSA":
      return <Letter mark="S" bg="#003D7C" size={size} label="SMSA" />;
    default:
      return <Letter mark="?" bg="#64748B" size={size} label={platform} />;
  }
}

/**
 * شارة حرفية لعلامة لا نملك رسمها الرسمي. أوضح من مربّع رمادي بلا معنى،
 * وأصدق من اختراع شعار ليس شعار الشركة.
 */
function Letter({ mark, bg, size, label }: { mark: string; bg: string; size: number; label: string }) {
  return (
    <span
      aria-label={label}
      title={label}
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.26),
        background: bg,
        color: "#fff",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: Math.round(size * 0.55),
        fontWeight: 700,
        lineHeight: 1,
        flexShrink: 0,
      }}
    >
      {mark}
    </span>
  );
}
