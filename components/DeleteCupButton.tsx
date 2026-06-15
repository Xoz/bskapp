"use client";

import { useTransition } from "react";

export default function DeleteCupButton({
  action,
  cupName,
  matchCount,
}: {
  action: () => Promise<void>;
  cupName: string;
  matchCount: number;
}) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (
          confirm(
            `Ta bort "${cupName}" permanent? Alla ${matchCount} matcher, all statistik och alla händelser försvinner.`
          )
        )
          start(() => action());
      }}
      className="btn-secondary text-sm"
      style={{ color: "var(--danger)", borderColor: "var(--danger)", opacity: pending ? 0.5 : 1 }}
    >
      {pending ? "Tar bort…" : "Ta bort cup"}
    </button>
  );
}
