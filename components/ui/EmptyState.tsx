import { forwardRef } from "react";

export interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  icon?: React.ReactNode;
  title: string;
  body?: string;
  action?: React.ReactNode;
}

/**
 * Empty state med ikon, titel, beskrivning och valbar CTA.
 * Ersätter de ~6 ad-hoc dashed-box-patterns i appen.
 *
 * @example
 * <EmptyState icon={<IconPlus />} title="Inga matcher ännu" body="Skapa din första match." action={<Button>Ny match</Button>} />
 */
export const EmptyState = forwardRef<HTMLDivElement, EmptyStateProps>(
  (
    { icon, title, body, action, className = "", ...props },
    ref
  ) => {
    return (
      <div
        ref={ref}
        className={`flex flex-col items-center justify-center text-center ${className}`}
        style={{
          padding: "40px 24px",
          borderRadius: "var(--r-card)",
          border: "1px solid var(--border)",
          background: "var(--surface)",
        }}
        {...props}
      >
        {icon && (
          <div
            className="flex items-center justify-center"
            style={{
              width: 48,
              height: 48,
              borderRadius: "var(--r-badge)",
              background: "var(--elevated)",
              color: "var(--ink-muted)",
              marginBottom: 16,
            }}
          >
            {icon}
          </div>
        )}
        <h5 style={{ marginBottom: body ? 4 : 0 }}>{title}</h5>
        {body && (
          <p className="body-small" style={{ color: "var(--ink-secondary)" }}>
            {body}
          </p>
        )}
        {action && <div style={{ marginTop: 16 }}>{action}</div>}
      </div>
    );
  }
);
EmptyState.displayName = "EmptyState";
