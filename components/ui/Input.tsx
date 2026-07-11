import { forwardRef } from "react";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

/**
 * Input med statisk label, error och hint.
 * Använder .input + .label från globals.css.
 *
 * @example
 * <Input label="Motståndare" placeholder="IFK Stocksund" />
 * <Input label="Datum" type="date" error="Ogiltigt datum" />
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, className = "", id, ...props }, ref) => {
    const inputId = id || props.name;
    return (
      <div>
        {label && (
          <label className="label" htmlFor={inputId}>
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={`input ${className}`}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
          {...props}
        />
        {error && (
          <p
            id={`${inputId}-error`}
            className="body-small mt-2"
            style={{ color: "var(--danger)" }}
          >
            {error}
          </p>
        )}
        {!error && hint && (
          <p
            id={`${inputId}-hint`}
            className="caption mt-2"
            style={{ color: "var(--ink-muted)" }}
          >
            {hint}
          </p>
        )}
      </div>
    );
  }
);
Input.displayName = "Input";

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
}

/**
 * Textarea med label, error och hint.
 */
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, hint, className = "", id, ...props }, ref) => {
    const inputId = id || props.name;
    return (
      <div>
        {label && (
          <label className="label" htmlFor={inputId}>
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={inputId}
          className={`input ${className}`}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
          {...props}
        />
        {error && (
          <p
            id={`${inputId}-error`}
            className="body-small mt-2"
            style={{ color: "var(--danger)" }}
          >
            {error}
          </p>
        )}
        {!error && hint && (
          <p
            id={`${inputId}-hint`}
            className="caption mt-2"
            style={{ color: "var(--ink-muted)" }}
          >
            {hint}
          </p>
        )}
      </div>
    );
  }
);
Textarea.displayName = "Textarea";

export interface SelectProps
  extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  hint?: string;
}

/**
 * Select med label, error och hint.
 */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, hint, className = "", id, children, ...props }, ref) => {
    const inputId = id || props.name;
    return (
      <div>
        {label && (
          <label className="label" htmlFor={inputId}>
            {label}
          </label>
        )}
        <select
          ref={ref}
          id={inputId}
          className={`input ${className}`}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
          {...props}
        >
          {children}
        </select>
        {error && (
          <p
            id={`${inputId}-error`}
            className="body-small mt-2"
            style={{ color: "var(--danger)" }}
          >
            {error}
          </p>
        )}
        {!error && hint && (
          <p
            id={`${inputId}-hint`}
            className="caption mt-2"
            style={{ color: "var(--ink-muted)" }}
          >
            {hint}
          </p>
        )}
      </div>
    );
  }
);
Select.displayName = "Select";
