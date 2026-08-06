import type { ButtonHTMLAttributes } from "react";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  active?: boolean;
  variant?: "default" | "small";
};

export function SegButton({ active = false, variant = "default", className = "", ...props }: Props) {
  const size = variant === "small" ? "px-3 py-1.5 text-[11px]" : "py-2 text-[12.5px]";
  return (
    <button
      type="button"
      className={`flex-1 text-center rounded-[10px] font-bold border transition-colors ${size} ${
        active
          ? "bg-orange text-white border-orange"
          : "bg-paper text-ink-soft border-line"
      } ${className}`}
      {...props}
    />
  );
}

export function SubmitButton({ className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={`mt-3.5 w-full py-2.5 rounded-[10px] bg-navy text-white font-bold text-[13px] active:opacity-85 disabled:opacity-50 ${className}`}
      {...props}
    />
  );
}

export function FieldLabel({ children }: { children: React.ReactNode }) {
  return <div className="text-[11.5px] text-ink-soft mb-1.5 font-bold">{children}</div>;
}

export function inputClass(extra = "") {
  return `w-full border border-line rounded-[10px] px-2.5 py-2 font-sans text-[13px] bg-white text-ink ${extra}`;
}
