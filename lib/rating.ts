// Matchbetyg med ELO-form. Tränaren bedömer hur spelaren presterade *mot
// förväntan* – där förväntan redan är nivåjusterad. Utfallet matar ett löpande
// form-tal (ELO) per spelare som seedas från spelarens nivå och utvecklas över
// tid. Se docs/SPEC-matchbetyg.md. Värdena (seed/K) är medvetet kalibrerbara.

import { LEVELS, level, levelByRank, type Level } from "./levels";
import { CATEGORIES } from "./svff";

// ---- "Mot förväntan"-skala (5 steg) ----
export type Outcome = -2 | -1 | 0 | 1 | 2;

export interface ExpectationStep {
  key: string;
  outcome: Outcome;
  label: string;
  short: string;
  tone: "danger" | "warn" | "neutral" | "ok" | "great";
}

export const EXPECTATION_STEPS: ExpectationStep[] = [
  { key: "well_below", outcome: -2, label: "Långt under", short: "−−", tone: "danger" },
  { key: "below", outcome: -1, label: "Under", short: "−", tone: "warn" },
  { key: "as_expected", outcome: 0, label: "Som väntat", short: "0", tone: "neutral" },
  { key: "above", outcome: 1, label: "Över", short: "+", tone: "ok" },
  { key: "well_above", outcome: 2, label: "Långt över", short: "++", tone: "great" },
];

export function stepByKey(key: string | null | undefined): ExpectationStep | null {
  return EXPECTATION_STEPS.find((s) => s.key === key) ?? null;
}
export function stepByOutcome(outcome: number): ExpectationStep {
  return EXPECTATION_STEPS.find((s) => s.outcome === outcome) ?? EXPECTATION_STEPS[2];
}

// ---- Seed och form-tal ----
// Form-talet seedas från spelarens nivå så att en ny spelare börjar i sitt band.
const SEED_BY_RANK: Record<number, number> = { 1: 800, 2: 900, 3: 1000, 4: 1100, 5: 1200 };
export const DEFAULT_SEED = 1000; // medel om spelaren saknar nivå

export function seedRating(playerLevelId: string | null | undefined): number {
  const l = level(playerLevelId);
  return l ? SEED_BY_RANK[l.rank] ?? DEFAULT_SEED : DEFAULT_SEED;
}

// K-faktor per matchnivå: svårare match → större utslag. Det är så nivån "tas
// hänsyn till" – att överprestera i en svår match rör formen mer än i en lätt.
export function kFactor(matchLevelId: string | null | undefined): number {
  const l = level(matchLevelId);
  const rank = l?.rank ?? 3; // okänd matchnivå behandlas som medel
  return 8 + (rank - 1) * 4; // rank 1..5 → 8, 12, 16, 20, 24
}

// Formförändring för en betygsatt match.
export function computeDelta(matchLevelId: string | null | undefined, outcome: number): number {
  return Math.round(kFactor(matchLevelId) * outcome);
}

// Vilket nivåband ett form-tal motsvarar (för vänlig visning + framtida
// nivåförslag). Gränserna ligger mitt emellan seed-talen.
export function ratingBand(rating: number | null | undefined): Level {
  if (rating == null) return levelByRank(3)!;
  if (rating < 850) return LEVELS[0];
  if (rating < 950) return LEVELS[1];
  if (rating < 1050) return LEVELS[2];
  if (rating < 1150) return LEVELS[3];
  return LEVELS[4];
}

// ---- Nivåförslag ----
// När spelarens form-tal konsekvent ligger i ett annat nivåband än den satta
// nivån föreslås en flytt. Tränaren beslutar alltid (ingen auto). Vi kräver att
// de N senaste betygsatta matcherna *alla* landat i samma avvikande band, så att
// en enstaka topp- eller bottenmatch inte triggar ett förslag.
export const LEVEL_SUGGEST_MIN = 3;

export interface LevelSuggestion {
  direction: "up" | "down";
  from: Level; // spelarens satta nivå
  to: Level; // föreslagen nivå (formens band)
  matches: number; // antal matcher i rad som stött förslaget
}

export function levelSuggestion(
  playerLevelId: string | null | undefined,
  trend: { rating: number }[]
): LevelSuggestion | null {
  const from = level(playerLevelId);
  if (!from) return null; // utan satt nivå finns inget att jämföra mot
  if (trend.length < LEVEL_SUGGEST_MIN) return null;

  const recent = trend.slice(-LEVEL_SUGGEST_MIN);
  const bands = recent.map((p) => ratingBand(p.rating));
  const target = bands[0];
  // Alla de senaste matcherna måste ligga i samma band …
  if (!bands.every((b) => b.rank === target.rank)) return null;
  // … och det bandet måste skilja sig från spelarens satta nivå.
  if (target.rank === from.rank) return null;

  return {
    direction: target.rank > from.rank ? "up" : "down",
    from,
    to: target,
    matches: LEVEL_SUGGEST_MIN,
  };
}

// ---- Statistik → förslag på "mot förväntan"-steg ----
// Heuristik (AI kan ersätta senare). Väger spelarens matchstatistik mot position
// och hur väl matchnivån passar spelaren: en svår match sänker förväntan, en lätt
// höjer den. Tränaren bekräftar/justerar alltid förslaget.
export interface SuggestInput {
  position: string | null | undefined;
  goals: number;
  assists: number;
  saves: number;
  interceptions: number;
  conceded: number | null; // motståndarens mål i matchen, null om okänt
  // Skillnaden spelarnivå − matchnivå (rank). Negativ = matchen är svårare än
  // spelarens nivå (lägre förväntan); positiv = lättare match (högre förväntan).
  levelDiff: number;
}

export function suggestOutcome(input: SuggestInput): Outcome {
  let score = 0;

  const gk = input.position === "malvakt";
  const defender = input.position === "forsvar";
  const midfielder = input.position === "mittfalt";

  // Offensiva bidrag väger tyngre för anfall/mittfält
  const attack = input.goals * 2 + input.assists;
  if (attack >= 3) score += 2;
  else if (attack >= 1) score += 1;

  // Målvakt: räddningar; ren nolla är ett tydligt plus
  if (gk) {
    if (input.saves >= 4) score += 2;
    else if (input.saves >= 2) score += 1;
    if (input.conceded === 0) score += 1;
  }

  // Försvar/mittfält: brytningar och defensivt arbete
  if (defender || midfielder) {
    if (input.interceptions >= 4) score += 1;
    if (defender && input.conceded === 0) score += 1;
  }

  // Nivåjustering: svårare match (negativ diff) sänker förväntan, så att klara
  // sig räknas högre; lättare match höjer förväntan.
  if (input.levelDiff <= -2) score += 1;
  else if (input.levelDiff >= 2) score -= 1;
  else if (input.levelDiff === 1) score -= 1;

  return Math.max(-2, Math.min(2, score)) as Outcome;
}

// ---- Avancerat läge: snitt över SvFF:s 5 områden ----
export const RATING_AREAS = CATEGORIES.map((c) => ({ id: c.id, name: c.short, color: c.color }));

// Matchens samlade utfall = snitt av områdesutfallen, avrundat till närmaste steg.
export function outcomeFromAreas(areaOutcomes: number[]): Outcome {
  const vals = areaOutcomes.filter((v) => Number.isFinite(v));
  if (vals.length === 0) return 0;
  const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
  return Math.max(-2, Math.min(2, Math.round(avg))) as Outcome;
}
