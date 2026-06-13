"use client";

import { useState, useEffect, useCallback } from "react";

export default function AISuggestButton({ playerId }: { playerId: number }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const suggest = useCallback(async (silent = false) => {
    setLoading(true);
    if (!silent) setError(null);

    const checked = document.querySelectorAll<HTMLInputElement>("input[name^='skill_']:checked");
    const scores: Record<string, number> = {};
    checked.forEach((input) => {
      const skillId = input.name.replace("skill_", "");
      scores[skillId] = Number(input.value);
    });

    if (Object.keys(scores).length === 0) {
      if (!silent) setError("Fyll i minst några nivåer innan du genererar förslag.");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/ai/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId, scores }),
      });

      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? "Okänt fel");
      }

      const { strengths, development_goals } = await res.json();

      const strengthsEl = document.getElementById("strengths") as HTMLTextAreaElement | null;
      const goalsEl = document.getElementById("development_goals") as HTMLTextAreaElement | null;
      if (strengthsEl) strengthsEl.value = strengths;
      if (goalsEl) goalsEl.value = development_goals;
      setDone(true);
    } catch (e) {
      if (!silent) setError(e instanceof Error ? e.message : "Något gick fel");
    } finally {
      setLoading(false);
    }
  }, [playerId]);

  // Auto-generate when the page loads
  useEffect(() => {
    suggest(true);
  }, [suggest]);

  return (
    <div>
      <button
        type="button"
        onClick={() => suggest(false)}
        disabled={loading}
        className="btn-secondary py-2 px-4 text-sm disabled:opacity-50 flex items-center gap-2"
      >
        {loading ? (
          <>
            <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
            Genererar…
          </>
        ) : (
          <>{done ? "↻ Uppdatera AI-förslag" : "✦ AI-förslag"}</>
        )}
      </button>
      {error && (
        <p className="mt-2 text-xs" style={{ color: "var(--danger)" }}>{error}</p>
      )}
    </div>
  );
}
