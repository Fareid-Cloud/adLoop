// app/dashboard/tracking/tagSnippet.ts
//
// بانيةُ وسم AdLoop - **بيانات ونصّ فقط، بلا استيراد.**
//
// أُخرجت من `InstallTagPanel` لأنّ البنود الثلاثة صارت تعرض كلٌّ منها
// كتلتَها في مكانها، فتحتاجها الشاشةُ الرئيسية مباشرةً. وإبقاؤها داخل
// مكوّنٍ يعني استيراد المكوّن كلِّه لأجل نصّ.

export function buildSnippet(workspaceId: string, appUrl: string): string {
  return `<!-- AdLoop tracking tag -->
<script>
(function () {
  var WORKSPACE_ID = "${workspaceId}";
  var ENDPOINT = "${appUrl}/api/track/cta-click";

  function sessionId() {
    var id = localStorage.getItem("adloop_session_id");
    if (!id) {
      id = (crypto.randomUUID && crypto.randomUUID()) ||
           String(Date.now()) + Math.random().toString(16).slice(2);
      localStorage.setItem("adloop_session_id", id);
    }
    return id;
  }

  var CLICK_IDS = {
    gclid: "GOOGLE_ADS",
    fbclid: "META_ADS",
    ttclid: "TIKTOK_ADS",
    sc_click_id: "SNAPCHAT_ADS"
  };

  function clickInfo() {
    var p = new URLSearchParams(window.location.search);
    for (var key in CLICK_IDS) {
      var v = p.get(key);
      if (v) return { clickId: v, platform: CLICK_IDS[key] };
    }
    var savedId = localStorage.getItem("adloop_click_id");
    var savedPlatform = localStorage.getItem("adloop_click_platform");
    return savedId && savedPlatform ? { clickId: savedId, platform: savedPlatform } : null;
  }

  var info = clickInfo();
  if (info) {
    localStorage.setItem("adloop_click_id", info.clickId);
    localStorage.setItem("adloop_click_platform", info.platform);
  }

  window.trackCtaClick = function (ctaType) {
    fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workspaceId: WORKSPACE_ID,
        sessionId: sessionId(),
        gclid: info && info.platform === "GOOGLE_ADS" ? info.clickId : undefined,
        clickId: info ? info.clickId : undefined,
        clickPlatform: info ? info.platform : undefined,
        ctaType: ctaType
      }),
      keepalive: true
    });
  };
})();
</script>`;
}
