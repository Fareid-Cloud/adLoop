// app/dashboard/site-scan/DeepScanClient.tsx

"use client";

import { useState, useEffect, useRef } from "react";
import { Search, Plus, X, Loader2, Printer } from "lucide-react";

interface ScanRecord {
  id: string;
  status: "PENDING" | "RUNNING" | "COMPLETED" | "FAILED";
  overallScore: number | null;
  technicalSEOScore: number | null;
  domainTrustScore: number | null;
  performanceScore: number | null;
  visualScore: number | null;
  errorMessage: string | null;
  fullReport: any;
}

interface PastScan {
  id: string;
  url: string;
  overallScore: number | null;
  scannedAt: string;
}

export function DeepScanClient({ workspaceId, pastScans }: { workspaceId: string; pastScans: PastScan[] }) {
  const [url, setUrl] = useState("");
  const [suggestedUrls, setSuggestedUrls] = useState<string[]>([]);
  const [competitorUrls, setCompetitorUrls] = useState<string[]>([]);
  const [newCompetitor, setNewCompetitor] = useState("");
  const [scanId, setScanId] = useState<string | null>(null);
  const [scan, setScan] = useState<ScanRecord | null>(null);
  const [starting, setStarting] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // بنجيب روابط الوجهة الفعلية (Final URLs) من الإعلانات المزامنة فعلياً -
  // اقتراح تلقائي بدل ما المستخدم يكتب يدوي، لكن الحقل يفضل قابل للتعديل
  // بالكامل (datalist مش select - المستخدم يقدر يكتب أي رابط تاني برضو)
  useEffect(() => {
    fetch(`/api/workspaces/${workspaceId}/final-urls`)
      .then((res) => (res.ok ? res.json() : { urls: [] }))
      .then((data) => {
        setSuggestedUrls(data.urls ?? []);
        // لو فيه رابط واحد بس مقترح ومفيش حاجة متكتوبة، نملاه تلقائياً -
        // لسه المستخدم يقدر يمسحه أو يغيّره عادي
        if (data.urls?.length === 1 && !url) setUrl(data.urls[0]);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId]);

  async function startScan(e: React.FormEvent) {
    e.preventDefault();
    setStarting(true);
    setScan(null);

    const res = await fetch("/api/site-scan/deep", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspaceId, url, competitorUrls }),
    });

    if (res.ok) {
      const data = await res.json();
      setScanId(data.scanId);
    }
    setStarting(false);
  }

  useEffect(() => {
    if (!scanId) return;

    pollRef.current = setInterval(async () => {
      const res = await fetch(`/api/site-scan/${scanId}`);
      if (res.ok) {
        const data = await res.json();
        setScan(data);
        if (data.status === "COMPLETED" || data.status === "FAILED") {
          if (pollRef.current) clearInterval(pollRef.current);
        }
      }
    }, 4000); // كل 4 ثواني - كافي، مش إغراق السيرفر بطلبات

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [scanId]);

  const isRunning = scan?.status === "PENDING" || scan?.status === "RUNNING";

  async function viewPastScan(id: string) {
    const res = await fetch(`/api/site-scan/${id}`);
    if (res.ok) {
      setScan(await res.json());
      setScanId(id);
    }
  }

  return (
    <div>
      <form onSubmit={startScan} className="mb-4 rounded-2xl bg-surface p-5">
        <input
          type="url"
          list="final-urls-suggestions"
          placeholder="https://example.com/landing-page"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          required
          className="mb-1 w-full rounded-xl bg-surface-raised px-3 py-2.5 text-sm text-text-primary outline-none"
        />
        <datalist id="final-urls-suggestions">
          {suggestedUrls.map((u) => (
            <option key={u} value={u} />
          ))}
        </datalist>
        {suggestedUrls.length > 0 && (
          <p className="mb-3 text-[10px] text-text-faint">
            مقترحة تلقائياً من روابط إعلاناتك الفعلية (Final URLs) - تقدر تعدّلها بحرية
          </p>
        )}
        {suggestedUrls.length === 0 && <div className="mb-3" />}

        <div className="mb-3">
          <div className="mb-1.5 text-xs text-text-faint">منافسين للمقارنة (اختياري، لحد 2)</div>
          {competitorUrls.map((c, i) => (
            <div key={i} className="mb-1.5 flex items-center gap-2">
              <span className="flex-1 truncate text-xs text-text-muted">{c}</span>
              <button
                type="button"
                onClick={() => setCompetitorUrls(competitorUrls.filter((_, idx) => idx !== i))}
                className="text-text-faint hover:text-critical"
              >
                <X size={13} />
              </button>
            </div>
          ))}
          {competitorUrls.length < 2 && (
            <div className="flex gap-2">
              <input
                type="url"
                placeholder="رابط منافس"
                value={newCompetitor}
                onChange={(e) => setNewCompetitor(e.target.value)}
                className="flex-1 rounded-xl bg-surface-raised px-3 py-2 text-xs text-text-primary outline-none"
              />
              <button
                type="button"
                onClick={() => {
                  if (newCompetitor) {
                    setCompetitorUrls([...competitorUrls, newCompetitor]);
                    setNewCompetitor("");
                  }
                }}
                className="flex items-center gap-1 rounded-xl bg-surface-raised px-3 text-xs text-text-muted"
              >
                <Plus size={13} />
                إضافة
              </button>
            </div>
          )}
        </div>

        <button
          type="submit"
          disabled={starting || isRunning}
          className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-accent py-2.5 text-sm text-white disabled:opacity-50"
        >
          {isRunning ? (
            <>
              <Loader2 size={15} className="animate-spin" />
              جارٍ الفحص العميق... (ممكن ياخد دقيقة تقريباً)
            </>
          ) : (
            <>
              <Search size={15} />
              ابدأ الفحص العميق
            </>
          )}
        </button>
      </form>

      {pastScans.length > 0 && !scan && (
        <div className="mb-4">
          <div className="mb-2 text-xs text-text-faint">فحوصات سابقة</div>
          <div className="flex flex-col gap-1">
            {pastScans.map((p) => (
              <button
                key={p.id}
                onClick={() => viewPastScan(p.id)}
                className="flex items-center justify-between rounded-xl bg-surface px-3.5 py-2.5 text-start text-xs text-text-muted hover:bg-surface-raised"
              >
                <span className="truncate">{p.url}</span>
                <span className="ms-2 flex shrink-0 items-center gap-2">
                  <span className="font-mono text-verified">{p.overallScore}</span>
                  <span>{new Date(p.scannedAt).toLocaleDateString("ar")}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {scan?.status === "FAILED" && (
        <div className="mb-4 rounded-2xl bg-critical/10 p-4 text-sm text-critical">
          فشل الفحص: {scan.errorMessage}
        </div>
      )}

      {scan?.status === "COMPLETED" && scan.fullReport && (
        <ScanResults report={scan.fullReport} scores={scan} scanId={scanId!} />
      )}
    </div>
  );
}

function ScanResults({ report, scores, scanId }: { report: any; scores: ScanRecord; scanId: string }) {
  const { primary, synthesis, competitorComparison } = report;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <a
          href={`/api/site-scan/${scanId}/print`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 rounded-full bg-surface px-4 py-1.5 text-xs text-text-muted no-underline hover:text-text-primary"
        >
          <Printer size={13} />
          تقرير قابل للطباعة
        </a>
      </div>

      {/* الدرجات العامة */}
      <div className="grid grid-cols-4 gap-2">
        <ScoreCard label="الإجمالي" score={scores.overallScore} large />
        <ScoreCard label="SEO تقني" score={scores.technicalSEOScore} />
        <ScoreCard label="ثقة الدومين" score={scores.domainTrustScore} />
        <ScoreCard label="الأداء" score={scores.performanceScore} />
      </div>

      {/* الملخص التنفيذي */}
      <div className="rounded-2xl bg-accent-dim p-4 text-sm text-text-primary">
        <strong className="text-accent">الملخص التنفيذي: </strong>
        {synthesis.executiveSummary}
      </div>

      {/* Core Web Vitals - أداء حقيقي من PageSpeed */}
      {primary.performance && (
        <div className="rounded-2xl bg-surface p-4">
          <div className="mb-3 text-sm font-medium text-text-primary">مؤشرات الأداء الأساسية (Core Web Vitals)</div>
          <div className="grid grid-cols-4 gap-2 text-center">
            <VitalStat label="LCP" value={primary.performance.coreWebVitals.lcp} unit="ث" good={2.5} />
            <VitalStat label="CLS" value={primary.performance.coreWebVitals.cls} unit="" good={0.1} />
            <VitalStat label="FCP" value={primary.performance.coreWebVitals.fcp} unit="ث" good={1.8} />
            <VitalStat label="TBT" value={primary.performance.coreWebVitals.tbt} unit="مث" good={200} />
          </div>
          {primary.performance.topOpportunities.length > 0 && (
            <div className="mt-3">
              <div className="mb-1 text-xs text-text-faint">أهم فرص التحسين (من Lighthouse مباشرة):</div>
              {primary.performance.topOpportunities.map((op: string, i: number) => (
                <p key={i} className="text-xs text-text-muted">• {op}</p>
              ))}
            </div>
          )}
        </div>
      )}

      {/* مشاكل مركّبة */}
      {synthesis.compoundingIssues.length > 0 && (
        <Section title="مشاكل مركّبة">
          {synthesis.compoundingIssues.map((issue: any, i: number) => (
            <div
              key={i}
              className={`mb-2 rounded-xl p-3 text-xs ${
                issue.severity === "HIGH" ? "bg-critical/10 text-critical" : "bg-gap/10 text-gap"
              }`}
            >
              <strong>{issue.categories.join(" + ")}</strong>
              <p className="mt-1 text-text-muted">{issue.explanation}</p>
            </div>
          ))}
        </Section>
      )}

      {/* الأسباب الجذرية */}
      {synthesis.rootCauses.length > 0 && (
        <Section title="الأسباب الجذرية">
          {synthesis.rootCauses.map((rc: any, i: number) => (
            <div key={i} className="mb-2 rounded-xl bg-surface-raised p-3 text-xs">
              <strong className="text-text-primary">{rc.rootCause}</strong>
              <p className="text-text-faint">يظهر في: {rc.manifestsIn.join("، ")}</p>
              <p className="mt-1 text-text-muted">{rc.explanation}</p>
            </div>
          ))}
        </Section>
      )}

      {/* خارطة طريق مرتّبة */}
      <Section title="خارطة طريق الإصلاح المرتّبة">
        {synthesis.prioritizedRoadmap
          .sort((a: any, b: any) => a.rank - b.rank)
          .map((action: any) => (
            <div key={action.rank} className="mb-2 flex gap-3">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface-raised text-xs font-bold text-text-primary">
                {action.rank}
              </div>
              <div>
                <div className="text-sm text-text-primary">{action.action}</div>
                <div className="text-xs text-text-faint">{action.reasoning}</div>
              </div>
            </div>
          ))}
      </Section>

      {/* مقارنة المنافسين */}
      {competitorComparison && (
        <Section title="مقارنة بالمنافسين">
          <p className="text-sm text-text-primary">{competitorComparison}</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {report.competitors.map((c: any, i: number) => (
              <div key={i} className="rounded-xl bg-surface-raised p-3">
                <div className="truncate text-xs text-text-faint">{c.url}</div>
                <div className="font-mono text-lg text-text-primary">{c.overallScore}</div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {report.failedCompetitors?.length > 0 && (
        <div className="rounded-2xl bg-gap/10 p-3 text-xs text-gap">
          تعذّر فحص: {report.failedCompetitors.join("، ")} — الرابط ممكن يكون غير متاح أو محمي.
        </div>
      )}
    </div>
  );
}

function ScoreCard({ label, score, large }: { label: string; score: number | null; large?: boolean }) {
  return (
    <div className="rounded-2xl bg-surface p-3 text-center">
      <div className={`font-mono ${large ? "text-2xl" : "text-lg"} text-verified`}>{score ?? "—"}</div>
      <div className="text-[10px] text-text-faint">{label}</div>
    </div>
  );
}

function VitalStat({ label, value, unit, good }: { label: string; value: number | null; unit: string; good: number }) {
  const isGood = value !== null && value <= good;
  return (
    <div>
      <div className={`font-mono text-sm ${value === null ? "text-text-faint" : isGood ? "text-verified" : "text-gap"}`}>
        {value ?? "—"}{unit}
      </div>
      <div className="text-[10px] text-text-faint">{label}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 text-sm font-medium text-text-primary">{title}</div>
      {children}
    </div>
  );
}
