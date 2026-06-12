// Statistikfält per spelare och match – det föräldrar rapporterar med matchkoden
export interface StatField {
  id: string;
  label: string;
  short: string;
  hint?: string;
}

export const STAT_FIELDS: StatField[] = [
  { id: "goals", label: "Mål", short: "Mål" },
  { id: "assists", label: "Assist", short: "Ass" },
  { id: "shots", label: "Skott", short: "Skott" },
  { id: "shots_on_target", label: "Skott på mål", short: "SPM" },
  { id: "passes_completed", label: "Lyckade passningar", short: "Pass" },
  { id: "interceptions", label: "Brytningar", short: "Brytn" },
  { id: "saves", label: "Räddningar", short: "Räddn", hint: "målvakt" },
];

export const STAT_IDS = STAT_FIELDS.map((f) => f.id);
