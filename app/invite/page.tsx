"use client";

import { useActionState } from "react";
import { acceptInvite } from "@/lib/actions";

export default function InvitePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const [state, action, pending] = useActionState(acceptInvite, null);

  return (
    <main
      className="flex min-h-svh flex-col items-center justify-center px-6"
      style={{ background: "var(--bg)" }}
    >
      <div className="w-full max-w-xs space-y-8 text-center">
        <div>
          <div
            className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl text-2xl"
            style={{ background: "var(--primary-soft)", color: "var(--primary)" }}
          >
            🏟
          </div>
          <h1
            className="text-2xl font-bold"
            style={{ fontFamily: "var(--font-display)", color: "var(--ink)" }}
          >
            Tränarbehörighet
          </h1>
          <p className="mt-2 text-sm" style={{ color: "var(--ink-soft)" }}>
            Du har bjudits in som tränare. Klicka nedan för att aktivera åtkomst.
          </p>
        </div>

        <form action={action} className="space-y-4">
          <InviteTokenField searchParams={searchParams} />

          {state?.error && (
            <p className="text-sm" style={{ color: "var(--warn)" }}>
              {state.error}
            </p>
          )}

          <button type="submit" disabled={pending} className="btn-primary w-full">
            {pending ? "Aktiverar…" : "Aktivera tränarbehörighet"}
          </button>
        </form>

        <p className="text-xs" style={{ color: "var(--ink-faint)" }}>
          <a href="/" style={{ color: "var(--ink-faint)" }}>← Tillbaka till start</a>
        </p>
      </div>
    </main>
  );
}

async function InviteTokenField({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  return <input type="hidden" name="token" value={token ?? ""} />;
}
