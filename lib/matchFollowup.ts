export type MatchFollowupAnswer = {
  playerId: number;
  selfComparison: string | null;
  matchImpact: string | null;
  skipped: boolean;
};

function handled(answer: MatchFollowupAnswer): boolean {
  return answer.skipped || Boolean(answer.selfComparison && answer.matchImpact);
}

export function shouldCloseMatchFollowup(
  playerIds: number[],
  current: MatchFollowupAnswer[],
  submitted: MatchFollowupAnswer[],
  completeWithoutPlayerEvaluations: boolean
): boolean {
  if (completeWithoutPlayerEvaluations) return true;
  if (playerIds.length === 0) return false;
  const answers = new Map(current.map((answer) => [answer.playerId, answer]));
  for (const answer of submitted) answers.set(answer.playerId, answer);
  return playerIds.every((playerId) => {
    const answer = answers.get(playerId);
    return answer ? handled(answer) : false;
  });
}
