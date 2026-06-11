"use client";

import { useActionState } from "react";
import { login } from "@/lib/actions";

export default function LoginForm() {
  const [state, formAction, pending] = useActionState(login, null);

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label htmlFor="code" className="label">
          Kod
        </label>
        <input
          id="code"
          name="code"
          type="password"
          required
          autoFocus
          autoComplete="current-password"
          placeholder="Ange din kod"
          className="input text-center tracking-widest uppercase"
        />
      </div>
      {state?.error && (
        <p className="text-sm font-medium text-red-600" role="alert">
          {state.error}
        </p>
      )}
      <button type="submit" disabled={pending} className="btn-primary w-full disabled:opacity-60">
        {pending ? "Loggar in…" : "Logga in"}
      </button>
    </form>
  );
}
