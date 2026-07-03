"use client";

import Link from "next/link";
import { useActionState } from "react";
import { previewCupImport, importCupMatches } from "@/lib/actions";
import { LEVELS } from "@/lib/levels";
import { IconArrowLeft } from "@/components/Icons";

// Förhindra prerendering som kräver databas
export const dynamic = "force-dynamic";

export default function ImportCupPage() {
  const [state, previewAction, pending] = useActionState(previewCupImport, null);

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <Link
          href="/matcher"
          className="inline-flex items-center gap-1.5 text-sm font-medium transition-colors hover:text-[var(--primary)]"
          style={{ color: "var(--ink-soft)", fontFamily: "var(--font-display)" }}
        >
          <IconArrowLeft width={15} height={15} /> Matcher
        </Link>
        <h1 className="text-[1.7rem] font-bold mt-2">Importera cup</h1>
        <p className="text-sm mt-1" style={{ color: "var(--ink-soft)" }}>
          Klistra in lagets iCal-länk från cuparrangören (CupManager/Profixio m.fl.) så hämtas
          gruppspelsmatcherna automatiskt. Du får granska dem innan de läggs till.
        </p>
      </div>

      {/* Steg 1 – hämta */}
      <form action={previewAction} className="card p-5 md:p-6 space-y-4">
        <div>
          <label className="label" htmlFor="url">iCal-länk</label>
          <input
            id="url"
            name="url"
            type="url"
            required
            defaultValue={state?.ok ? state.url : ""}
            placeholder="https://app.rubic.no/profixio/ical.ashx?component=matches&tournamentID=…&teamID=…"
            className="input"
          />
          <p className="text-xs mt-1.5" style={{ color: "var(--ink-faint)" }}>
            Hittas oftast på cupens lagsida under &quot;Prenumerera&quot; / &quot;Lägg till i kalender&quot;.
            webcal://-länkar fungerar också.
          </p>
        </div>
        {state && !state.ok && (
          <p className="text-sm" style={{ color: "var(--warn)" }}>{state.error}</p>
        )}
        <button type="submit" disabled={pending} className="btn-secondary">
          {pending ? "Hämtar…" : state?.ok ? "Hämta igen" : "Hämta matcher"}
        </button>
      </form>

      {/* Steg 2 – granska och importera */}
      {state?.ok && (
        <form action={importCupMatches} className="space-y-6">
          <input type="hidden" name="url" value={state.url} />

          <div className="card p-5 md:p-6 space-y-4">
            <h2 className="font-semibold">Cupinformation</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="label" htmlFor="cup_name">Cupnamn</label>
                <input
                  id="cup_name"
                  name="cup_name"
                  required
                  defaultValue={state.cupName}
                  placeholder="t.ex. Sollentunacupen F2014"
                  className="input"
                />
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
            <div className="px-5 md:px-6 py-4" style={{ borderBottom: "1px solid var(--line)" }}>
              <h2 className="font-semibold">
                Hittade matcher{" "}
                <span style={{ color: "var(--ink-faint)", fontWeight: 400 }}>({state.matches.length})</span>
              </h2>
            </div>
            <div>
              {state.matches.map((m, i) => (
                <div
                  key={m.uid}
                  className="px-5 md:px-6 py-3 flex items-center justify-between gap-3"
                  style={{ borderTop: i > 0 ? "1px solid var(--line)" : undefined }}
                >
                  <div className="min-w-0">
                    <p className="font-medium truncate">
                      {m.homeAway === "home" ? "" : "Borta mot "}
                      {m.opponent}
                    </p>
                    {m.location && (
                      <p className="text-xs truncate" style={{ color: "var(--ink-faint)" }}>{m.location}</p>
                    )}
                  </div>
                  <div className="text-sm text-right shrink-0" style={{ color: "var(--ink-soft)" }}>
                    {m.date}
                    {m.time && <span style={{ color: "var(--ink-faint)" }}> · {m.time}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-3 flex-wrap items-center">
            <button type="submit" className="btn-primary px-6">
              Importera {state.matches.length} matcher
            </button>
            <Link href="/matcher" className="btn-secondary">Avbryt</Link>
          </div>
        </form>
      )}
    </div>
  );
}
