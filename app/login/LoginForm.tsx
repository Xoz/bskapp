"use client";

import { useActionState } from "react";
import { login } from "@/lib/actions";

export default function LoginForm() {
  const [state, formAction, pending] = useActionState(login, null);

  return (
    <form action={formAction} className="space-y-5">
      <div>
        <label
          htmlFor="code"
          className="block text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-white/55 mb-2"
          style={{ fontFamily: "var(--font-display)" }}
        >
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
          className="w-full rounded-xl px-4 py-3.5 text-center text-lg tracking-[0.3em] text-white outline-none transition-all"
          style={{
            background: "rgba(0,0,0,0.25)",
            border: "1px solid rgba(255,255,255,0.15)",
            fontFamily: "var(--font-display)",
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = "var(--accent)";
            e.currentTarget.style.boxShadow = "0 0 0 3px color-mix(in srgb, var(--accent), transparent 80%)";
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = "rgba(255,255,255,0.15)";
            e.currentTarget.style.boxShadow = "none";
          }}
        />
        <p className="mt-2 text-xs text-white/40 text-center">
          Tränare och föräldrar har olika koder
        </p>
      </div>
      {state?.error && (
        <p
          className="text-sm font-medium text-center rounded-xl py-2.5 px-3"
          style={{ color: "#fecaca", background: "rgba(185,28,28,0.25)", border: "1px solid rgba(252,165,165,0.25)" }}
          role="alert"
        >
          {state.error}
        </p>
      )}
      <button type="submit" disabled={pending} className="btn-accent w-full py-3.5 text-base disabled:opacity-60">
        {pending ? "Loggar in…" : "Till laget"}
      </button>
    </form>
  );
}
