"use client";

import { useActionState } from "react";
import { login } from "@/lib/actions";

export default function LoginForm() {
  const [state, formAction, pending] = useActionState(login, null);

  return (
    <form action={formAction} className="space-y-5">
      <div>
        <label htmlFor="code" className="label">
          Lagets kod
        </label>
        <input
          id="code"
          name="code"
          type="password"
          required
          autoFocus
          autoComplete="current-password"
          placeholder="••••••••"
          className="input text-center text-base tracking-[0.3em]"
          style={{ background: "var(--bg)", fontFamily: "var(--font-display)" }}
        />
        <p className="mt-2 text-[0.625rem] text-center" style={{ color: "var(--ink-faint)" }}>
          Tränare och föräldrar har olika koder
        </p>
      </div>
      {state?.error && (
        <p
          className="text-[0.6875rem] text-center py-2.5 px-3"
          style={{
            color: "var(--coral)",
            background: "rgba(248,113,113,0.06)",
            border: "1px solid rgba(248,113,113,0.2)",
            borderRadius: "6px",
          }}
          role="alert"
        >
          {state.error}
        </p>
      )}
      <button type="submit" disabled={pending} className="btn-primary w-full py-3 text-xs">
        {pending ? "Loggar in…" : "Till laget"}
      </button>
    </form>
  );
}
