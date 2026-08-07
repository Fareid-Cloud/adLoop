"use client";

// app/components/ui/OptionGroup.tsx
//
// مجموعة خيارات متبادلة - **القاعدة العامّة، لا حلّ موضعيّ.**
//
// **القاعدة (طلب صريح من المالك):** العنوان في سطره، والخيارات تحته جنباً
// إلى جنب **بعرض واحد**. لا شيء من هذا زخرفة:
//
// - العنوان في سطر مستقلّ: وضعُه في صفّ الخيارات يجعله يبدو خياراً خامساً
//   لا عنواناً لها، ثمّ يدفعها إلى الالتفاف على الشاشات الضيّقة فيتوزّع
//   الصفّ سطرين غير متساويين.
// - العرض الواحد (`flex-1`): بلا هذا يتبع عرضُ كلّ خيار طولَ نصّه، فتقرأ
//   العينُ الفروقَ في العرض كفروقٍ في الأهمّية - و«٣ أيام» تبدو أقلّ شأناً
//   من «٣٠ يوماً» بلا سبب.
// - `basis-0`: مع `flex-1` وحده يبقى للمحتوى أثرٌ في التوزيع، فتخرج أعرضة
//   متقاربة لا متطابقة.
//
// أيّ مجموعة خيارات جديدة في المنتج تمرّ من هنا. مجموعتان مكتوبتان يدوياً
// تفترقان حتماً بعد أوّل تعديل على إحداهما.

export interface OptionItem<T extends string | number> {
  value: T;
  label: string;
  /** سطر صغير تحت العنوان - يبقى الخيار بعرضه مهما طال */
  hint?: string;
}

export function OptionGroup<T extends string | number>({
  label,
  options,
  value,
  onChange,
  size = "md",
  className = "",
}: {
  label?: string;
  options: ReadonlyArray<OptionItem<T>>;
  value: T;
  onChange: (v: T) => void;
  size?: "sm" | "md";
  className?: string;
}) {
  const pad = size === "sm" ? "px-2.5 py-1.5 text-[12px]" : "px-3 py-2 text-[12.5px]";

  return (
    <div className={className}>
      {label && <div className="mb-1.5 text-[12.5px] text-text-muted">{label}</div>}
      {/* `grid` لا `flex`: الشبكة تمنح أعمدةً متطابقة بحكم تعريفها، بينما
          `flex-1` يبقى عرضةً لأثر المحتوى.
          و`auto-fit` بحدٍّ أدنى: الخيارات الأربعة تصطفّ متساويةً على الشاشة
          الواسعة، وتلتفّ سطرين متساويين على الضيّقة بدل أن تُسحق - التناظر
          يبقى في الحالين، والعدد ليس ثابتاً في الكود. */}
      <div className="grid gap-2 [grid-template-columns:repeat(auto-fit,minmax(84px,1fr))]">
        {options.map((o) => {
          const on = o.value === value;
          return (
            <button
              key={String(o.value)}
              type="button"
              onClick={() => onChange(o.value)}
              aria-pressed={on}
              className={`rounded-xl border text-center transition-colors ${pad} ${
                on
                  ? "border-accent bg-accent/10 font-medium text-accent"
                  : "border-border bg-surface-raised text-text-muted hover:text-text-primary"
              }`}
            >
              <span className="block truncate">{o.label}</span>
              {o.hint && <span className="mt-0.5 block truncate text-[10.5px] opacity-70">{o.hint}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
