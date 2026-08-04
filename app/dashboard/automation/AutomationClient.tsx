// app/dashboard/automation/AutomationClient.tsx

"use client";

import { Toggle } from "@/app/components/ui/Toggle";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { RULE_TEMPLATES } from "@/lib/automationRuleDefinitions";
import { t, platformLabel, type Locale } from "@/lib/i18n/dictionary";

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



const TEMPLATES = RULE_TEMPLATES;

export function AutomationClient({ workspaceId, rules, locale = "ar" }: { workspaceId: string; rules: RuleRow[]; locale?: Locale }) {
  const tr = (k: string) => t(locale, `autoRules.${k}`);
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
          {tr("newRule")}
        </button>
      </div>

      {showTemplates && (
        <div className="mb-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
          {TEMPLATES.map((t) => (
            <button
              key={t.name}
              onClick={() => createFromTemplate(t)}
              className="rounded-2xl bg-surface p-4 text-start hover:bg-surface-raised"
            >
              <div className="mb-1 text-sm text-text-primary">{t.name}</div>
              <div className="text-xs text-text-faint">
                {tr(`m${t.metric}`)} {t.operator === "GREATER_THAN" ? ">" : "<"} {t.threshold}
              </div>
            </button>
          ))}
        </div>
      )}

      {rules.length === 0 ? (
        <div className="rounded-card border border-dashed border-border bg-surface px-8 py-12 text-center text-text-muted">
          {tr("noneYet")}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {rules.map((rule) => (
            <div key={rule.id} className="rounded-2xl bg-surface p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-text-primary">{rule.name}</div>
                  <div className="mt-1 text-xs text-text-faint">
                    {tr(`m${rule.metric}`)} {rule.operator === "GREATER_THAN" ? ">" : "<"} {rule.threshold}
                    {" → "}
                    {tr(`a${rule.action}`)}
                    {rule.actionValue ? ` ${rule.actionValue}%` : ""}
                    {rule.requireApproval && tr("approvalSuffix")}
                  </div>
                </div>
                <Toggle
                  checked={rule.enabled}
                  onChange={(v) => toggleRule(rule.id, v)}
                  label={tr("enableRule")}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
