"use client";
import { useId, useRef, useState, type PointerEvent } from "react";
import { drawing } from "@/lib/training/drawing";
import {
  isArrow,
  validDiagram,
  type Diagram,
  type DrawingObject,
  type ObjectType,
} from "@/lib/training/model";
const tools: [ObjectType | "select", string][] = [
  ["select", "Flytta"],
  ["player", "Spelare"],
  ["ball", "Boll"],
  ["cone", "Kon"],
  ["goal", "Mål"],
  ["pass", "Passning"],
  ["run", "Löpning"],
  ["dribble", "Drivning"],
  ["text", "Text"],
];
const copy = <T,>(v: T): T => structuredClone(v);
export default function DiagramEditor({
  value,
  onChange,
  disabled = false,
}: {
  value: Diagram;
  onChange: (v: Diagram) => void;
  disabled?: boolean;
}) {
  const [tool, setTool] = useState<ObjectType | "select">("select"),
    [selected, setSelected] = useState<string | null>(null),
    [past, setPast] = useState<Diagram[]>([]),
    [future, setFuture] = useState<Diagram[]>([]),
    [notice, setNotice] = useState("");
  const svg = useRef<SVGSVGElement>(null),
    live = useRef(value);
  live.current = value;
  const drag = useRef<{
    kind: string;
    id: string;
    start: { x: number; y: number };
    original: DrawingObject;
    before: Diagram;
  } | null>(null);
  const prefix = useId().replace(/[^a-zA-Z0-9]/g, "");
  const markup = drawing(value, selected)
    .replace(/ id="([^"]+)"/g, (_, id) => ` id="${prefix}-${id}"`)
    .replace(/url\(#([^)]+)\)/g, (_, id) => `url(#${prefix}-${id})`);
  const current = value.objects.find((o) => o.id === selected);
  function commit(next: Diagram) {
    if (disabled) return;
    setPast((p) => [...p.slice(-99), copy(live.current)]);
    setFuture([]);
    live.current = next;
    onChange(next);
  }
  function patch(patch: Partial<DrawingObject>) {
    if (!current) return;
    commit({
      ...value,
      objects: value.objects.map((o) =>
        o.id === selected ? { ...o, ...patch } : o,
      ),
    });
  }
  function point(e: PointerEvent<SVGSVGElement>) {
    const matrix = svg.current!.getScreenCTM();
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(
      matrix!.inverse(),
    );
    return {
      x: Math.max(35, Math.min(965, p.x)),
      y: Math.max(45, Math.min(650, p.y)),
    };
  }
  function down(e: PointerEvent<SVGSVGElement>) {
    if (disabled || e.button !== 0 || drag.current) return;
    const start = point(e),
      target = e.target as Element,
      before = copy(live.current);
    let next = copy(before),
      id = target.closest("[data-id]")?.getAttribute("data-id"),
      kind = target.getAttribute("data-handle") || "move";
    if (tool !== "select") {
      if (next.objects.length >= 500) {
        setNotice("Ritningen har nått gränsen på 500 objekt.");
        return;
      }
      id = "o" + crypto.randomUUID().replaceAll("-", "");
      const o: DrawingObject = {
        id,
        type: tool,
        ...start,
        color:
          tool === "player"
            ? "#ffdf4c"
            : tool === "cone"
              ? "#ff962f"
              : tool === "dribble"
                ? "#76d9ff"
                : "#ffffff",
        size: 1,
        label:
          tool === "player"
            ? String(next.objects.filter((o) => o.type === "player").length + 1)
            : tool === "text"
              ? "Ny text"
              : "",
      };
      if (isArrow(o)) {
        Object.assign(o, {
          x2: start.x,
          y2: start.y,
          cx: start.x,
          cy: start.y,
        });
        kind = "new";
      }
      next.objects.push(o);
      setTool("select");
    } else if (target.hasAttribute("data-handle")) id = selected;
    const object = next.objects.find((o) => o.id === id);
    if (!object) {
      setSelected(null);
      return;
    }
    setSelected(object.id);
    drag.current = {
      kind,
      id: object.id,
      start,
      original: copy(object),
      before,
    };
    svg.current!.setPointerCapture(e.pointerId);
    live.current = next;
    onChange(next);
  }
  function move(e: PointerEvent<SVGSVGElement>) {
    if (disabled || !drag.current) return;
    const d = drag.current,
      p = point(e),
      next = copy(live.current),
      o = next.objects.find((o) => o.id === d.id)!;
    if (d.kind === "new") {
      Object.assign(o, {
        x2: p.x,
        y2: p.y,
        cx: (o.x + p.x) / 2,
        cy: (o.y + p.y) / 2,
      });
    } else if (d.kind === "start") {
      o.x = p.x;
      o.y = p.y;
    } else if (d.kind === "end") {
      o.x2 = p.x;
      o.y2 = p.y;
    } else if (d.kind === "curve") {
      o.cx = p.x;
      o.cy = p.y;
    } else {
      const dx = p.x - d.start.x,
        dy = p.y - d.start.y;
      o.x = d.original.x + dx;
      o.y = d.original.y + dy;
      if (isArrow(o)) {
        o.x2 = d.original.x2! + dx;
        o.y2 = d.original.y2! + dy;
        o.cx = d.original.cx! + dx;
        o.cy = d.original.cy! + dy;
      }
    }
    live.current = next;
    onChange(next);
  }
  function finish(cancel = false) {
    const d = drag.current;
    if (!d) return;
    drag.current = null;
    if (cancel) {
      live.current = d.before;
      onChange(d.before);
      return;
    }
    let next = live.current;
    const o = next.objects.find((o) => o.id === d.id);
    if (d.kind === "new" && o && Math.hypot(o.x - o.x2!, o.y - o.y2!) < 15) {
      next = { ...next, objects: next.objects.filter((o) => o.id !== d.id) };
      setSelected(null);
    }
    if (JSON.stringify(d.before) !== JSON.stringify(next)) {
      setPast((p) => [...p.slice(-99), d.before]);
      setFuture([]);
    }
    live.current = next;
    onChange(next);
  }
  function undo() {
    if (disabled || !past.length) return;
    setFuture((p) => [...p, copy(value)]);
    onChange(past[past.length - 1]);
    setPast(past.slice(0, -1));
    setSelected(null);
  }
  function redo() {
    if (disabled || !future.length) return;
    setPast((p) => [...p, copy(value)]);
    onChange(future[future.length - 1]);
    setFuture(future.slice(0, -1));
    setSelected(null);
  }
  function remove() {
    if (current) {
      commit({
        ...value,
        objects: value.objects.filter((o) => o.id !== selected),
      });
      setSelected(null);
    }
  }
  return (
    <section
      className="space-y-3"
      aria-label="Övningsritare"
      onKeyDown={(e) => {
        if (
          disabled ||
          /INPUT|TEXTAREA|SELECT/.test((e.target as HTMLElement).tagName)
        )
          return;
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
          e.preventDefault();
          e.shiftKey ? redo() : undo();
        } else if (e.key === "Delete" || e.key === "Backspace") {
          e.preventDefault();
          remove();
        }
      }}
    >
      <div
        className="flex flex-wrap gap-2"
        role="toolbar"
        aria-label="Ritverktyg"
      >
        {tools.map(([id, label]) => (
          <button
            type="button"
            disabled={disabled}
            aria-pressed={tool === id}
            className={
              tool === id ? "btn-primary btn-sm" : "btn-secondary btn-sm"
            }
            onClick={() => setTool(id)}
            key={id}
          >
            {label}
          </button>
        ))}
      </div>
      <p className="caption">
        {tool === "select"
          ? "Dra objekt. Markera en pil och flytta det blå handtaget för att böja den."
          : "Tryck på planen för ett objekt. Dra från start till mål för en pil."}
      </p>
      <svg
        ref={svg}
        viewBox="0 0 1000 700"
        role="img"
        aria-label="Redigerbar fotbollsövning"
        tabIndex={0}
        className="w-full rounded-xl"
        style={{ touchAction: "none", userSelect: "none" }}
        dangerouslySetInnerHTML={{ __html: markup }}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={() => finish()}
        onPointerCancel={() => finish(true)}
        onLostPointerCapture={() => finish(true)}
      />
      <p className="caption">
        ━━▶ Passning · ┄┄▶ Löpning · ···▶ Drivning med boll
      </p>
      <div className="flex gap-2 flex-wrap">
        <button
          type="button"
          className="btn-secondary btn-sm"
          disabled={disabled || !past.length}
          onClick={undo}
        >
          Ångra
        </button>
        <button
          type="button"
          className="btn-secondary btn-sm"
          disabled={disabled || !future.length}
          onClick={redo}
        >
          Gör om
        </button>
        <label className="btn-secondary btn-sm">
          Öppna ritfil
          <input
            className="sr-only"
            type="file"
            accept=".json,application/json"
            disabled={disabled}
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (!file) return;
              try {
                if (file.size > 1_000_000) throw Error();
                const parsed = JSON.parse(await file.text());
                if (!validDiagram(parsed)) throw Error();
                commit(parsed);
                setSelected(null);
                setNotice(
                  "Ritningen är öppnad. Spara passet för att behålla den.",
                );
              } catch {
                setNotice(
                  "Filen kunde inte öppnas. Välj en ritfil från Övningsritaren.",
                );
              }
            }}
          />
        </label>
      </div>
      <label className="block">
        <span className="label">Markerat objekt</span>
        <select
          className="input"
          disabled={disabled}
          value={selected || ""}
          onChange={(e) => setSelected(e.target.value || null)}
        >
          <option value="">Välj objekt på planen eller här</option>
          {value.objects.map((o, i) => (
            <option key={o.id} value={o.id}>
              {i + 1}. {tools.find(([id]) => id === o.type)?.[1]} {o.label}
            </option>
          ))}
        </select>
      </label>
      {current && (
        <div className="grid sm:grid-cols-3 gap-3">
          <label>
            <span className="label">Text / nummer</span>
            <input
              className="input"
              disabled={disabled}
              maxLength={40}
              value={current.label}
              onChange={(e) => patch({ label: e.target.value })}
            />
          </label>
          <label>
            <span className="label">Färg</span>
            <input
              className="input"
              disabled={disabled}
              type="color"
              value={current.color}
              onChange={(e) => patch({ color: e.target.value })}
            />
          </label>
          <label>
            <span className="label">Storlek</span>
            <input
              className="input"
              disabled={disabled}
              type="range"
              min="0.5"
              max="2"
              step="0.1"
              value={current.size}
              onChange={(e) => patch({ size: Number(e.target.value) })}
            />
          </label>
          <button
            type="button"
            className="btn-secondary btn-sm"
            disabled={disabled || value.objects.length >= 500}
            onClick={() => {
              const o = copy(current);
              o.id = "o" + crypto.randomUUID().replaceAll("-", "");
              o.x += 30;
              o.y += 30;
              if (isArrow(o)) {
                o.x2! += 30;
                o.y2! += 30;
                o.cx! += 30;
                o.cy! += 30;
              }
              commit({ ...value, objects: [...value.objects, o] });
              setSelected(o.id);
            }}
          >
            Duplicera objekt
          </button>
          <button
            type="button"
            className="btn-secondary btn-sm"
            disabled={disabled}
            onClick={remove}
          >
            Ta bort objekt
          </button>
        </div>
      )}
      {notice && <p role="status">{notice}</p>}
    </section>
  );
}
