export type SelectionSignals = {
  selectedLastEight: number;
  selectedLastThree: number;
  teamMinimumLastEight: number;
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
  callupCount: number;
  plannedUpcomingCount: number;
  lastSelectedDate: string | null;
  primaryLevel: string;
  secondaryLevel: string;
  primaryPosition: string;
  secondaryPosition: string;
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

  if (signals.selectedLastEight === 0) {
    opportunities.push("Ingen spelad Sanktanmatch bland de senaste åtta matchtillfällena");
  } else if (signals.selectedLastEight <= signals.teamMinimumLastEight + 1) {
    opportunities.push("Har spelat färre Sanktanmatcher än många lagkamrater i den senaste perioden");
  }

  if (signals.activeGoalCount > 0) {
    opportunities.push(
      signals.activeGoalCount === 1
        ? "Har ett aktivt utvecklingsmål att observera"
        : "Har två aktiva utvecklingsmål att observera"
    );
  }

  if (signals.selectedLastThree >= 3) {
    cautions.push("Har spelat tre Sanktanmatcher i följd");
  }

  return { opportunities, cautions };
}

export function squadBalanceWarnings(
  selected: Array<{ position: string; selectedLastThree: number }>
): string[] {
  if (selected.length === 0) return ["Ingen spelare är uttagen ännu"];

  const warnings: string[] = [];
  const normalized = selected.map((row) => row.position.trim().toLowerCase());
  if (!normalized.some((position) => position === "målvakt")) {
    warnings.push("Truppen saknar registrerat målvaktsalternativ");
  }
  if (selected.filter((row) => row.selectedLastThree >= 3).length >= Math.ceil(selected.length / 2)) {
    warnings.push("Minst halva truppen har redan tre uttagningar i följd");
  }
  return warnings;
}

function normalized(value: string): string {
  return value.trim().toLocaleLowerCase("sv");
}

function projectedCallups(candidate: RecommendationCandidate): number {
  return candidate.callupCount + candidate.plannedUpcomingCount;
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
  if (primary === matchLevel) return { rank: 0, label: "primär nivå", safe: true };
  if (secondary === matchLevel) return { rank: 1, label: "sekundär nivå", safe: true };
  const levels = preferredLevels(candidate);
  if (levels.length === 0) return { rank: 2, label: "nivå ej satt", safe: true };
  const distance = Math.min(...levels.map((level) => Math.abs(level - matchLevel)));
  // Lägre Sanktan-nummer är svårare. Två steg över spelarens satta nivå
  // föreslås aldrig automatiskt, men tränaren kan fortsatt välja manuellt.
  const tooHard = levels.every((level) => level - matchLevel >= 2);
  if (distance === 1) return { rank: 2, label: "närliggande nivå", safe: true };
  return { rank: 3, label: "annan nivå", safe: !tooHard };
}

function isGoalkeeper(candidate: RecommendationCandidate): boolean {
  return [candidate.primaryPosition, candidate.secondaryPosition]
    .map(normalized)
    .includes("målvakt");
}

function fairnessOrder(matchLevel: number | null) {
  return (left: RecommendationCandidate, right: RecommendationCandidate) => {
    const callupDiff = projectedCallups(left) - projectedCallups(right);
    if (callupDiff !== 0) return callupDiff;
    const levelDiff = levelFit(left, matchLevel).rank - levelFit(right, matchLevel).rank;
    if (levelDiff !== 0) return levelDiff;
    const leftDate = left.lastSelectedDate ?? "";
    const rightDate = right.lastSelectedDate ?? "";
    return leftDate.localeCompare(rightDate) || left.name.localeCompare(right.name, "sv");
  };
}

/**
 * Ger ett transparent förslag för en Gulmatch. Endast ordinarie Gulspelare
 * rättvisejämförs. F15 och Grön används, i den ordningen, enbart som utfyllnad.
 * Resultatet är deterministiskt och sparas aldrig av motorn själv.
 */
export function recommendYellowSelection(input: {
  candidates: RecommendationCandidate[];
  matchLevel: number | null;
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
  const selectable = input.candidates
    .filter((candidate) => candidate.currentCallupStatus !== "declined")
    .filter((candidate) => !(input.matchLevel === 4 && candidate.teamNames.includes("F15")));

  // Befintliga ja-/inväntande kallelser är verkligt skickade och bevaras i förslaget.
  selectable
    .filter((candidate) => candidate.currentCallupStatus === "accepted" || candidate.currentCallupStatus === "pending")
    .sort((left, right) => left.name.localeCompare(right.name, "sv"))
    .forEach((candidate) => add(candidate, "Redan kallad"));

  const yellow = selectable
    .filter((candidate) => candidate.teamNames.includes("Gul") && levelFit(candidate, input.matchLevel).safe)
    .sort(fairnessOrder(input.matchLevel));

  // Målvakt är det enda hårda positionskravet i första versionen.
  if (![...selected].some((id) => selectable.some((candidate) => candidate.id === id && isGoalkeeper(candidate)))) {
    const goalkeeper = yellow.filter(isGoalkeeper).sort(fairnessOrder(input.matchLevel))[0];
    if (goalkeeper) add(goalkeeper, `Målvakt · ${projectedCallups(goalkeeper)} kallelser`);
  }

  for (const candidate of yellow) {
    if (selected.size >= targetSize) break;
    const fit = levelFit(candidate, input.matchLevel);
    add(candidate, `${projectedCallups(candidate)} kallelser · ${fit.label}`);
  }

  const fillers = ["F15", "Grön"];
  for (const team of fillers) {
    if (selected.size >= targetSize) break;
    const pool = selectable
      .filter((candidate) => candidate.teamNames.includes(team) && !selected.has(candidate.id))
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

  const yellowCount = selectedIds.filter((id) => input.candidates.find((candidate) => candidate.id === id)?.teamNames.includes("Gul")).length;
  return {
    selectedIds,
    reasons,
    yellowCount,
    fillerCount: selectedIds.length - yellowCount,
    targetSize,
  };
}
