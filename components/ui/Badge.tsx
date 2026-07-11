import { forwardRef } from "react";

type Tone = "primary" | "success" | "warning" | "danger" | "neutral";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
}

const toneClass: Record<Tone, string> = {
  primary: "badge-primary",
  success: "badge-success",
  warning: "badge-warning",
  danger: "badge-danger",
  neutral: "badge-neutral",
};

/**
 * Pill-badge (999px radius) med tonal färg.
 *
 * @example
 * <Badge tone="success">Vinst 5–0</Badge>
 * <Badge tone="warning">Oavgjort</Badge>
 */
export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  ({ tone = "neutral", className = "", children, ...props }, ref) => {
    return (
      <span
        ref={ref}
        className={`badge ${toneClass[tone]} ${className}`}
        {...props}
      >
        {children}
      </span>
    );
  }
);
Badge.displayName = "Badge";
