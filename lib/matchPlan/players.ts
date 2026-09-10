// Samma spelarmängd vid visning och sparande: ja-svar samt befintlig uttagning.
export const matchPlanPlayerPredicate = "(mr.callup_status = 'accepted' OR mr.selection_status = 'selected')";
export const matchPlanPlayersSql = `SELECT mr.player_id FROM match_roster mr WHERE mr.match_id = ? AND ${matchPlanPlayerPredicate}`;
