import type { ButtonHTMLAttributes } from "react";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  active?: boolean;
  variant?: "default" | "small";
};

export function SegButton({ active = false, variant = "default", className = "", style, ...props }: Props) {
  const size = variant === "small" ? "px-3 py-1.5 text-[11px]" : "py-2 text-[12.5px]";
  return (
    <button
      type="button"
      className={`flex-1 text-center rounded-lg font-bold border transition-colors ${size} ${
        active ? "text-white border-orange" : "bg-paper text-ink-soft border-line"
      } ${className}`}
      style={
        active
          ? {
              // SubmitButtonと同じ135deg・濃い色→薄い色のグラデーション。
              background:
                "linear-gradient(135deg, color-mix(in srgb, var(--orange) 100%, black 18%) 0%, var(--orange) 100%)",
              ...style,
            }
          : style
      }
      {...props}
    />
  );
}

// 表/グラフなど、軽い表示切替のための下線タブ。SegButtonよりも主張を抑えたい箇所で使う。
export function TextTab({
  active = false,
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      type="button"
      className={`text-[12.5px] font-bold pb-1 border-b-2 transition-colors ${
        active ? "text-orange border-orange" : "text-ink-soft border-transparent"
      } ${className}`}
      {...props}
    />
  );
}

// アプリ全体のPrimary Action(フォーム送信・保存等)用ボタン。MASTER SPEC #22
// 「Primary: teamPrimary、team未設定: Brand Blue」に合わせ、--orange(teamPrimaryの
// エイリアス、未設定時はBrand Blueにfallback)を使う。
export function SubmitButton({
  className = "",
  style,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={`mt-3.5 w-full py-2.5 rounded-lg text-white font-bold text-[13px] active:opacity-85 disabled:opacity-50 ${className}`}
      style={{
        // 濃い色→薄い色(左上が濃く、右下にいくほど薄くなる)の見本。135degはヘッダーの105degより
        // 対角線に近い、より急な角度。
        background: "linear-gradient(135deg, color-mix(in srgb, var(--orange) 100%, black 18%) 0%, var(--orange) 100%)",
        ...style,
      }}
      {...props}
    />
  );
}

export function FieldLabel({ children }: { children: React.ReactNode }) {
  return <div className="text-[11.5px] text-ink-soft mb-1.5 font-bold">{children}</div>;
}

export function inputClass(extra = "") {
  // MASTER SPECIFICATION Visual Refresh: focus/disabled/readOnlyのVisual Stylingを
  // 既存Design Token(--orange/--paper/--ink-soft)で補完する。focusはring(box-shadow)を
  // 使うためレイアウト寸法(width/height/padding)には影響しない。disabled/readOnlyは
  // 編集可能欄と視覚的に区別できるよう--paper(中立surface token)を背景に使う。
  // disabledは操作不可を示すため文字色も--ink-softへ落とし、readOnlyは内容の可読性を
  // 保つため文字色は--ink(通常色)のまま background だけを変える。
  return `w-full border border-line rounded-lg px-2.5 py-2 font-sans text-[13px] bg-white text-ink transition-colors focus:outline-none focus:border-orange focus:ring-2 focus:ring-orange/20 disabled:bg-paper disabled:text-ink-soft read-only:bg-paper ${extra}`;
}
