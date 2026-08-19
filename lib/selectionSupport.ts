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
