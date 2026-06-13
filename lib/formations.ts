// Formationer för 7 mot 7 (F2014). Siffrorna inkluderar målvakten: t.ex.
// 1-2-3-1 = målvakt + 2 försvarare + 3 mittfältare + 1 anfallare = 7 spelare.
// Koordinaterna är normaliserade (0–1) på en stående plan där y=0 är
// motståndarens mål (vi anfaller uppåt) och y=1 är vårt eget mål.

export type SlotRole = "gk" | "def" | "mid" | "fwd";

export interface Slot {
  role: SlotRole;
  x: number;
  y: number;
}

export interface Formation {
  id: string;
  label: string;
  slots: Slot[];
}

export const FORMATIONS: Formation[] = [
  {
    id: "1-2-3-1",
    label: "1-2-3-1",
    slots: [
      { role: "gk", x: 0.5, y: 0.9 },
      { role: "def", x: 0.3, y: 0.7 },
      { role: "def", x: 0.7, y: 0.7 },
      { role: "mid", x: 0.2, y: 0.46 },
      { role: "mid", x: 0.5, y: 0.46 },
      { role: "mid", x: 0.8, y: 0.46 },
      { role: "fwd", x: 0.5, y: 0.18 },
    ],
  },
  {
    id: "1-1-4-1",
    label: "1-1-4-1",
    slots: [
      { role: "gk", x: 0.5, y: 0.9 },
      { role: "def", x: 0.5, y: 0.72 },
      { role: "mid", x: 0.16, y: 0.47 },
      { role: "mid", x: 0.39, y: 0.49 },
      { role: "mid", x: 0.61, y: 0.49 },
      { role: "mid", x: 0.84, y: 0.47 },
      { role: "fwd", x: 0.5, y: 0.18 },
    ],
  },
];

export function formation(id: string | null | undefined): Formation {
  return FORMATIONS.find((f) => f.id === id) ?? FORMATIONS[0];
}

// Spelarens position (lib/positions) → formationsroll
export function positionRole(positionId: string | null | undefined): SlotRole | null {
  switch (positionId) {
    case "malvakt": return "gk";
    case "forsvar": return "def";
    case "mittfalt": return "mid";
    case "anfall": return "fwd";
    default: return null;
  }
}
