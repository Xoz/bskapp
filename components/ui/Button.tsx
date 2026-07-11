"use client";

import { forwardRef } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const variantClass: Record<Variant, string> = {
  primary: "btn-primary",
  secondary: "btn-secondary",
  ghost: "btn-ghost",
  danger: "btn-danger",
};

const sizeClass: Record<Size, string> = {
  sm: "btn-sm",
  md: "",
  lg: "btn-lg",
};

/**
 * Premium-knapp med variant, storlek och scale-animation.
 * Använder CSS-klasser från globals.css (--r-button, --t-fast).
 *
 * @example
 * <Button variant="primary" size="md">Spara</Button>
 * <Button variant="ghost" size="sm">Avbryt</Button>
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", size = "md", className = "", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={`${variantClass[variant]} ${sizeClass[size]} ${className}`}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";
