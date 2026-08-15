import { inputClass } from "@/components/ui/SegButton";
import { formatFullDateLabel } from "@/lib/format";

function pad(n: number) {
  return String(n).padStart(2, "0");
}

// 実際の日付(年入り)を1つのselect(スクロール)で選べるようにする。過去2年分をカバーしておけば、
// 編集時に既存の日報の日付が選択肢から外れることはまず無い。
export const DATE_OPTIONS: { value: string; label: string }[] = (() => {
  const options: { value: string; label: string }[] = [];
  const today = new Date();
  for (let i = 730; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const value = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    options.push({ value, label: formatFullDateLabel(value) });
  }
  return options;
})();

export function DateSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  // 編集対象の日付が選択肢の範囲外(2年より前)だった場合に備えて、無ければ選択肢に足しておく。
  const options = DATE_OPTIONS.some((o) => o.value === value)
    ? DATE_OPTIONS
    : [{ value, label: formatFullDateLabel(value) }, ...DATE_OPTIONS];
  return (
    <select className={inputClass()} value={value} onChange={(e) => onChange(e.target.value)}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
