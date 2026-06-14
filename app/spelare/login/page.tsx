"use client";

import { useActionState } from "react";
import { playerLogin } from "@/lib/actions";

export default function SpelarLoginPage() {
  const [state, action, pending] = useActionState(playerLogin, null);

  return (
    <main
      className="flex min-h-svh flex-col items-center justify-center px-6"
      style={{ background: "var(--bg)" }}
    >
      <div className="w-full max-w-xs space-y-8">
        <div className="text-center">
          <h1
            className="text-2xl font-bold"
            style={{ fontFamily: "var(--font-display)", color: "var(--ink)" }}
          >
            Spelarprofil
          </h1>
          <p className="mt-2 text-sm" style={{ color: "var(--ink-soft)" }}>
            Ange din personliga PIN-kod du fått av tränaren.
          </p>
        </div>

        <form action={action} className="space-y-4">
          <div>
            <label
              htmlFor="pin"
              className="block text-[0.65rem] uppercase tracking-[0.1em] mb-1.5"
              style={{ color: "var(--ink-faint)", fontFamily: "var(--font-display)" }}
            >
              PIN-kod (6 siffror)
            </label>
            <input
              id="pin"
              name="pin"
              type="tel"
              inputMode="numeric"
              pattern="\d{6}"
              maxLength={6}
              placeholder="000000"
              required
              autoFocus
              className="input w-full text-center text-2xl tracking-[0.3em]"
              style={{ fontFamily: "var(--font-display)", fontSize: "1.5rem" }}
            />
          </div>

          {state?.error && (
            <p className="text-sm text-center" style={{ color: "var(--warn)" }}>
              {state.error}
            </p>
          )}

          <button type="submit" disabled={pending} className="btn-primary w-full">
            {pending ? "Loggar in…" : "Logga in"}
          </button>
        </form>

        <p className="text-center text-xs" style={{ color: "var(--ink-faint)" }}>
          <a href="/" style={{ color: "var(--ink-faint)" }}>← Tillbaka till start</a>
        </p>
      </div>
    </main>
  );
}
