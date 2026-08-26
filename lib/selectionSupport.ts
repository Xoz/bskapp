import { assessMatchLoad } from "./matchCapacity";

export type SelectionSignals = {
  windowMatchCount: number;
  recentMatchCount: number;
  upcomingMatchCount: number;
  teamMinimumWindow: number;
  activeGoalCount: number;
  lastSelectedDate: string | null;
};

export type SelectionSupport = {
  opportunities: string[];
  cautions: string[];
};

export type RecommendationCallupStatus = "accepted" | "declined" | "pending" | null;

export type RecommendationCandidate = {
  id: number;
  name: string;
  teamNames: string[];
  primaryTeamName: string | null;
  windowMatchCount: number;
  recentMatchCount: number;
  upcomingMatchCount: number;
  lastSelectedDate: string | null;
  primaryLevel: string;
  secondaryLevel: string;
  selectionEligible: boolean;
  currentlySelected: boolean;
  currentCallupStatus: RecommendationCallupStatus;
};

export type SelectionRecommendation = {
  selectedIds: number[];
  reasons: Record<number, string>;
  yellowCount: number;
  fillerCount: number;
  targetSize: number;
};

/**
 * Transparenta meningar, aldrig ett spelarvärde eller en dold rangordning.
 * Kandidater sorteras fortsatt alfabetiskt i UI:t och tränaren fattar beslutet.
 */
export function selectionSupport(signals: SelectionSignals): SelectionSupport {
  const opportunities: string[] = [];
  const cautions: string[] = [];

  if (signals.windowMatchCount === 0) {
    opportunities.push("Ingen match under perioden ±7 dagar");
  } else if (signals.windowMatchCount <= signals.teamMinimumWindow + 1) {
    opportunities.push("Färre matcher än många lagkamrater under perioden ±7 dagar");
  }

  if (signals.activeGoalCount > 0) {
    opportunities.push(
      signals.activeGoalCount === 1
        ? "Har ett aktivt utvecklingsmål att observera"
        : "Har två aktiva utvecklingsmål att observera"
    );
  }

  const load = assessMatchLoad(signals.recentMatchCount, signals.upcomingMatchCount);
  if (load.level === "maximum") {
    cautions.push(`Vid maxgränsen: ${load.recentMatchCount} spelade · ${load.upcomingMatchCount} kommande`);
  } else if (load.level === "high") {
    cautions.push(`För hög belastning: ${load.recentMatchCount} spelade · ${load.upcomingMatchCount} kommande`);
  }

  return { opportunities, cautions };
}

export function squadBalanceWarnings(
  selected: Array<{ recentMatchCount: number; upcomingMatchCount: number }>
): string[] {
  if (selected.length === 0) return ["Ingen spelare är uttagen ännu"];

  const warnings: string[] = [];
  const levels = selected.map((row) => assessMatchLoad(row.recentMatchCount, row.upcomingMatchCount).level);
  const highCount = levels.filter((level) => level === "high").length;
  if (highCount > 0) {
    warnings.push(`${highCount} spelare har för hög belastning`);
  }
  if (levels.filter((level) => level !== "normal").length >= Math.ceil(selected.length / 2)) {
    warnings.push("Minst halva truppen är vid maxgränsen eller över");
  }
  return warnings;
}

function preferredLevels(candidate: RecommendationCandidate): number[] {
  return [candidate.primaryLevel, candidate.secondaryLevel]
    .map(Number)
    .filter((value) => Number.isInteger(value) && value >= 2 && value <= 4);
}

function levelFit(candidate: RecommendationCandidate, matchLevel: number | null): { rank: number; label: string; safe: boolean } {
  if (!matchLevel) return { rank: 2, label: "nivå ej satt", safe: true };
  const primary = Number(candidate.primaryLevel);
  const secondary = Number(candidate.secondaryLevel);
  if (primary === matchLevel) return { rank: 0, label: "normal nivå", safe: true };
  if (secondary === matchLevel) return { rank: 1, label: "utmaningsnivå", safe: true };
  const levels = preferredLevels(candidate);
  if (levels.length === 0) return { rank: 2, label: "nivå ej satt", safe: true };
  const distance = Math.min(...levels.map((level) => Math.abs(level - matchLevel)));
  // Lägre Sanktan-nummer är svårare. Två steg över spelarens satta nivå
  // föreslås aldrig automatiskt, men tränaren kan fortsatt välja manuellt.
  const tooHard = levels.every((level) => level - matchLevel >= 2);
  if (distance === 1) return { rank: 2, label: "närliggande nivå", safe: true };
  return { rank: 3, label: "annan nivå", safe: !tooHard };
}

