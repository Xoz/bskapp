import { forwardRef } from "react";

export interface ProgressBarProps extends React.HTMLAttributes<HTMLDivElement> {
  value: number;
  max?: number;
  tone?: "primary" | "success" | "warning" | "danger";
}

const toneColor: Record<string, string> = {
  primary: "var(--primary)",
  success: "var(--success)",
  warning: "var(--warning)",
  danger: "var(--danger)",
};

/**
 * Horisontell progress-bar med shimmer-övergång.
 *
 * @example
 * <ProgressBar value={68} max={100} />
 * <ProgressBar value={3} max={5} tone="warning" />
 */
export const ProgressBar = forwardRef<HTMLDivElement, ProgressBarProps>(
  (
    { value, max = 100, tone = "primary", className = "", ...props },
    ref
  ) => {
    const pct = Math.min(100, Math.max(0, (value / max) * 100));
    return (
      <div
        ref={ref}
        className={`progress ${className}`}
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
        {...props}
      >
        <div
          className="progress-bar"
          style={{ width: `${pct}%`, background: toneColor[tone] }}
        />
      </div>
    );
  }
);
ProgressBar.displayName = "ProgressBar";
