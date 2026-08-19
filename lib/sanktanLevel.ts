const LEVEL_LABELS: Record<number, string> = {
  2: "Svår",
  3: "Medel",
  4: "Lätt",
};

export function sanktanLevelLabel(level: number | null | undefined): string {
  if (!level) return "";
  return LEVEL_LABELS[level] ?? `Nivå ${level}`;
}
