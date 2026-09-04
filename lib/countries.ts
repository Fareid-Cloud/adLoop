// lib/countries.ts
//
// قائمة الدول - مصدر حقيقة واحد لكلّ نموذج يسأل عن الدولة (التسجيل، الدعم،
// وأيّ نموذج لاحق).
//
// **لماذا وُجد هذا الملفّ:** كانت القائمة تسع دول عربية و«أخرى» مكتوبة داخل
// `SignupForm` نفسه. من يفتح المنتج من خارج المنطقة يجد بلده غير موجود -
// أي أنّ أوّل شاشة يراها تقول له إنّ المنتج ليس له.
//
// **ولماذا رمز لا اسم:** كانت `<option value={c}>` تحمل الاسم *العربي* نفسه،
// فيُخزَّن «السعودية» في قاعدة البيانات. نصّ معروض في عمود بيانات: يكسر
// قاعدة «المخزَّن مفتاح لا نصّ»، ويجعل الصفّ غير قابل للترجمة بعد كتابته،
// ويتعطّل أيّ تجميع إحصائي لو تغيّرت صياغة الاسم يوماً. الرمز ISO 3166-1
// alpha-2 ثابت لا يتغيّر، والاسم يُشتقّ منه وقت العرض بلغة القارئ.

export interface Country {
  /** ISO 3166-1 alpha-2 - هذا وحده ما يُخزَّن */
  code: string;
  ar: string;
  en: string;
}

/** الأسواق التي يستهدفها المنتج فعلاً - تُعرض أوّلاً لا أبجدياً، فالغالبية
 *  العظمى من المسجّلين منها ولا يصحّ أن يمرّروا مئة خيار للوصول إليها. */
export const PRIORITY_COUNTRY_CODES = ["SA", "EG", "AE", "KW", "QA", "BH", "OM", "JO", "MA"];

