// lib/screenshotService.ts
//
// بديل حقيقي عن Puppeteer محلي - استدعاء API خارجي بس، مفيش بنية تحتية
// إضافية نديرها. اتأكدت من التوثيق الرسمي لـ ScreenshotAPI.net مباشرة:
// 200 صورة/شهر مجاناً بدون بطاقة ائتمان.

export async function captureScreenshot(url: string): Promise<string | null> {
  const apiKey = process.env.SCREENSHOT_API_KEY;
  if (!apiKey) {
    console.warn("SCREENSHOT_API_KEY غير مضبوط - تعذّر التقاط صورة الصفحة");
    return null;
  }

  try {
    const encodedUrl = encodeURIComponent(url);
    const query =
      `https://shot.screenshotapi.net/screenshot` +
      `?token=${apiKey}&url=${encodedUrl}&output=image&file_type=png` +
      `&width=1440&height=1024`;

    const res = await fetch(query);
    if (!res.ok) {
      console.error(`فشل التقاط الصورة: ${res.status}`);
      return null;
    }

    const buffer = await res.arrayBuffer();
    return Buffer.from(buffer).toString("base64");
  } catch (err) {
    console.error("فشل التقاط صورة الصفحة:", err);
    return null;
  }
}
