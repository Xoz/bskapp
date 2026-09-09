"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BANK,
  emptyDiagram,
  validPlan,
  type TrainingPlan,
  type Diagram,
  type Block,
} from "@/lib/training/model";
import { drawing } from "@/lib/training/drawing";
import { saveTrainingPlan } from "@/lib/training/actions";
import DiagramEditor from "./DiagramEditor";
export default function TrainingBuilder({
  scope,
  planId,
  initial,
  initialRevision,
}: {
  scope: string;
  planId: string;
  initial: TrainingPlan;
  initialRevision: number;
}) {
  const router = useRouter(),
    key = `bsk-training:${scope}:${planId}`;
  const [plan, setPlan] = useState(initial),
    [id, setId] = useState(planId),
    [revision, setRevision] = useState(initialRevision),
    [ready, setReady] = useState(false),
    [busy, setBusy] = useState(false),
    [pending, setPending] = useState(false),
    [notice, setNotice] = useState(""),
    [selected, setSelected] = useState<string | null>(
      initial.blocks[0]?.id ?? null,
    ),
    [showBank, setShowBank] = useState(!initial.blocks.length),
    [category, setCategory] = useState(""),
    [dirty, setDirty] = useState(false),
    [conflict, setConflict] = useState(false);
  const [removed, setRemoved] = useState<{
    block: Block;
    index: number;
  } | null>(null);
  const lock = useRef(false);
  useEffect(() => {
    let nextId = planId === "nytt" ? crypto.randomUUID() : planId;
    try {
      const cached = JSON.parse(localStorage.getItem(key) || "null");
      if (
        cached &&
        validPlan(cached.plan) &&
        typeof cached.id === "string" &&
        cached.revision === initialRevision
      ) {
        setPlan(cached.plan);
        nextId = cached.id;
        setSelected(cached.plan.blocks[0]?.id ?? null);
        setShowBank(!cached.plan.blocks.length);
        setPending(!!cached.pending);
        setDirty(true);
        setNotice("Ditt utkast är återställt.");
      }
    } catch {}
    setId(nextId);
    setReady(true);
  }, [key, initialRevision, planId]);
  function update(next: TrainingPlan) {
    if (busy || pending || conflict) return;
    setPlan(next);
    setDirty(true);
    setNotice("Osparade ändringar.");
    try {
      localStorage.setItem(
        key,
        JSON.stringify({ id, revision, plan: next, pending: false }),
      );
    } catch {
      setNotice(
        "Lokal lagring är inte tillgänglig. Spara passet innan du lämnar sidan.",
      );
    }
  }
  useEffect(() => {
    function warn(e: BeforeUnloadEvent) {
      if (dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    }
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  function add(diagram: Diagram, minutes = 10) {
    if (plan.blocks.length >= 30) return;
    const block = {
      id: crypto.randomUUID(),
      minutes,
      diagram: structuredClone(diagram),
    };
    update({ ...plan, blocks: [...plan.blocks, block] });
    setSelected(block.id);
    setShowBank(false);
  }
  function changeBlock(patch: Partial<Block>) {
    update({
      ...plan,
      blocks: plan.blocks.map((b) =>
        b.id === selected ? { ...b, ...patch } : b,
      ),
    });
  }
  function move(index: number, offset: number) {
    const blocks = [...plan.blocks];
    [blocks[index], blocks[index + offset]] = [
      blocks[index + offset],
      blocks[index],
    ];
    update({ ...plan, blocks });
  }
  async function save() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setPending(true);
    setNotice("");
    try {
      localStorage.setItem(
        key,
        JSON.stringify({ id, revision, plan, pending: true }),
      );
    } catch {}
    try {
      const result = await saveTrainingPlan(id, revision, plan);
      if (result.revision) {
        setRevision(result.revision);
        setDirty(false);
        setPending(false);
        try {
          localStorage.removeItem(key);
        } catch {}
        setNotice("Passet är sparat.");
        if (id !== planId) router.replace(`/traning/${id}`);
        else router.refresh();
      } else {
        setPending(false);
        setNotice(result.error || "Kunde inte spara.");
        if (result.error?.includes("annan flik")) setConflict(true);
        try {
          localStorage.setItem(
            key,
            JSON.stringify({ id, revision, plan, pending: false }),
          );
        } catch {}
      }
    } catch {
      setNotice("Svaret kom inte fram. Försök spara igen med samma innehåll.");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  const block = plan.blocks.find((b) => b.id === selected),
    disabled = !ready || busy || pending || conflict;
  return (
    <div className="core-page">
      <Link href="/traning" className="body-small">
        ← Mina träningspass
      </Link>
      <header className="core-header">
        <div>
          <p className="core-kicker">Träningsbyggare</p>
          <h1 className="core-title">{plan.title}</h1>
          <p className="core-lead">
            {plan.blocks.length} övningar ·{" "}
            {plan.blocks.reduce((sum, b) => sum + b.minutes, 0)} minuter
          </p>
        </div>
        <button
          className="btn-primary"
          disabled={!ready || busy || conflict}
          onClick={() => void save()}
        >
          {busy ? "Sparar…" : pending ? "Försök spara igen" : "Spara passet"}
        </button>
      </header>
      {notice && (
        <p role="status" className="core-panel p-4">
          {notice}
        </p>
      )}
      {conflict && (
        <button
          className="btn-secondary"
          onClick={() => {
            setId(crypto.randomUUID());
            setRevision(0);
            setConflict(false);
            setNotice("Utkastet är redo att sparas som ett nytt pass.");
          }}
        >
          Behåll utkastet som nytt pass
        </button>
      )}
      {conflict && (
        <a href={`/traning/${id}`} className="underline">
          Öppna senaste sparade versionen
        </a>
      )}
      {removed && (
        <button
          className="btn-secondary btn-sm"
          disabled={disabled || plan.blocks.length >= 30}
          onClick={() => {
            const blocks = [...plan.blocks];
            blocks.splice(
              Math.min(removed.index, blocks.length),
              0,
              removed.block,
            );
            update({ ...plan, blocks });
            setSelected(removed.block.id);
            setShowBank(false);
            setRemoved(null);
          }}
        >
          Ångra borttagning av övning
        </button>
      )}
      <fieldset disabled={disabled} className="space-y-5">
        <div className="core-panel p-4 grid sm:grid-cols-2 gap-4">
          <label>
            <span className="label">Passets namn</span>
            <input
              className="input"
              maxLength={100}
              value={plan.title}
              onChange={(e) => update({ ...plan, title: e.target.value })}
            />
          </label>
          <label>
            <span className="label">Datum (valfritt)</span>
            <input
              className="input"
              type="date"
              value={plan.date}
              onChange={(e) => update({ ...plan, date: e.target.value })}
            />
          </label>
        </div>
        <div className="grid lg:grid-cols-[260px_minmax(0,1fr)] gap-5">
          <aside className="core-panel p-4 space-y-3 self-start">
            <h2 className="font-semibold">Passets ordning</h2>
            {plan.blocks.map((b, i) => (
              <div className="border-b pb-3" key={b.id}>
                <button
                  type="button"
                  aria-pressed={selected === b.id && !showBank}
                  className="text-left w-full py-2"
                  onClick={() => {
                    setSelected(b.id);
                    setShowBank(false);
                  }}
                >
                  <strong>
                    {i + 1}. {b.diagram.title}
                  </strong>
                  <span className="block caption">{b.minutes} minuter</span>
                </button>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="btn-secondary btn-sm"
                    disabled={disabled || i === 0}
                    aria-label={`Flytta upp ${b.diagram.title}`}
                    onClick={() => move(i, -1)}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="btn-secondary btn-sm"
                    disabled={disabled || i === plan.blocks.length - 1}
                    aria-label={`Flytta ned ${b.diagram.title}`}
                    onClick={() => move(i, 1)}
                  >
                    ↓
                  </button>
                </div>
              </div>
            ))}
            <button
              type="button"
              className="btn-secondary w-full"
              disabled={disabled || plan.blocks.length >= 30}
              onClick={() => setShowBank(true)}
            >
              Lägg till övning
            </button>
          </aside>
          <section className="core-panel p-4 md:p-5 min-w-0">
            {showBank ? (
              <>
                <div className="flex flex-wrap justify-between gap-3 mb-4">
                  <h2 className="font-semibold">Välj en övning</h2>
                  <button
                    type="button"
                    className="btn-secondary btn-sm"
                    onClick={() => add(emptyDiagram())}
                  >
                    Rita från tom plan
                  </button>
                </div>
                <label className="block mb-4">
                  <span className="label">Område</span>
                  <select
                    className="input"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                  >
                    <option value="">Alla områden</option>
                    {[...new Set(BANK.map((b) => b.category))].map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </label>
                <div className="grid md:grid-cols-2 gap-4">
                  {BANK.filter((b) => !category || b.category === category).map(
                    (d) => (
                      <article
                        className="border rounded-xl overflow-hidden"
                        key={d.id}
                      >
                        <svg
                          viewBox="0 0 1000 700"
                          role="img"
                          aria-label={`Ritning: ${d.model.title}`}
                          className="w-full"
                          dangerouslySetInnerHTML={{
                            __html: drawing(d.model, null)
                              .replace(
                                / id="([^"]+)"/g,
                                (_, id) => ` id="${d.id}-${id}"`,
                              )
                              .replace(
                                /url\(#([^)]+)\)/g,
                                (_, id) => `url(#${d.id}-${id})`,
                              ),
                          }}
                        />
                        <div className="p-4 space-y-2">
                          <h3 className="font-semibold">{d.model.title}</h3>
                          <p className="caption">
                            {d.players} spelare · {d.area} · {d.time}
                          </p>
                          <p className="body-small">{d.focus}</p>
                          <button
                            type="button"
                            className="btn-secondary btn-sm"
                            onClick={() => add(d.model, parseInt(d.time, 10))}
                          >
                            Lägg i passet
                          </button>
                        </div>
                      </article>
                    ),
                  )}
                </div>
              </>
            ) : block ? (
              <div className="space-y-4">
                <div className="grid sm:grid-cols-[1fr_110px] gap-3">
                  <label>
                    <span className="label">Övningens namn</span>
                    <input
                      className="input"
                      maxLength={70}
                      value={block.diagram.title}
                      onChange={(e) =>
                        changeBlock({
                          diagram: { ...block.diagram, title: e.target.value },
                        })
                      }
                    />
                  </label>
                  <label>
                    <span className="label">Minuter</span>
                    <input
                      className="input"
                      type="number"
                      min={1}
                      max={180}
                      value={block.minutes}
                      onChange={(e) =>
                        changeBlock({ minutes: Number(e.target.value) })
                      }
                    />
                  </label>
                </div>
                <DiagramEditor
                  key={block.id}
                  value={block.diagram}
                  disabled={disabled}
                  onChange={(diagram) => changeBlock({ diagram })}
                />
                <details>
                  <summary className="cursor-pointer">
                    Instruktioner och egna anpassningar
                  </summary>
                  <textarea
                    aria-label="Övningens instruktioner"
                    className="input mt-3"
                    rows={7}
                    maxLength={1200}
                    value={block.diagram.notes}
                    onChange={(e) =>
                      changeBlock({
                        diagram: { ...block.diagram, notes: e.target.value },
                      })
                    }
                  />
                </details>
                <button
                  type="button"
                  className="btn-secondary btn-sm"
                  onClick={() => {
                    setRemoved({
                      block,
                      index: plan.blocks.findIndex((b) => b.id === block.id),
                    });
                    update({
                      ...plan,
                      blocks: plan.blocks.filter((b) => b.id !== block.id),
                    });
                    setSelected(null);
                    setShowBank(true);
                  }}
                >
                  Ta bort övningen från passet
                </button>
              </div>
            ) : (
              <p>Välj en övning i passet eller lägg till en ny.</p>
            )}
          </section>
        </div>
      </fieldset>
      <p className="caption">
        Passet sparas på ditt konto i BSK. Övningarnas instruktioner följer med
        automatiskt.
      </p>
    </div>
  );
}
