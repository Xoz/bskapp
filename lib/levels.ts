// Svårighetsnivåer för seriematcher (svenskalag/SvFF-seriespel). Samma skala
// används både för matchens nivå och för hur en spelare graderats – så att
// appen kan matcha rätt spelare till rätt match.

export interface Level {
  id: string;
  label: string;
  short: string;
  rank: number; // 1 = lättast, 5 = svårast
  color: string;
}

export const LEVELS: Level[] = [
  { id: "extra_latt", label: "Extra lätt", short: "X-lätt", rank: 1, color: "#86efac" },
  { id: "latt", label: "Lätt", short: "Lätt", rank: 2, color: "#4ade80" },
  { id: "medel", label: "Medel", short: "Medel", rank: 3, color: "#fbbf24" },
  { id: "svar", label: "Svår", short: "Svår", rank: 4, color: "#fb923c" },
  { id: "extra_svar", label: "Extra svår", short: "X-svår", rank: 5, color: "#f87171" },
];

export function level(id: string | null | undefined): Level | null {
  return LEVELS.find((l) => l.id === id) ?? null;
}

export function levelLabel(id: string | null | undefined): string | null {
  return level(id)?.label ?? null;
}

// Föreslå nivå utifrån snittet i senaste SvFF-utvärderingen (skala 1–4).
export function suggestLevel(evalAverage: number | null | undefined): Level | null {
  if (evalAverage == null) return null;
  if (evalAverage < 1.6) return LEVELS[0];
  if (evalAverage < 2.2) return LEVELS[1];
  if (evalAverage < 2.9) return LEVELS[2];
  if (evalAverage < 3.5) return LEVELS[3];
  return LEVELS[4];
}

export type FitKey = "fit" | "challenge" | "down" | "too_hard" | "too_easy" | "ungraded";

export interface Fit {
  key: FitKey;
  label: string;
  hint: string;
  order: number;
  tone: "ok" | "warn" | "danger" | "neutral";
}

// Hur väl en graderad spelare passar en matchnivå.
export function fit(playerLevelId: string | null | undefined, matchLevelId: string | null | undefined): Fit {
  const p = level(playerLevelId);
  const m = level(matchLevelId);
  if (!p) return { key: "ungraded", label: "Ej graderad", hint: "Sätt en spelnivå för att få förslag", order: 5, tone: "neutral" };
  if (!m) return { key: "fit", label: "Tillgänglig", hint: "Sätt matchens nivå för att matcha", order: 0, tone: "neutral" };
  const diff = p.rank - m.rank;
  if (diff === 0) return { key: "fit", label: "Passar bra", hint: "Rätt nivå för matchen", order: 0, tone: "ok" };
  if (diff === -1) return { key: "challenge", label: "Kan utmanas upp", hint: "Ett steg över sin nivå – bra utmaning", order: 1, tone: "warn" };
  if (diff === 1) return { key: "down", label: "Spelar ned", hint: "Lättare match – kan få ta mer ansvar", order: 2, tone: "ok" };
  if (diff <= -2) return { key: "too_hard", label: "För svår match", hint: "Ligger för långt över spelarens nivå", order: 4, tone: "danger" };
  return { key: "too_easy", label: "För lätt match", hint: "Får för lite motstånd här", order: 3, tone: "neutral" };
}
