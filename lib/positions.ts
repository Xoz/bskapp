// Spelarpositioner – valfritt fält för planering och visning på spelarsidan.

export interface Position {
  id: string;
  label: string;
}

export const POSITIONS: Position[] = [
  { id: "malvakt", label: "Målvakt" },
  { id: "forsvar", label: "Försvar" },
  { id: "mittfalt", label: "Mittfält" },
  { id: "anfall", label: "Anfall" },
];

export function positionLabel(id: string | null | undefined): string | null {
  return POSITIONS.find((p) => p.id === id)?.label ?? null;
}

/** Uttagningsordning: målvakt, back, mittfält/kant, anfall och sist osatt. */
export function selectionPositionRank(primary: string | null | undefined, fallback?: string | null): number {
  const value = (primary?.trim() || fallback?.trim() || "").toLocaleLowerCase("sv");
  if (/målvakt|malvakt|keeper/.test(value)) return 0;
  if (/back|försvar|forsvar/.test(value)) return 1;
  if (/mitt|kant|wing/.test(value)) return 2;
  if (/anfall|forward|striker/.test(value)) return 3;
  return 4;
}
