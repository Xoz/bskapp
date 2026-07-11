import { forwardRef } from "react";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  hover?: boolean;
}

/**
 * Premium-kort med skugga, 18px radius och valbar hover-lift.
 *
 * @example
 * <Card hover>...</Card>
 * <Card className="p-0">...</Card>
 */
export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ hover = false, className = "", children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={`card ${hover ? "card-hover" : ""} ${className}`}
        {...props}
      >
        {children}
      </div>
    );
  }
);
Card.displayName = "Card";

export interface CardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {}

/**
 * Kort-header med bottom-border. Används inuti <Card> för att separera
 * header från body (t.ex. titel + actions ovanför en tabell).
 */
export const CardHeader = forwardRef<HTMLDivElement, CardHeaderProps>(
  ({ className = "", children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={`px-6 py-5 ${className}`}
        style={{ borderBottom: "1px solid var(--border)" }}
        {...props}
      >
        {children}
      </div>
    );
  }
);
CardHeader.displayName = "CardHeader";