export const COUNTRIES: Country[] = [
  { code: "SA", ar: "السعودية", en: "Saudi Arabia" },
  { code: "EG", ar: "مصر", en: "Egypt" },
  { code: "AE", ar: "الإمارات", en: "United Arab Emirates" },
  { code: "KW", ar: "الكويت", en: "Kuwait" },
  { code: "QA", ar: "قطر", en: "Qatar" },
  { code: "BH", ar: "البحرين", en: "Bahrain" },
  { code: "OM", ar: "عُمان", en: "Oman" },
  { code: "JO", ar: "الأردن", en: "Jordan" },
  { code: "MA", ar: "المغرب", en: "Morocco" },

  { code: "AF", ar: "أفغانستان", en: "Afghanistan" },
  { code: "AL", ar: "ألبانيا", en: "Albania" },
  { code: "DZ", ar: "الجزائر", en: "Algeria" },
  { code: "AD", ar: "أندورا", en: "Andorra" },
  { code: "AO", ar: "أنغولا", en: "Angola" },
  { code: "AG", ar: "أنتيغوا وبربودا", en: "Antigua and Barbuda" },
  { code: "AR", ar: "الأرجنتين", en: "Argentina" },
  { code: "AM", ar: "أرمينيا", en: "Armenia" },
  { code: "AU", ar: "أستراليا", en: "Australia" },
  { code: "AT", ar: "النمسا", en: "Austria" },
  { code: "AZ", ar: "أذربيجان", en: "Azerbaijan" },
  { code: "BS", ar: "الباهاما", en: "Bahamas" },
  { code: "BD", ar: "بنغلاديش", en: "Bangladesh" },
  { code: "BB", ar: "بربادوس", en: "Barbados" },
  { code: "BY", ar: "بيلاروسيا", en: "Belarus" },
  { code: "BE", ar: "بلجيكا", en: "Belgium" },
  { code: "BZ", ar: "بليز", en: "Belize" },
  { code: "BJ", ar: "بنين", en: "Benin" },
  { code: "BT", ar: "بوتان", en: "Bhutan" },
  { code: "BO", ar: "بوليفيا", en: "Bolivia" },
  { code: "BA", ar: "البوسنة والهرسك", en: "Bosnia and Herzegovina" },
  { code: "BW", ar: "بوتسوانا", en: "Botswana" },
  { code: "BR", ar: "البرازيل", en: "Brazil" },
  { code: "BN", ar: "بروناي", en: "Brunei" },
  { code: "BG", ar: "بلغاريا", en: "Bulgaria" },
  { code: "BF", ar: "بوركينا فاسو", en: "Burkina Faso" },
  { code: "BI", ar: "بوروندي", en: "Burundi" },
  { code: "KH", ar: "كمبوديا", en: "Cambodia" },
  { code: "CM", ar: "الكاميرون", en: "Cameroon" },
  { code: "CA", ar: "كندا", en: "Canada" },
  { code: "CV", ar: "الرأس الأخضر", en: "Cape Verde" },
  { code: "CF", ar: "أفريقيا الوسطى", en: "Central African Republic" },
  { code: "TD", ar: "تشاد", en: "Chad" },
  { code: "CL", ar: "تشيلي", en: "Chile" },
  { code: "CN", ar: "الصين", en: "China" },
  { code: "CO", ar: "كولومبيا", en: "Colombia" },
  { code: "KM", ar: "جزر القمر", en: "Comoros" },
  { code: "CG", ar: "الكونغو", en: "Congo" },
  { code: "CD", ar: "الكونغو الديمقراطية", en: "DR Congo" },
  { code: "CR", ar: "كوستاريكا", en: "Costa Rica" },
  { code: "CI", ar: "ساحل العاج", en: "Côte d'Ivoire" },
  { code: "HR", ar: "كرواتيا", en: "Croatia" },
  { code: "CU", ar: "كوبا", en: "Cuba" },
  { code: "CY", ar: "قبرص", en: "Cyprus" },
  { code: "CZ", ar: "التشيك", en: "Czechia" },
  { code: "DK", ar: "الدنمارك", en: "Denmark" },
  { code: "DJ", ar: "جيبوتي", en: "Djibouti" },
  { code: "DM", ar: "دومينيكا", en: "Dominica" },
  { code: "DO", ar: "الدومينيكان", en: "Dominican Republic" },
  { code: "EC", ar: "الإكوادور", en: "Ecuador" },
  { code: "SV", ar: "السلفادور", en: "El Salvador" },
  { code: "GQ", ar: "غينيا الاستوائية", en: "Equatorial Guinea" },
  { code: "ER", ar: "إريتريا", en: "Eritrea" },
  { code: "EE", ar: "إستونيا", en: "Estonia" },
  { code: "SZ", ar: "إسواتيني", en: "Eswatini" },
  { code: "ET", ar: "إثيوبيا", en: "Ethiopia" },
  { code: "FJ", ar: "فيجي", en: "Fiji" },
  { code: "FI", ar: "فنلندا", en: "Finland" },
  { code: "FR", ar: "فرنسا", en: "France" },
  { code: "GA", ar: "الغابون", en: "Gabon" },
  { code: "GM", ar: "غامبيا", en: "Gambia" },
  { code: "GE", ar: "جورجيا", en: "Georgia" },
  { code: "DE", ar: "ألمانيا", en: "Germany" },
  { code: "GH", ar: "غانا", en: "Ghana" },
  { code: "GR", ar: "اليونان", en: "Greece" },
  { code: "GD", ar: "غرينادا", en: "Grenada" },
  { code: "GT", ar: "غواتيمالا", en: "Guatemala" },
  { code: "GN", ar: "غينيا", en: "Guinea" },
  { code: "GW", ar: "غينيا بيساو", en: "Guinea-Bissau" },
  { code: "GY", ar: "غيانا", en: "Guyana" },
  { code: "HT", ar: "هايتي", en: "Haiti" },
  { code: "HN", ar: "هندوراس", en: "Honduras" },
  { code: "HK", ar: "هونغ كونغ", en: "Hong Kong" },
  { code: "HU", ar: "المجر", en: "Hungary" },
  { code: "IS", ar: "آيسلندا", en: "Iceland" },
  { code: "IN", ar: "الهند", en: "India" },
  { code: "ID", ar: "إندونيسيا", en: "Indonesia" },
  { code: "IR", ar: "إيران", en: "Iran" },
  { code: "IQ", ar: "العراق", en: "Iraq" },
  { code: "IE", ar: "أيرلندا", en: "Ireland" },
  { code: "IT", ar: "إيطاليا", en: "Italy" },
  { code: "JM", ar: "جامايكا", en: "Jamaica" },
  { code: "JP", ar: "اليابان", en: "Japan" },
  { code: "KZ", ar: "كازاخستان", en: "Kazakhstan" },
  { code: "KE", ar: "كينيا", en: "Kenya" },
  { code: "KI", ar: "كيريباتي", en: "Kiribati" },
  { code: "KG", ar: "قيرغيزستان", en: "Kyrgyzstan" },
  { code: "LA", ar: "لاوس", en: "Laos" },
  { code: "LV", ar: "لاتفيا", en: "Latvia" },
  { code: "LB", ar: "لبنان", en: "Lebanon" },
  { code: "LS", ar: "ليسوتو", en: "Lesotho" },
  { code: "LR", ar: "ليبيريا", en: "Liberia" },
  { code: "LY", ar: "ليبيا", en: "Libya" },
  { code: "LI", ar: "ليختنشتاين", en: "Liechtenstein" },
  { code: "LT", ar: "ليتوانيا", en: "Lithuania" },
  { code: "LU", ar: "لوكسمبورغ", en: "Luxembourg" },
  { code: "MG", ar: "مدغشقر", en: "Madagascar" },
  { code: "MW", ar: "مالاوي", en: "Malawi" },
  { code: "MY", ar: "ماليزيا", en: "Malaysia" },
  { code: "MV", ar: "المالديف", en: "Maldives" },
  { code: "ML", ar: "مالي", en: "Mali" },
  { code: "MT", ar: "مالطا", en: "Malta" },
  { code: "MH", ar: "جزر مارشال", en: "Marshall Islands" },
  { code: "MR", ar: "موريتانيا", en: "Mauritania" },
  { code: "MU", ar: "موريشيوس", en: "Mauritius" },
  { code: "MX", ar: "المكسيك", en: "Mexico" },
  { code: "FM", ar: "ميكرونيزيا", en: "Micronesia" },
  { code: "MD", ar: "مولدوفا", en: "Moldova" },
  { code: "MC", ar: "موناكو", en: "Monaco" },
  { code: "MN", ar: "منغوليا", en: "Mongolia" },
  { code: "ME", ar: "الجبل الأسود", en: "Montenegro" },
  { code: "MZ", ar: "موزمبيق", en: "Mozambique" },
  { code: "MM", ar: "ميانمار", en: "Myanmar" },
  { code: "NA", ar: "ناميبيا", en: "Namibia" },
  { code: "NR", ar: "ناورو", en: "Nauru" },
  { code: "NP", ar: "نيبال", en: "Nepal" },
  { code: "NL", ar: "هولندا", en: "Netherlands" },
  { code: "NZ", ar: "نيوزيلندا", en: "New Zealand" },
  { code: "NI", ar: "نيكاراغوا", en: "Nicaragua" },
  { code: "NE", ar: "النيجر", en: "Niger" },
  { code: "NG", ar: "نيجيريا", en: "Nigeria" },
  { code: "KP", ar: "كوريا الشمالية", en: "North Korea" },
  { code: "MK", ar: "مقدونيا الشمالية", en: "North Macedonia" },
  { code: "NO", ar: "النرويج", en: "Norway" },
  { code: "PK", ar: "باكستان", en: "Pakistan" },
  { code: "PW", ar: "بالاو", en: "Palau" },
  { code: "PS", ar: "فلسطين", en: "Palestine" },
  { code: "PA", ar: "بنما", en: "Panama" },
  { code: "PG", ar: "بابوا غينيا الجديدة", en: "Papua New Guinea" },
  { code: "PY", ar: "باراغواي", en: "Paraguay" },
  { code: "PE", ar: "بيرو", en: "Peru" },
  { code: "PH", ar: "الفلبين", en: "Philippines" },
  { code: "PL", ar: "بولندا", en: "Poland" },
  { code: "PT", ar: "البرتغال", en: "Portugal" },
  { code: "PR", ar: "بورتوريكو", en: "Puerto Rico" },
  { code: "RO", ar: "رومانيا", en: "Romania" },
  { code: "RU", ar: "روسيا", en: "Russia" },
  { code: "RW", ar: "رواندا", en: "Rwanda" },
  { code: "KN", ar: "سانت كيتس ونيفيس", en: "Saint Kitts and Nevis" },
  { code: "LC", ar: "سانت لوسيا", en: "Saint Lucia" },
  { code: "VC", ar: "سانت فنسنت والغرينادين", en: "Saint Vincent and the Grenadines" },
  { code: "WS", ar: "ساموا", en: "Samoa" },
  { code: "SM", ar: "سان مارينو", en: "San Marino" },
  { code: "ST", ar: "ساو تومي وبرينسيبي", en: "São Tomé and Príncipe" },
  { code: "SN", ar: "السنغال", en: "Senegal" },
  { code: "RS", ar: "صربيا", en: "Serbia" },
  { code: "SC", ar: "سيشل", en: "Seychelles" },
  { code: "SL", ar: "سيراليون", en: "Sierra Leone" },
  { code: "SG", ar: "سنغافورة", en: "Singapore" },
  { code: "SK", ar: "سلوفاكيا", en: "Slovakia" },
  { code: "SI", ar: "سلوفينيا", en: "Slovenia" },
  { code: "SB", ar: "جزر سليمان", en: "Solomon Islands" },
  { code: "SO", ar: "الصومال", en: "Somalia" },
  { code: "ZA", ar: "جنوب أفريقيا", en: "South Africa" },
  { code: "KR", ar: "كوريا الجنوبية", en: "South Korea" },
  { code: "SS", ar: "جنوب السودان", en: "South Sudan" },
  { code: "ES", ar: "إسبانيا", en: "Spain" },
  { code: "LK", ar: "سريلانكا", en: "Sri Lanka" },
  { code: "SD", ar: "السودان", en: "Sudan" },
  { code: "SR", ar: "سورينام", en: "Suriname" },
  { code: "SE", ar: "السويد", en: "Sweden" },
  { code: "CH", ar: "سويسرا", en: "Switzerland" },
  { code: "SY", ar: "سوريا", en: "Syria" },
  { code: "TW", ar: "تايوان", en: "Taiwan" },
  { code: "TJ", ar: "طاجيكستان", en: "Tajikistan" },
  { code: "TZ", ar: "تنزانيا", en: "Tanzania" },
  { code: "TH", ar: "تايلاند", en: "Thailand" },
  { code: "TL", ar: "تيمور الشرقية", en: "Timor-Leste" },
  { code: "TG", ar: "توغو", en: "Togo" },
  { code: "TO", ar: "تونغا", en: "Tonga" },
  { code: "TT", ar: "ترينيداد وتوباغو", en: "Trinidad and Tobago" },
  { code: "TN", ar: "تونس", en: "Tunisia" },
  { code: "TR", ar: "تركيا", en: "Türkiye" },
  { code: "TM", ar: "تركمانستان", en: "Turkmenistan" },
  { code: "TV", ar: "توفالو", en: "Tuvalu" },
  { code: "UG", ar: "أوغندا", en: "Uganda" },
  { code: "UA", ar: "أوكرانيا", en: "Ukraine" },
  { code: "GB", ar: "المملكة المتحدة", en: "United Kingdom" },
  { code: "US", ar: "الولايات المتحدة", en: "United States" },
  { code: "UY", ar: "الأوروغواي", en: "Uruguay" },
  { code: "UZ", ar: "أوزبكستان", en: "Uzbekistan" },
  { code: "VU", ar: "فانواتو", en: "Vanuatu" },
  { code: "VA", ar: "الفاتيكان", en: "Vatican City" },
  { code: "VE", ar: "فنزويلا", en: "Venezuela" },
  { code: "VN", ar: "فيتنام", en: "Vietnam" },
  { code: "YE", ar: "اليمن", en: "Yemen" },
  { code: "ZM", ar: "زامبيا", en: "Zambia" },
  { code: "ZW", ar: "زيمبابوي", en: "Zimbabwe" },

  // يبقى أخيراً دائماً: مخرج لمن لا يجد بلده، لا خياراً يُختار بالخطأ
  // لأنّه صادف موقعاً مبكّراً في القائمة.
  { code: "OTHER", ar: "أخرى", en: "Other" },
];

