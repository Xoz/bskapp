"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { saveTreeConversation } from "@/lib/treeConversationActions";
import type { TreePreparation } from "@/lib/treeConversation";

type Fields = {
  date: string;
  outcome: string;
  note: string;
  perspective: string;
  agreement: string;
  followUp: string;
};
type Draft = {
  fields: Fields;
  preparation: TreePreparation;
  id: string;
  pending: boolean;
  updated: number;
};
export default function TreeConversationForm({
  playerId,
  scope,
  today,
  preparation,
}: {
  playerId: number;
  scope: string;
  today: string;
  preparation: TreePreparation;
}) {
  const router = useRouter();
  const key = `bsk-tree-conversation:${scope}:${playerId}`;
  const [draft, setDraft] = useState<Draft>({
    fields: {
      date: today,
      outcome: "",
      note: "",
      perspective: "",
      agreement: "",
      followUp: "",
    },
    preparation,
    id: "",
    pending: false,
    updated: 0,
  });
  const [ready, setReady] = useState(false),
    [busy, setBusy] = useState(false),
    [saved, setSaved] = useState(false);
  const [notice, setNotice] = useState("");
  const lock = useRef(false);
  useEffect(() => {
    let initial: Draft = {
      fields: {
        date: today,
        outcome: "",
        note: "",
        perspective: "",
        agreement: "",
        followUp: "",
      },
      preparation,
      id: crypto.randomUUID(),
      pending: false,
      updated: Date.now(),
    };
    try {
      const cached = JSON.parse(localStorage.getItem(key) || "null");
      if (
        typeof cached?.id === "string" &&
        [
          "date",
          "outcome",
          "note",
          "perspective",
          "agreement",
          "followUp",
        ].every((field) => typeof cached.fields?.[field] === "string") &&
        typeof cached.preparation?.summary === "string" &&
        Array.isArray(cached.preparation?.focus) &&
        typeof cached.pending === "boolean" &&
        Date.now() - cached.updated >= 0 &&
        Date.now() - cached.updated < 7 * 86400000
      ) {
        initial = cached;
        setNotice("Ditt utkast är återställt.");
      } else localStorage.removeItem(key);
    } catch {
      /* Use a new draft. */
    }
    setDraft(initial);
    setReady(true);
  }, [key]);
  function store(next: Draft) {
    setDraft(next);
    try {
      localStorage.setItem(
        key,
        JSON.stringify({ ...next, updated: Date.now() }),
      );
    } catch {
      setNotice(
        "Behåll sidan öppen tills samtalet är sparat; lokal lagring är inte tillgänglig.",
      );
    }
  }
  function change(patch: Partial<Fields>) {
    store({ ...draft, fields: { ...draft.fields, ...patch } });
  }
  async function save() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setNotice("");
    store({ ...draft, pending: true });
    const form = new FormData();
    form.set("command_id", draft.id);
    form.set("checkpoint_id", draft.preparation.checkpointId || "");
    form.set("conversation_date", draft.fields.date);
    form.set("outcome", draft.fields.outcome);
    form.set("note", draft.fields.note);
    form.set("player_perspective", draft.fields.perspective);
    form.set("agreed_actions", draft.fields.agreement);
    form.set("follow_up_on", draft.fields.followUp);
    try {
      const result = await saveTreeConversation(playerId, form);
      if (result.saved) {
        try {
          localStorage.removeItem(key);
        } catch {
          /* Saved on server. */
        }
        setSaved(true);
        router.refresh();
      } else {
        store({ ...draft, pending: false });
        setNotice(result.error || "Kunde inte spara.");
      }
    } catch {
      setNotice(
        "Svaret kom inte fram. Försök spara igen; samma sparförsök används så att samtalet inte dubbleras.",
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  function startNew() {
    try {
      localStorage.removeItem(key);
    } catch {}
    setDraft({
      fields: {
        date: today,
        outcome: "",
        note: "",
        perspective: "",
        agreement: "",
        followUp: "",
      },
      preparation,
      id: crypto.randomUUID(),
      pending: false,
      updated: Date.now(),
    });
    setSaved(false);
    setNotice("");
  }
  if (saved)
    return (
      <div className="mt-4 space-y-3">
        <p role="status" className="body-small">
          Samtalet är sparat i spelarens historik nedan.
        </p>
        <button
          type="button"
          className="btn-secondary btn-sm"
          onClick={startNew}
        >
          Nytt samtal
        </button>
      </div>
    );
  return (
    <form
      className="space-y-4 mt-5"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      {notice && <p role="status">{notice}</p>}
      {ready &&
        !busy &&
        !draft.pending &&
        (draft.fields.outcome ||
          draft.fields.note ||
          draft.fields.perspective ||
          draft.preparation.checkpointId !== preparation.checkpointId) && (
          <button
            type="button"
            className="text-sm underline"
            onClick={startNew}
          >
            Börja om med senaste trädbilden
          </button>
        )}
      <h3 className="font-semibold">Underlag från utvecklingsträdet</h3>
      <p className="body-small whitespace-pre-wrap">
        {draft.preparation.summary}
      </p>
      <p className="body-small">
        Börja med att fråga: Vad känns bra, och vad vill du bli tryggare med?
      </p>
      {!draft.preparation.focus.length && (
        <a
          className="btn-secondary btn-sm"
          href={`/spelare/${playerId}/utveckling/avstamning`}
        >
          Välj fokus i trädet
        </a>
      )}
      <fieldset
        disabled={!ready || busy || draft.pending}
        className="space-y-4"
      >
        <legend className="font-semibold mb-2">Efter samtalet</legend>
        <p className="caption">
          Välj det som stämmer. Du behöver inte skriva en sammanfattning.
        </p>
        {[
          ["continue", "Vi fortsätter med valt fokus"],
          ["custom", "Vi kom överens om något annat"],
          ["none", "Ingen ny överenskommelse"],
        ].map(([value, label]) => (
          <label className="flex gap-3 items-center py-2" key={value}>
            <input
              type="radio"
              name="outcome"
              value={value}
              checked={draft.fields.outcome === value}
              disabled={value === "continue" && !draft.preparation.focus.length}
              required
              onChange={() => change({ outcome: value })}
            />
            {label}
          </label>
        ))}
        {draft.fields.outcome === "custom" && (
          <label className="block">
            <span className="label">Nytt nästa steg</span>
            <textarea
              className="input"
              rows={3}
              required
              maxLength={4000}
              value={draft.fields.agreement}
              onChange={(e) => change({ agreement: e.target.value })}
            />
          </label>
        )}
        <details>
          <summary className="cursor-pointer py-2">
            Frivillig notering, spelarens ord och datum
          </summary>
          <div className="space-y-3 mt-3">
            <label className="block">
              <span className="label">Extra notering</span>
              <textarea
                className="input"
                rows={2}
                maxLength={1000}
                value={draft.fields.note}
                onChange={(e) => change({ note: e.target.value })}
              />
            </label>
            <label className="block">
              <span className="label">Spelarens egna ord</span>
              <textarea
                className="input"
                rows={2}
                maxLength={4000}
                value={draft.fields.perspective}
                onChange={(e) => change({ perspective: e.target.value })}
              />
            </label>
            <label className="block">
              <span className="label">Samtalsdatum</span>
              <input
                className="input"
                type="date"
                required
                value={draft.fields.date}
                onChange={(e) => change({ date: e.target.value })}
              />
            </label>
            <label className="block">
              <span className="label">Följ upp (valfritt)</span>
              <input
                className="input"
                type="date"
                value={draft.fields.followUp}
                onChange={(e) => change({ followUp: e.target.value })}
              />
            </label>
          </div>
        </details>
      </fieldset>
      <button
        className="btn-primary"
        disabled={!ready || busy || !draft.fields.outcome}
        type="submit"
      >
        {busy
          ? "Sparar…"
          : draft.pending
            ? "Försök spara igen"
            : "Spara samtalet"}
      </button>
    </form>
  );
}
