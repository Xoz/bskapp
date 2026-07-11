"use client";

import { useActionState } from "react";
import { submitSelfEval } from "@/lib/actions";

const RATINGS = [
  { value: 1, emoji: "😐", label: "Inte så kul" },
  { value: 2, emoji: "😊", label: "Det är okej" },
  { value: 3, emoji: "😄", label: "Jättekul!" },
];

const PROGRESS_RATINGS = [
  { value: 1, emoji: "😅", label: "Lite svårt" },
  { value: 2, emoji: "👍", label: "Det går bra" },
  { value: 3, emoji: "🔥", label: "Det går kanon!" },
];

const TEAM_RATINGS = [
  { value: 1, emoji: "😐", label: "Kunde vara bättre" },
  { value: 2, emoji: "😊", label: "Det är bra" },
  { value: 3, emoji: "🤝", label: "Bästa laget!" },
];

function EmojiRadio({
  name,
  options,
  defaultValue = 2,
}: {
  name: string;
  options: { value: number; emoji: string; label: string }[];
  defaultValue?: number;
}) {
  return (
    <div className="flex gap-3 flex-wrap">
      {options.map((o) => (
        <label key={o.value} className="cursor-pointer">
          <input
            type="radio"
            name={name}
            value={o.value}
            defaultChecked={o.value === defaultValue}
            className="sr-only"
          />
          <span
            className="emoji-pill flex flex-col items-center gap-1 rounded-2xl border-2 px-4 py-3 text-center transition-all select-none"
            style={{
              borderColor: "var(--border)",
              background: "var(--surface)",
              cursor: "pointer",
              minWidth: "5rem",
            }}
          >
            <span className="text-3xl">{o.emoji}</span>
            <span className="caption leading-tight" style={{ color: "var(--ink-secondary)" }}>
              {o.label}
            </span>
          </span>
        </label>
      ))}
    </div>
  );
}

export default function SelfEvalForm({ token, firstName }: { token: string; firstName: string }) {
  const [state, action, pending] = useActionState(submitSelfEval, null);

  if (state?.done) {
    return (
      <div
        className="card p-8 text-center"
        style={{ background: "var(--ok-bg)", border: "1px solid var(--ok-soft, var(--success))" }}
      >
        <p className="text-4xl mb-3">✅</p>
        <p className="font-semibold text-lg mb-1" style={{ fontFamily: "var(--font-display)" }}>
          Tack {firstName}!
        </p>
        <p className="body-small" style={{ color: "var(--ink-secondary)" }}>
          Din egenutvärdering är sparad och tränaren ser den inför ert spelarsamtal.
        </p>
      </div>
    );
  }

  return (
    <form action={action} className="card p-6 space-y-7">
      <input type="hidden" name="token" value={token} />
      <div>
        <p className="eyebrow mb-0.5">Din röst räknas</p>
        <h2 className="font-semibold text-lg">Egenutvärdering</h2>
        <p className="body-small mt-1" style={{ color: "var(--ink-secondary)" }}>
          Tränaren ser det här inför ert spelarsamtal – svara ärligt!
        </p>
      </div>

      <div>
        <p className="font-medium text-sm mb-2.5">Hur roligt tycker du fotbollen är just nu?</p>
        <EmojiRadio name="fun_rating" options={RATINGS} />
      </div>

      <div>
        <p className="font-medium text-sm mb-2.5">Hur tycker du att det går för dig som spelare?</p>
        <EmojiRadio name="progress_rating" options={PROGRESS_RATINGS} />
      </div>

      <div>
        <p className="font-medium text-sm mb-2.5">Hur trivs du i laget?</p>
        <EmojiRadio name="team_rating" options={TEAM_RATINGS} />
      </div>

      <div>
        <label className="label" htmlFor="best_at">Vad tycker du att du är bra på i fotbollen?</label>
        <textarea
          id="best_at"
          name="best_at"
          rows={2}
          className="input"
          placeholder="T.ex. passar bra, springer snabbt, försvarsspel…"
          maxLength={500}
        />
      </div>

      <div>
        <label className="label" htmlFor="want_to_improve">Vad vill du bli bättre på?</label>
        <textarea
          id="want_to_improve"
          name="want_to_improve"
          rows={2}
          className="input"
          placeholder="T.ex. skjuta mer, prata mer på plan…"
          maxLength={500}
        />
      </div>

      <div>
        <label className="label" htmlFor="note_to_coach">
          Finns det något annat du vill berätta för tränaren? <span style={{ color: "var(--ink-muted)" }}>(valfritt)</span>
        </label>
        <textarea
          id="note_to_coach"
          name="note_to_coach"
          rows={2}
          className="input"
          placeholder="Fritext – bara du och tränaren ser det här."
          maxLength={500}
        />
      </div>

      {state?.error && (
        <p className="body-small" style={{ color: "var(--danger)" }}>{state.error}</p>
      )}

      <button type="submit" disabled={pending} className="btn-primary w-full">
        {pending ? "Skickar…" : "Skicka in min egenutvärdering"}
      </button>
    </form>
  );
}