const BY_CODE = new Map(COUNTRIES.map((c) => [c.code, c]));

/** اسم الدولة بلغة القارئ. الرمز غير المعروف يُعاد كما هو بدل أن يختفي
 *  الصفّ - بيانات قديمة محفوظة بالاسم العربي ما زالت تُعرض مقروءةً. */
export function countryName(code: string | null | undefined, locale: "ar" | "en"): string {
  if (!code) return "";
  const c = BY_CODE.get(code);
  return c ? (locale === "ar" ? c.ar : c.en) : code;
}

/** القائمة مرتَّبةً للعرض: الأسواق المستهدَفة أوّلاً، ثمّ البقية أبجدياً
 *  بلغة القارئ نفسها (الترتيب الأبجدي العربي غيره الإنجليزي)، و«أخرى»
 *  في الذيل. */
export function countriesForDisplay(locale: "ar" | "en"): Country[] {
  const priority = PRIORITY_COUNTRY_CODES.map((code) => BY_CODE.get(code)!).filter(Boolean);
  const rest = COUNTRIES.filter(
    (c) => !PRIORITY_COUNTRY_CODES.includes(c.code) && c.code !== "OTHER",
  ).sort((a, b) => (locale === "ar" ? a.ar.localeCompare(b.ar, "ar") : a.en.localeCompare(b.en, "en")));
  return [...priority, ...rest, BY_CODE.get("OTHER")!];
}

