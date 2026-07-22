// app/components/PasswordRequirements.tsx

"use client";

interface Rule {
  label: string;
  test: (pw: string) => boolean;
}

const RULES: Rule[] = [
  { label: "8 أحرف على الأقل", test: (pw) => pw.length >= 8 },
  { label: "حرف كبير (A-Z)", test: (pw) => /[A-Z]/.test(pw) },
  { label: "حرف صغير (a-z)", test: (pw) => /[a-z]/.test(pw) },
  { label: "رقم (0-9)", test: (pw) => /[0-9]/.test(pw) },
  { label: "رمز (!@#$...)", test: (pw) => /[^a-zA-Z0-9]/.test(pw) },
];

export function PasswordRequirements({ password }: { password: string }) {
  return (
    <div style={{ marginBottom: 12, fontSize: 12 }}>
      {RULES.map((rule) => {
        const passed = rule.test(password);
        return (
          <div
            key={rule.label}
            style={{
              color: passed ? "#3FB950" : "var(--text-faint, #9AA1B0)",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <span>{passed ? "✓" : "○"}</span>
            <span>{rule.label}</span>
          </div>
        );
      })}
    </div>
  );
}
