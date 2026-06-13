// Spelarpositioner – valfritt fält. Hjälper AI:n tolka matchstatistik i rätt
// kontext (en back ska inte bedömas på antal mål) och visas på spelarsidan.

export interface Position {
  id: string;
  label: string;
  // Kort beskrivning av vilken statistik som är mest relevant – matas till AI:n
  focus: string;
}

export const POSITIONS: Position[] = [
  { id: "malvakt", label: "Målvakt", focus: "räddningar och spel med fötterna – inte mål eller skott" },
  { id: "forsvar", label: "Försvar", focus: "brytningar, passningar och försvarsspel – sällan mål" },
  { id: "mittfalt", label: "Mittfält", focus: "passningar, brytningar och speluppbyggnad – både anfall och försvar" },
  { id: "anfall", label: "Anfall", focus: "mål, skott och avslut" },
];

export function positionLabel(id: string | null | undefined): string | null {
  return POSITIONS.find((p) => p.id === id)?.label ?? null;
}

export function positionFocus(id: string | null | undefined): string | null {
  return POSITIONS.find((p) => p.id === id)?.focus ?? null;
}
