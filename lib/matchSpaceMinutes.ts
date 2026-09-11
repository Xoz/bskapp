import { readMatchPlan } from "./matchPlan/model";

export type MatchSpaceParticipant = {
  player_id: number;
  attendance_position: string | null;
  selected_position: string | null;
  preferred_position_primary: string | null;
  position: string | null;
};

/** Synkad spelform prioriteras; äldre matcher använder längden som fallback.
 * Kortare cupmatcher behåller sin registrerade längd och sex utespelarplatser. */
export function sharedMatchMinutes(duration: number, participants: number, goalkeeper: boolean, format?: 7 | 9): number {
  if (goalkeeper || participants <= 1) return duration;
  const outfieldSlots = (format ?? (duration === 75 ? 9 : 7)) - 1;
  return Math.min(duration, outfieldSlots * duration / (participants - 1));
}

/** Matchens position väger tyngre än spelarprofilen. Vi gissar aldrig mellan
 * två målvakter med samma prioritet; okänd målvakt ska synas i underlaget. */
export function matchSpaceGoalkeeper(players: MatchSpaceParticipant[], planRaw?: string): number | null {
  const plan = readMatchPlan(planRaw || "");
  const candidates = players.map(p => {
    const spot = plan?.document.spots.findIndex(s => s.playerId === p.player_id) ?? -1;
    const roles = [p.attendance_position, spot < 0 ? null : spot === 0 ? "gk" : "outfield",
      p.selected_position, p.preferred_position_primary || p.position];
    const priority = roles.findIndex(r => Boolean(r?.trim()));
    const role = roles[priority]?.trim().toLocaleLowerCase("sv");
    return {id:p.player_id, priority, keeper:role === "målvakt" || role === "malvakt" || role === "gk"};
  }).filter(p => p.keeper);
  if (!candidates.length) return null;
  const best = Math.min(...candidates.map(p => p.priority));
  const keepers = candidates.filter(p => p.priority === best);
  return keepers.length === 1 ? keepers[0].id : null;
}
