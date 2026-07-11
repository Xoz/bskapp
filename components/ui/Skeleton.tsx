import { forwardRef } from "react";

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  rounded?: boolean;
}

/**
 * Skeleton-loading med shimmer-animation.
 * Använd som platshållare medan data laddas.
 *
 * @example
 * <Skeleton style={{ width: '60%', height: 14 }} />
 * <Skeleton rounded style={{ width: 48, height: 48 }} />
 */
export const Skeleton = forwardRef<HTMLDivElement, SkeletonProps>(
  ({ rounded = false, className = "", style, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={`skeleton ${className}`}
        style={{
          borderRadius: rounded ? "var(--r-badge)" : 8,
          ...style,
        }}
        {...props}
      />
    );
  }
);
Skeleton.displayName = "Skeleton";
