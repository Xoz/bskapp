"use client";

import { forwardRef } from "react";

export interface IconButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
}

/**
 * Kvadratisk ikon-knapp (36×36) med tooltip via aria-label.
 *
 * @example
 * <IconButton label="Redigera" onClick={...}>✏</IconButton>
 */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ label, className = "", children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        aria-label={label}
        title={label}
        className={`icon-btn ${className}`}
        {...props}
      >
        {children}
      </button>
    );
  }
);
IconButton.displayName = "IconButton";