function fairnessOrder(matchLevel: number | null) {
  return (left: RecommendationCandidate, right: RecommendationCandidate) => {
    const loadRank = (candidate: RecommendationCandidate) => {
      const level = assessMatchLoad(candidate.recentMatchCount, candidate.upcomingMatchCount).level;
      return level === "normal" ? 0 : level === "maximum" ? 1 : 2;
    };
    const levelDiff = loadRank(left) - loadRank(right);
    if (levelDiff !== 0) return levelDiff;
    const loadDiff = left.windowMatchCount - right.windowMatchCount;
    if (loadDiff !== 0) return loadDiff;
    const fitDiff = levelFit(left, matchLevel).rank - levelFit(right, matchLevel).rank;
    if (fitDiff !== 0) return fitDiff;
    const leftDate = left.lastSelectedDate ?? "";
    const rightDate = right.lastSelectedDate ?? "";
    return leftDate.localeCompare(rightDate) || left.name.localeCompare(right.name, "sv");
  };
}

/**
 * Ger ett transparent förslag för en Sanktanmatch. Endast ordinarie Gulspelare
 * rättvisejämförs. På Gulmatch används F15 och Grön som utfyllnad. På Grönmatch
 * bevaras Gröns befintliga trupp och rättvist valda Gul-lån fyller vakanta platser.
 * Resultatet är deterministiskt och sparas aldrig av motorn själv.
 */
export function recommendYellowSelection(input: {
  candidates: RecommendationCandidate[];
  matchLevel: number | null;
  sourceTeam?: string | null;
  targetSize?: number;
}): SelectionRecommendation {
  const targetSize = Math.max(1, input.targetSize ?? 9);
  const selectedIds: number[] = [];
  const selected = new Set<number>();
  const reasons: Record<number, string> = {};

  const add = (candidate: RecommendationCandidate, reason: string) => {
    if (selected.has(candidate.id)) return;
    selected.add(candidate.id);
    selectedIds.push(candidate.id);
    reasons[candidate.id] = reason;
  };
  // Ja-svarade kallelser och redan manuellt valda okallade spelare är fasta.
  // Nej/inväntar får aldrig flyttas in i truppen av förslaget.
  input.candidates
    .filter((candidate) => candidate.currentCallupStatus === "accepted"
      || (candidate.currentCallupStatus === null && candidate.currentlySelected))
    .sort((left, right) => left.name.localeCompare(right.name, "sv"))
    .forEach((candidate) => add(candidate, candidate.currentCallupStatus === "accepted" ? "Kallad och svarat ja" : "Redan vald"));

  const selectable = input.candidates
    .filter((candidate) => candidate.currentCallupStatus === null)
    .filter((candidate) => candidate.selectionEligible)
    .filter((candidate) => !(input.matchLevel === 4 && candidate.primaryTeamName === "F15"));

  const yellow = selectable
    .filter((candidate) => candidate.primaryTeamName === "Gul" && levelFit(candidate, input.matchLevel).safe)
    .sort(fairnessOrder(input.matchLevel));

  if (input.sourceTeam === "Grön") {
    for (const candidate of yellow) {
      if (selected.size >= targetSize) break;
      const fit = levelFit(candidate, input.matchLevel);
      add(candidate, `Rättvist Gul-lån · ${candidate.recentMatchCount} spelade, ${candidate.upcomingMatchCount} kommande · ${fit.label}`);
    }
    const yellowCount = selectedIds.filter((id) => input.candidates.find((candidate) => candidate.id === id)?.primaryTeamName === "Gul").length;
    return {
      selectedIds,
      reasons,
      yellowCount,
      fillerCount: selectedIds.length - yellowCount,
      targetSize,
    };
  }

  for (const candidate of yellow) {
    if (selected.size >= targetSize) break;
    const fit = levelFit(candidate, input.matchLevel);
    add(candidate, `${candidate.recentMatchCount} spelade, ${candidate.upcomingMatchCount} kommande · ${fit.label}`);
  }

  const fillers = ["F15", "Grön"];
  for (const team of fillers) {
    if (selected.size >= targetSize) break;
    const pool = selectable
      .filter((candidate) => candidate.primaryTeamName === team && !selected.has(candidate.id))
      .filter((candidate) => !(team === "F15" && input.matchLevel === 4))
      .filter((candidate) => levelFit(candidate, input.matchLevel).safe)
      .sort((left, right) => {
        const levelDiff = levelFit(left, input.matchLevel).rank - levelFit(right, input.matchLevel).rank;
        return levelDiff || left.name.localeCompare(right.name, "sv");
      });
    for (const candidate of pool) {
      if (selected.size >= targetSize) break;
      add(candidate, `${team}-utfyllnad · ${levelFit(candidate, input.matchLevel).label}`);
    }
  }

  const yellowCount = selectedIds.filter((id) => input.candidates.find((candidate) => candidate.id === id)?.primaryTeamName === "Gul").length;
  return {
    selectedIds,
    reasons,
    yellowCount,
    fillerCount: selectedIds.length - yellowCount,
    targetSize,
  };
}
