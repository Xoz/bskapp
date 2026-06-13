"use client";

import { useActionState, useEffect, useRef } from "react";
import { addManualEvent } from "@/lib/actions";
import { STAT_FIELDS } from "@/lib/stats";
import type { Player } from "@/lib/queries";

export default function ManualEventForm({
  matchId,
  players,
  periods,
}: {
  matchId: number;
  players: Player[];
  periods: number;
}) {
  const [state, formAction, pending] = useActionState(addManualEvent, null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="space-y-4">
      <input type="hidden" name="match_id" value={matchId} />

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="label">Spelare</label>
          <select name="player_id" required className="input">
            <option value="">Välj spelare…</option>
            <optgroup label="Laget">
              {players.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}{p.jersey_number != null ? ` (#${p.jersey_number})` : ""}
                </option>
              ))}
            </optgroup>
            <optgroup label="Motståndare">
              <option value="opponent">Motståndarmål</option>
            </optgroup>
          </select>
        </div>

        <div>
          <label className="label">Händelse</label>
          <select name="stat_id" required className="input">
            <option value="">Välj typ…</option>
            {STAT_FIELDS.map((f) => (
              <option key={f.id} value={f.id}>{f.label}</option>
            ))}
            <option value="opponent_goal">Mål motståndare</option>
          </select>
        </div>

        <div>
          <label className="label">Period</label>
          <select name="period" className="input">
            <option value="">Ingen angiven</option>
            {Array.from({ length: periods }, (_, i) => i + 1).map((p) => (
              <option key={p} value={p}>Period {p}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="label">Tid (frivilligt)</label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              name="minutes"
              min="0"
              max="99"
              placeholder="00"
              className="input w-20 text-center"
              aria-label="Minuter"
            />
            <span style={{ color: "var(--ink-faint)" }}>:</span>
            <input
              type="number"
              name="seconds"
              min="0"
              max="59"
              placeholder="00"
              className="input w-20 text-center"
              aria-label="Sekunder"
            />
            <span className="text-xs" style={{ color: "var(--ink-faint)" }}>min : sek</span>
          </div>
        </div>
      </div>

      {state?.error && (
        <p className="text-sm" style={{ color: "var(--danger)" }}>{state.error}</p>
      )}
      {state?.ok && (
        <p className="text-sm" style={{ color: "var(--ok)" }}>Händelse tillagd!</p>
      )}

      <button type="submit" disabled={pending} className="btn-primary disabled:opacity-50">
        {pending ? "Sparar…" : "Lägg till händelse"}
      </button>
    </form>
  );
}
