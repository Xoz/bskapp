import { create } from "zustand";
import type { Arrow, ArrowEndpoint, ArrowKind, Diagram, DiagramObject, ObjectType, Team } from "@/domain/diagram";
import { emptyDiagram } from "@/domain/diagram";

const uid = (prefix: string) => `${prefix}-${crypto.randomUUID()}`;
const clone = (d: Diagram): Diagram => structuredClone(d);

interface DiagramState {
  present: Diagram;
  past: Diagram[];
  future: Diagram[];
  selectedId: string | null;
  seqIndex: number; // index in arrows sorted by order; -1 = startläge
  // mutations
  load: (d: Diagram) => void;
  reset: () => void;
  addObject: (type: ObjectType, x: number, y: number, team?: Team, label?: string) => void;
  moveObject: (id: string, x: number, y: number) => void;
  moveObjectLive: (id: string, x: number, y: number) => void; // drag: ingen ny historikpost
  snapshot: () => void; // pusha nuvarande present till past (start av drag)
  deleteObject: (id: string) => void;
  addArrow: (kind: ArrowKind, from: ArrowEndpoint, to: ArrowEndpoint) => void;
  deleteArrow: (id: string) => void;
  setWidth: (ratio: number) => void;
  select: (id: string | null) => void;
  undo: () => void;
  redo: () => void;
  setSeq: (i: number) => void;
  stepSeq: (delta: number) => void;
}

// ponytail: full-state snapshots kap 50; byt till patch-baserat om diagram växer stort
const HISTORY_CAP = 50;

export const useDiagram = create<DiagramState>((set, get) => {
  const commit = (next: Diagram) =>
    set((s) => {
      const past = [...s.past, s.present];
      if (past.length > HISTORY_CAP) past.shift();
      return { present: next, past, future: [], seqIndex: -1 };
    });
  const update = (fn: (d: Diagram) => Diagram) => commit(fn(clone(get().present)));

  return {
    present: emptyDiagram(),
    past: [],
    future: [],
    selectedId: null,
    seqIndex: -1,

    load: (d) => set({ present: clone(d), past: [], future: [], selectedId: null, seqIndex: -1 }),
    reset: () => set({ present: emptyDiagram(), past: [], future: [], selectedId: null, seqIndex: -1 }),

    addObject: (type, x, y, team, label) =>
      update((d) => {
        const obj: DiagramObject = { id: uid(type), type, x, y };
        if (team) obj.team = team;
        if (label) obj.label = label;
        d.objects.push(obj);
        return d;
      }),

    moveObject: (id, x, y) =>
      update((d) => {
        const o = d.objects.find((o) => o.id === id);
        if (o) {
          o.x = Math.min(1, Math.max(0, x));
          o.y = Math.min(1, Math.max(0, y));
        }
        return d;
      }),
    moveObjectLive: (id, x, y) =>
      set((s) => ({
        present: {
          ...s.present,
          objects: s.present.objects.map((o) =>
            o.id === id ? { ...o, x: Math.min(1, Math.max(0, x)), y: Math.min(1, Math.max(0, y)) } : o,
          ),
        },
      })),
    snapshot: () =>
      set((s) => {
        const past = [...s.past, s.present];
        if (past.length > HISTORY_CAP) past.shift();
        return { past, future: [] };
      }),

    deleteObject: (id) =>
      update((d) => {
        d.objects = d.objects.filter((o) => o.id !== id);
        d.arrows = d.arrows.filter((a) => a.from.objectId !== id && a.to.objectId !== id);
        return d;
      }),

    addArrow: (kind, from, to) =>
      update((d) => {
        const arrow: Arrow = { id: uid("arrow"), kind, from, to, order: d.arrows.length };
        d.arrows.push(arrow);
        return d;
      }),

    deleteArrow: (id) =>
      update((d) => {
        d.arrows = d.arrows.filter((a) => a.id !== id);
        return d;
      }),

    setWidth: (ratio) => update((d) => ({ ...d, widthRatio: Math.min(1, Math.max(0.3, ratio)) })),

    select: (id) => set({ selectedId: id }),

    undo: () =>
      set((s) => {
        if (!s.past.length) return s;
        const past = [...s.past];
        const present = past.pop()!;
        return { present, past, future: [s.present, ...s.future], seqIndex: -1 };
      }),
    redo: () =>
      set((s) => {
        if (!s.future.length) return s;
        const [present, ...future] = s.future;
        return { present, past: [...s.past, s.present], future, seqIndex: -1 };
      }),

    setSeq: (i) => set((s) => ({ seqIndex: Math.min(s.present.arrows.length - 1, Math.max(-1, i)) })),
    stepSeq: (delta) =>
      set((s) => {
        const max = s.present.arrows.length - 1;
        return { seqIndex: Math.min(max, Math.max(-1, s.seqIndex + delta)) };
      }),
  };
});

export const arrowsSorted = (d: Diagram): Arrow[] => [...d.arrows].sort((a, b) => a.order - b.order);