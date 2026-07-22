// حالة تحميل موحّدة لصفحات الداشبورد أثناء جلب البيانات من السيرفر.
export default function Loading() {
  return (
    <div className="mx-auto max-w-4xl animate-pulse">
      <div className="mb-5 h-7 w-48 rounded-lg bg-surface-raised" />
      <div className="mb-3 h-28 rounded-2xl bg-surface" />
      <div className="grid grid-cols-2 gap-3">
        <div className="h-24 rounded-2xl bg-surface" />
        <div className="h-24 rounded-2xl bg-surface" />
      </div>
    </div>
  );
}
