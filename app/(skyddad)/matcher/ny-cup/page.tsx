"use client";

import Link from "next/link";
import { useState } from "react";
import { addCup } from "@/lib/actions";
import { LEVELS } from "@/lib/levels";
import { IconArrowLeft, IconPlus } from "@/components/Icons";

const EMPTY_MATCH = { opponent: "", date: "", time: "", home_away: "home" as const };

export default function NewCupPage() {
  const [matches, setMatches] = useState([{ ...EMPTY_MATCH }, { ...EMPTY_MATCH }, { ...EMPTY_MATCH }]);

  function addMatch() {
    setMatches((prev) => [...prev, { ...EMPTY_MATCH }]);
  }

  function removeMatch(i: number) {
    setMatches((prev) => prev.filter((_, idx) => idx !== i));
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <Link
          href="/matcher"
          className="inline-flex items-center gap-1.5 text-sm font-medium transition-colors hover:text-[var(--primary)]"
          style={{ color: "var(--ink-secondary)", fontFamily: "var(--font-display)" }}
        >
          <IconArrowLeft width={15} height={15} /> Matcher
        </Link>
        <h1 className="text-[32px] font-bold mt-2">Lägg till cup</h1>
        <p className="body-small mt-1" style={{ color: "var(--ink-secondary)" }}>
          Ange cupens gruppspelsmatcher. Slutspelsomgångar lägger du till i cup-redigeraren efter gruppspelet.
        </p>
      </div>

      <form action={addCup} className="space-y-6">
        <input type="hidden" name="match_count" value={matches.length} />

        <div className="card p-5 md:p-6 space-y-4">
          <h2 className="font-semibold">Cupinformation</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="label" htmlFor="cup_name">Cupnamn</label>
              <input id="cup_name" name="cup_name" required placeholder="t.ex. Örebro Cup" className="input" />
            </div>
            <div>
              <label className="label" htmlFor="level">Svårighetsnivå</label>
              <select id="level" name="level" className="input">
                <option value="">Ej satt</option>
                {LEVELS.map((l) => (
                  <option key={l.id} value={l.id}>{l.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="card overflow-hidden">
          <div className="px-5 md:px-6 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
            <h2 className="font-semibold">Gruppspelsmatcher</h2>
          </div>
          <div>
            {matches.map((_, i) => (
              <div
                key={i}
                className="px-5 md:px-6 py-4 space-y-3"
                style={{ borderTop: i > 0 ? "1px solid var(--border)" : undefined }}
              >
                <div className="flex items-center justify-between">
                  <p className="caption font-semibold" style={{ color: "var(--ink-muted)" }}>Match {i + 1}</p>
                  {matches.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeMatch(i)}
                      className="caption px-2 py-0.5 rounded"
                      style={{ color: "var(--ink-muted)" }}
                    >
                      Ta bort
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2 sm:col-span-1">
                    <label className="label" htmlFor={`opponent_${i}`}>Motståndare</label>
                    <input
                      id={`opponent_${i}`}
                      name={`opponent_${i}`}
                      placeholder="Laget namn"
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="label" htmlFor={`home_away_${i}`}>Plats</label>
                    <select id={`home_away_${i}`} name={`home_away_${i}`} className="input">
                      <option value="home">Hemma</option>
                      <option value="away">Borta</option>
                    </select>
                  </div>
                  <div>
                    <label className="label" htmlFor={`date_${i}`}>Datum</label>
                    <input
                      id={`date_${i}`}
                      name={`date_${i}`}
                      type="date"
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="label" htmlFor={`time_${i}`}>Avsparktid</label>
                    <input
                      id={`time_${i}`}
                      name={`time_${i}`}
                      type="time"
                      className="input"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="px-5 md:px-6 py-3" style={{ borderTop: "1px solid var(--border)" }}>
            <button
              type="button"
              onClick={addMatch}
              className="btn-secondary text-sm py-1.5"
            >
              <IconPlus width={14} height={14} /> Lägg till match
            </button>
          </div>
        </div>

        <div className="flex gap-3 flex-wrap items-center">
          <button type="submit" className="btn-primary px-6">Skapa cup</button>
          <Link href="/matcher" className="btn-secondary">Avbryt</Link>
        </div>
      </form>
    </div>
  );
}
