// Samma spelarmängd vid visning och sparande: enbart ja-svar, oavsett tidigare uttagning.
export const matchPlanPlayerPredicate = "mr.callup_status = 'accepted'";
export const matchPlanPlayersSql = `SELECT mr.player_id FROM match_roster mr WHERE mr.match_id = ? AND ${matchPlanPlayerPredicate}`;
