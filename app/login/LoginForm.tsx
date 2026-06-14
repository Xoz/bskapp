"use client";

import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { login } from "@/lib/actions";

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
      <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
    </svg>
  );
}

export default function LoginForm() {
  const [state, formAction, pending] = useActionState(login, null);
  const searchParams = useSearchParams();
  const googleError = searchParams.get("google_error");

  return (
    <div className="space-y-5">
      {/* Google-inloggning för tränare */}
      <div>
        <p className="label mb-2">Tränare</p>
        <a
          href="/api/auth/google"
          className="flex w-full items-center justify-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-opacity hover:opacity-85"
          style={{
            background: "var(--bg)",
            border: "1px solid var(--line)",
            color: "var(--ink)",
          }}
        >
          <GoogleIcon />
          Logga in med Google
        </a>
        {googleError === "not_allowed" && (
          <p
            className="mt-2 text-[0.6875rem] text-center py-2 px-3"
            style={{
              color: "var(--coral)",
              background: "rgba(248,113,113,0.06)",
              border: "1px solid rgba(248,113,113,0.2)",
              borderRadius: "6px",
            }}
          >
            Din e-postadress är inte godkänd. Kontakta admin.
          </p>
        )}
        {googleError === "1" && (
          <p
            className="mt-2 text-[0.6875rem] text-center py-2 px-3"
            style={{
              color: "var(--coral)",
              background: "rgba(248,113,113,0.06)",
              border: "1px solid rgba(248,113,113,0.2)",
              borderRadius: "6px",
            }}
          >
            Inloggningen misslyckades. Försök igen.
          </p>
        )}
      </div>

      {/* Divider */}
      <div className="flex items-center gap-3">
        <span className="h-px flex-1" style={{ background: "var(--line)" }} />
        <span className="text-[0.6rem] uppercase tracking-[0.1em]" style={{ color: "var(--ink-faint)" }}>
          eller tränarkod
        </span>
        <span className="h-px flex-1" style={{ background: "var(--line)" }} />
      </div>

      {/* Kodinloggning (reservmetod för tränare) */}
      <form action={formAction} className="space-y-4">
        <div>
          <label htmlFor="code" className="label">
            Tränarkod
          </label>
          <input
            id="code"
            name="code"
            type="password"
            required
            autoComplete="current-password"
            placeholder="••••••••"
            className="input text-center text-base tracking-[0.3em]"
            style={{ background: "var(--bg)", fontFamily: "var(--font-display)" }}
          />
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
        <button type="submit" disabled={pending} className="btn-secondary w-full py-3 text-xs">
          {pending ? "Loggar in…" : "Till laget"}
        </button>
      </form>
    </div>
  );
}
