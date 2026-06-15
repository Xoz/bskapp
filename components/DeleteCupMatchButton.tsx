"use client";

import { useTransition } from "react";

// Säker radering av en cupmatch. type="button" så den ALDRIG kan trigga
// updateCup-formuläret (t.ex. via Enter i ett fält) – kräver explicit klick
// + bekräftelse. Server-actionen anropas imperativt.
export default function DeleteCupMatchButton({ action }: { action: () => Promise<void> }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (confirm("Ta bort matchen permanent? All statistik och alla händelser för matchen försvinner."))
          start(() => action());
      }}
      className="text-xs px-2 py-0.5 rounded transition-colors hover:underline disabled:opacity-50"
      style={{ color: "var(--danger)" }}
    >
      {pending ? "Tar bort…" : "Ta bort"}
    </button>
  );
}
