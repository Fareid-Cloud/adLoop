// app/dashboard/automation/AutomationClient.tsx

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { RULE_TEMPLATES } from "@/lib/automationRuleDefinitions";

export interface RuleRow {
  id: string;
  name: string;
  metric: string;
  operator: string;
  threshold: number;
  action: string;
  actionValue: number | null;
  enabled: boolean;
  requireApproval: boolean;
}

const METRIC_LABELS: Record<string, string> = {
  CPL_VERIFIED: "تكلفة العميل الحقيقية",
  INFLATION_RATE: "نسبة التضخيم",
  TRUE_ROAS: "العائد الحقيقي",
  UNATTRIBUTED_RATE: "نسبة المحادثات المجهولة",
  RESPONSE_TIME_MINUTES: "سرعة الرد",
  RTO_RATE: "نسبة المرتجعات",
};

const ACTION_LABELS: Record<string, string> = {
  PAUSE_CAMPAIGN: "إيقاف الحملة",
  REDUCE_BUDGET_PCT: "تقليل الميزانية",
  INCREASE_BUDGET_PCT: "زيادة الميزانية",
  SEND_ALERT_ONLY: "تنبيه فقط",
};

const TEMPLATES = RULE_TEMPLATES;

export function AutomationClient({ workspaceId, rules }: { workspaceId: string; rules: RuleRow[] }) {
  const router = useRouter();
  const [showTemplates, setShowTemplates] = useState(false);

  async function createFromTemplate(template: (typeof TEMPLATES)[number]) {
    await fetch(`/api/workspaces/${workspaceId}/automation-rules`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(template),
    });
    setShowTemplates(false);
    router.refresh();
  }

  async function toggleRule(id: string, enabled: boolean) {
    await fetch(`/api/automation-rules/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled }),
    });
    router.refresh();
  }

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <button
          onClick={() => setShowTemplates((s) => !s)}
          className="flex items-center gap-1.5 rounded-full bg-accent px-4 py-1.5 text-xs text-white"
        >
          <Plus size={14} />
          قاعدة جديدة
        </button>
      </div>

      {showTemplates && (
        <div className="mb-4 grid grid-cols-2 gap-2">
          {TEMPLATES.map((t) => (
            <button
              key={t.name}
              onClick={() => createFromTemplate(t)}
              className="rounded-2xl bg-surface p-4 text-start hover:bg-surface-raised"
            >
              <div className="mb-1 text-sm text-text-primary">{t.name}</div>
              <div className="text-xs text-text-faint">
                {METRIC_LABELS[t.metric]} {t.operator === "GREATER_THAN" ? ">" : "<"} {t.threshold}
              </div>
            </button>
          ))}
        </div>
      )}

      {rules.length === 0 ? (
        <div className="rounded-card border border-dashed border-border bg-surface px-8 py-12 text-center text-text-muted">
          لا توجد قواعد أتمتة بعد — ابدأ بقالب جاهز
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {rules.map((rule) => (
            <div key={rule.id} className="rounded-2xl bg-surface p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-text-primary">{rule.name}</div>
                  <div className="mt-1 text-xs text-text-faint">
                    {METRIC_LABELS[rule.metric]} {rule.operator === "GREATER_THAN" ? ">" : "<"} {rule.threshold}
                    {" → "}
                    {ACTION_LABELS[rule.action]}
                    {rule.actionValue ? ` ${rule.actionValue}%` : ""}
                    {rule.requireApproval && " (يحتاج موافقة)"}
                  </div>
                </div>
                <button
                  onClick={() => toggleRule(rule.id, !rule.enabled)}
                  className={`h-6 w-11 shrink-0 rounded-full transition-colors ${
                    rule.enabled ? "bg-verified" : "bg-surface-raised"
                  }`}
                >
                  <span
                    className="block rounded-full bg-white transition-transform"
                    style={{
                      height: 18, width: 18,
                      transform: rule.enabled ? "translateX(-22px)" : "translateX(-2px)",
                    }}
                  />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
