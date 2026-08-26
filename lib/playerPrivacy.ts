import { all, batch, get, run } from "./db";

export async function exportPlayerData(playerId: number, actor: string) {
  const player = await get<Record<string, unknown>>("SELECT * FROM players WHERE id = ?", [playerId]);
  if (!player) return null;
  const [evaluations, evaluationScores, selfEvaluations, matchStatistics, matchEvaluations, attendance, skillStatuses, skillNotes, checkpoints, checkpointSkills, conversations, memberships, accountLinks] = await Promise.all([
    all<Record<string, unknown>>("SELECT * FROM evaluations WHERE player_id = ? ORDER BY date, id", [playerId]),
    all<Record<string, unknown>>("SELECT es.* FROM evaluation_scores es JOIN evaluations e ON e.id=es.evaluation_id WHERE e.player_id = ? ORDER BY es.evaluation_id,es.skill_id", [playerId]),
    all<Record<string, unknown>>("SELECT * FROM player_self_evals WHERE player_id = ? ORDER BY created_at,id", [playerId]),
    all<Record<string, unknown>>("SELECT mp.*,m.date,m.opponent,m.cup_name,m.cup_group FROM match_players mp JOIN matches m ON m.id=mp.match_id WHERE mp.player_id = ? ORDER BY m.date,m.id", [playerId]),
    all<Record<string, unknown>>("SELECT me.*,m.date,m.opponent FROM match_player_evaluations me JOIN matches m ON m.id=me.match_id WHERE me.player_id = ? ORDER BY m.date,m.id", [playerId]),
    all<Record<string, unknown>>("SELECT * FROM attendance_events WHERE player_id = ? ORDER BY activity_date,id", [playerId]),
    all<Record<string, unknown>>("SELECT * FROM player_skill_status WHERE player_id = ? ORDER BY skill_id", [playerId]),
    all<Record<string, unknown>>("SELECT * FROM player_skill_notes WHERE player_id = ?", [playerId]),
    all<Record<string, unknown>>("SELECT * FROM development_checkpoints WHERE player_id = ? ORDER BY date,id", [playerId]),
    all<Record<string, unknown>>("SELECT dcs.* FROM development_checkpoint_skills dcs JOIN development_checkpoints dc ON dc.id=dcs.checkpoint_id WHERE dc.player_id = ? ORDER BY dcs.checkpoint_id,dcs.skill_id", [playerId]),
    all<Record<string, unknown>>("SELECT * FROM player_conversations WHERE player_id = ? ORDER BY conversation_date,id", [playerId]),
    all<Record<string, unknown>>("SELECT pgm.*,g.name group_name,g.group_type FROM player_group_memberships pgm JOIN groups g ON g.id=pgm.group_id WHERE pgm.player_id = ? ORDER BY g.name", [playerId]),
    all<Record<string, unknown>>("SELECT upl.relation,u.email,u.name FROM user_player_links upl JOIN users u ON u.id=upl.user_id WHERE upl.player_id = ? ORDER BY u.email", [playerId]),
  ]);
  await run("INSERT INTO activity_log (coach_name,action,subject) VALUES (?, 'Exporterade spelarutdrag', ?)", [actor, `player:${playerId}`]);
  return {
    schemaVersion: 2,
    exportedAt: new Date().toISOString(),
    player,
    evaluations,
    evaluationScores,
    selfEvaluations,
    matchStatistics,
    matchEvaluations,
    attendance,
    skillStatuses,
    skillNotes,
    developmentCheckpoints: checkpoints,
    developmentCheckpointSkills: checkpointSkills,
    playerConversations: conversations,
    groupMemberships: memberships,
    accountLinks,
  };
}

export async function erasePlayerData(playerId: number, actor: string): Promise<boolean> {
  const player = await get<{ name: string }>("SELECT name FROM players WHERE id = ?", [playerId]);
  if (!player) return false;
  await batch([
    { sql: "DELETE FROM attendance_events WHERE player_id = ?", args: [playerId] },
    { sql: "DELETE FROM activity_log WHERE subject = ?", args: [player.name] },
    { sql: "DELETE FROM players WHERE id = ?", args: [playerId] },
    { sql: "INSERT INTO activity_log (coach_name,action,subject) VALUES (?, 'Raderade spelaruppgifter', ?)", args: [actor, `player:${playerId}`] },
  ]);
  return true;
}
