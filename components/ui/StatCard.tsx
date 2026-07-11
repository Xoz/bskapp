import { forwardRef } from "react";

export interface StatCardProps extends React.HTMLAttributes<HTMLDivElement> {
  label: string;
  value: React.ReactNode;
  accent?: boolean;
  delta?: {
    value: string;
    direction: "up" | "down";
  };
}

/**
 * KPI-stat-kort med label, stort värde och valbar delta-indikator.
 *
 * @example
 * <StatCard label="Spelare" value="18" accent delta={{ value: "↑ 2 nya", direction: "up" }} />
 * <StatCard label="Mål" value="47" />
 */
export const StatCard = forwardRef<HTMLDivElement, StatCardProps>(
  (
    { label, value, accent = false, delta, className = "", ...props },
    ref
  ) => {
    return (
      <div
        ref={ref}
        className={`stat-card ${className}`}
        {...props}
      >
        <div className="stat-label">{label}</div>
        <div className={`stat-value stat ${accent ? "accent" : ""}`}>
          {value}
        </div>
        {delta && (
          <div className={`stat-delta ${delta.direction}`}>
            {delta.value}
          </div>
        )}
      </div>
    );
  }
);
StatCard.displayName = "StatCard";
