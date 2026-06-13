"use client";

import { useState } from "react";

export default function AISuggestButton({ playerId }: { playerId: number }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function suggest() {
    setLoading(true);
    setError(null);

    // Läs alla checkade skill-radioknappar från formuläret
    const checked = document.querySelectorAll<HTMLInputElement>("input[name^='skill_']:checked");
    const scores: Record<string, number> = {};
    checked.forEach((input) => {
      const skillId = input.name.replace("skill_", "");
      scores[skillId] = Number(input.value);
    });

    if (Object.keys(scores).length === 0) {
      setError("Fyll i minst några nivåer innan du genererar förslag.");
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
    } catch (e) {
      setError(e instanceof Error ? e.message : "Något gick fel");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={suggest}
        disabled={loading}
        className="btn-secondary py-2 px-4 text-sm disabled:opacity-50 flex items-center gap-2"
      >
        {loading ? (
          <>
            <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
            Genererar…
          </>
        ) : (
          <>✦ AI-förslag</>
        )}
      </button>
      {error && (
        <p className="mt-2 text-xs" style={{ color: "var(--danger)" }}>{error}</p>
      )}
    </div>
  );
}
