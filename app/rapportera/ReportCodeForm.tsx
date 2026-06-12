"use client";

import { useActionState } from "react";
import { openReport } from "@/lib/actions";

export default function ReportCodeForm() {
  const [state, formAction, pending] = useActionState(openReport, null);

  return (
    <form action={formAction} className="space-y-5">
      <div>
        <label htmlFor="code" className="label">
          Matchkod
        </label>
        <input
          id="code"
          name="code"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={6}
          required
          autoFocus
          placeholder="123456"
          className="input text-center text-xl tracking-[0.4em]"
          style={{ background: "var(--bg)", fontFamily: "var(--font-display)" }}
        />
        <p className="mt-2 text-[0.625rem] text-center" style={{ color: "var(--ink-faint)" }}>
          6 siffror
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
        {pending ? "Öppnar…" : "Öppna matchen"}
      </button>
    </form>
  );
}
