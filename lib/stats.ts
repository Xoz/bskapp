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

// Kort – loggas per spelare men räknas inte som vanlig statistik och påverkar
// inte resultatet. Hålls utanför STAT_FIELDS så de inte syns i statistiktabeller.
export const CARD_FIELDS: StatField[] = [
  { id: "yellow_card", label: "Gult kort", short: "Gult" },
  { id: "red_card", label: "Rött kort", short: "Rött" },
];
export const CARD_IDS = CARD_FIELDS.map((f) => f.id);

// Alla fält som har en kolumn i match_players och kan loggas live
export const LIVE_COUNT_IDS = [...STAT_IDS, ...CARD_IDS];