/** حارس للمدخلات الخارجية: الحقل قائمة مغلقة، فما لا ينتمي إليها يُرفض
 *  بدل أن يُخزَّن كما وصل. */
export function isCountryCode(v: unknown): v is string {
  return typeof v === "string" && BY_CODE.has(v);
}

/**
 * تحويلُ اسم دولةٍ مكتوب بالنصّ إلى كودها.
 *
 * 🔴 **بياناتٌ قديمة تخزّن «السعودية» بدل `SA`.** صفوفٌ اتكتبت قبل ما
 * يبقى الحقلُ قائمةً مغلقة، ونتيجتُها إنّ فلترَ الدولة بيسيبها والاسمَ
 * بيظهر خام على الشاشة. الدالّة دي تُصلّحها في الكرون اليوميّ مرّةً
 * واحدة، وبتقبل الاسم بالعربية أو الإنجليزية.
 *
 * وترجع `null` لما مش عارفة - التخمينُ هنا بيحوّل صفّاً مقروءاً غلط إلى
 * صفٍّ غلط بثقة.
 */
export function countryCodeFromName(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const v = raw.trim();
  if (!v) return null;
  if (BY_CODE.has(v)) return v;
  const needle = v.toLocaleLowerCase();
  const hit = COUNTRIES.find(
    (c) => c.ar.trim().toLocaleLowerCase() === needle || c.en.trim().toLocaleLowerCase() === needle
  );
  return hit ? hit.code : null;
}
