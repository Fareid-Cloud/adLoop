// app/components/PlatformLogo.tsx
//
// لوجوهات المنصات كـ SVG مضمّن (recognizable brand marks). المستخدم أكّد
// إنه هيتولّى موضوع حقوق الملكية. تُستخدم في القائمة الجانبية، الجداول،
// صفحات الدخول/التسجيل، والدائرة.

export type PlatformKey =
  | "GOOGLE_ADS" | "META_ADS" | "FACEBOOK" | "INSTAGRAM" | "TIKTOK_ADS"
  | "SNAPCHAT_ADS" | "MICROSOFT_ADS" | "LINKEDIN_ADS" | "WHATSAPP";

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
      return (
        <svg viewBox="0 0 48 48" style={s} aria-label="Meta" shapeRendering="geometricPrecision">
          <defs>
            <linearGradient id="mtg" x1="6" y1="34" x2="42" y2="14" gradientUnits="userSpaceOnUse">
              <stop offset="0" stopColor="#0064E1" />
              <stop offset=".4" stopColor="#0064E1" />
              <stop offset=".83" stopColor="#0082FB" />
              <stop offset="1" stopColor="#0082FB" />
            </linearGradient>
          </defs>
          {/* علامة ميتا: حلقتان متداخلتان مرسومتان كخط بسماكة موحّدة -
              أدق من محاولة تعبئة شكل مصمت، وتظل حادة في الأحجام الصغيرة */}
          <path
            fill="none" stroke="url(#mtg)" strokeWidth="4.6"
            strokeLinecap="round" strokeLinejoin="round"
            d="M10.6 30.4c-1.9 0-2.9-1.5-2.9-4.6 0-5.6 2.9-11.6 6.6-11.6 2.6 0 4.6 2.4 7.1 6.4 1.2 1.9 2.4 4 3.6 6.1 2.4 4.2 3.6 5.9 5.9 5.9 2.2 0 3.3-1.6 3.3-5.1 0-6.1-2.6-12.4-5.9-12.4-2.8 0-5 2.7-7.4 6.5"
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
    default:
      return (
        <span style={{ ...s, borderRadius: 4, background: "#64748B", display: "inline-block" }} />
      );
  }
}
