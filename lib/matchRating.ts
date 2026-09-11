import { level, LEVELS } from './levels';
export const RATING_LABELS = ['Hade stora svårigheter', 'Klarade delar, behövde mycket stöd', 'Klarade nivån', 'Klarade nivån med god marginal', 'Var klart över nivån'];
export const RATING_RULES = { minimumMatches: 5, establishedAverage: 3, challengeAverage: 4, windowDays: 180, halfLifeDays: 60 };
export type RatingEvidence = { match_id: number; date: string; rating: number | null; match_level: string };
export function assessMatchLevel(rows: RatingEvidence[], today: string) {
  const end = Date.parse(`${today}T12:00:00Z`);
  const eligible = rows.filter(row => {
    const age = (end - Date.parse(`${row.date}T12:00:00Z`)) / 86400000;
    return row.rating != null && row.rating >= 1 && row.rating <= 5 && age >= 0 && age <= RATING_RULES.windowDays;
  });
  const levels = LEVELS.map(item => {
    // Ett match-id väger en gång, även om flera tränare har bedömt matchen.
    const matches = new Map<number, RatingEvidence[]>();
    for (const row of eligible.filter(row => level(row.match_level)?.id === item.id)) matches.set(row.match_id, [...(matches.get(row.match_id) ?? []), row]);
    let sum = 0, weights = 0;
    for (const group of matches.values()) {
      const weight = 2 ** (-((end - Date.parse(`${group[0].date}T12:00:00Z`)) / 86400000) / RATING_RULES.halfLifeDays);
      sum += group.reduce((n, row) => n + row.rating!, 0) / group.length * weight;
      weights += weight;
    }
    return { ...item, count: matches.size, average: weights ? sum / weights : null };
  });
  const established = levels.filter(row => row.count >= RATING_RULES.minimumMatches && row.average! >= RATING_RULES.establishedAverage).at(-1) ?? null;
  const challenge = established && established.average! >= RATING_RULES.challengeAverage ? LEVELS.find(item => item.rank === established.rank + 1) ?? null : null;
  return { levels, established, challenge, unknown: new Set(eligible.filter(row => !level(row.match_level)).map(row => row.match_id)).size };
}
export function ratingStatement(matchId: number, playerId: number, contributorType: string, contributorId: string, rating: number | null, comment: string, matchLevel: string) {
  if (rating !== null && (!Number.isInteger(rating) || rating < 1 || rating > 5)) throw new Error('Välj en poäng mellan 1 och 5.');
  if (comment.length > 1000) throw new Error('Spelarkommentaren får vara högst 1000 tecken.');
  return {
    sql: `INSERT INTO match_player_evaluations (match_id, player_id, contributor_type, contributor_id, self_comparison, match_impact, rating, rating_comment, match_level_snapshot, skipped)
      VALUES (?, ?, ?, ?, NULL, NULL, ?, ?, ?, ?)
      ON CONFLICT(match_id, player_id, contributor_type, contributor_id) DO UPDATE SET
      self_comparison=NULL, match_impact=NULL, reason_tag='', rating=excluded.rating, rating_comment=excluded.rating_comment,
      match_level_snapshot=excluded.match_level_snapshot, skipped=excluded.skipped, updated_at=now()`,
    args: [matchId, playerId, contributorType, contributorId, rating, comment.trim(), level(matchLevel)?.id ?? '', rating === null ? 1 : 0],
  };
}
