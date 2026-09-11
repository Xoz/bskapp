import "server-only";
import { sharedMatchMinutes, matchSpaceGoalkeeper, type MatchSpaceParticipant } from "./matchSpaceMinutes";
import { GREEN_STATUS_KEY, type SyncStatus } from "./svenskalag/model";
import { all, get } from "./db";
import { canAccessGroup, canAccessPlayer, getCurrentUser } from "./auth";
import { swedishDate, swedishWallClockToEpoch } from "./dates";
import { validCapacity, type SpaceEvent, type SpaceInput } from "./matchSpace";

export const capacityKey = (id: number) => `match_space_capacity:${id}`;

/** Användarens behörighet kontrolleras innan historik från spelarens alla lag läses. */
export async function getMatchSpaceInputs(playerIds: number[], targetMatchId?: number): Promise<Map<number, SpaceInput>> {
  const actor = await getCurrentUser();
  if (!actor?.permissions.includes("view_players")) throw new Error("Behörighet saknas.");
  const ids = [...new Set(playerIds)];
  if (!ids.length) return new Map();
  if ((await Promise.all(ids.map(id => canAccessPlayer(id)))).some(ok => !ok)) throw new Error("Spelaråtkomst saknas.");
  const target = targetMatchId == null ? null : await get<{id: number; date: string; start_time: string | null; periods: number; period_minutes: number; opponent: string; group_id: number | null}>(
    "SELECT id, date, start_time, periods, period_minutes, opponent, group_id FROM matches WHERE id=? AND cancelled=0 AND finished=0", [targetMatchId]);
  if (targetMatchId != null && (!target || !(await canAccessGroup(target.group_id)))) throw new Error("Matchen är inte tillgänglig.");
  const now = Date.now();
  const targetStart = target ? swedishWallClockToEpoch(target.date, target.start_time || "12:00") : now;
  const from = swedishDate(new Date(Math.min(now, targetStart) - 28 * 86400000));
  const to = swedishDate(new Date(Math.max(now, targetStart) + 7 * 86400000));
  const marks = ids.map(() => "?").join(",");
  const greenRow = await get<{value:string}>("SELECT value FROM settings WHERE key=?", [GREEN_STATUS_KEY]);
  let green: SyncStatus | null = null;
  try { green = greenRow ? JSON.parse(greenRow.value) : null; } catch { /* Saknat underlag visas. */ }
  const greenFresh = green?.lastSuccess && Number.isFinite(Date.parse(green.lastSuccess)) && now-Date.parse(green.lastSuccess) < 26*60*60*1000;
  const sourceWarning = !greenFresh || green?.state === "error" || green?.state === "login_required"
    ? "Gröns matchunderlag är inte aktuellt eller ännu inte verifierat. Kontrollera eventuella lån."
    : green?.unmatched?.length ? "Gröns synk har olösta kopplingar. Vissa lån kan saknas i prognosen." : undefined;
  // match_players bevarar statistik. Källans verifierade närvaro avgör om
  // deltagandet fortfarande gäller efter en rättning i Svenska Lag.
  const participated = `mp.player_id IS NOT NULL AND (
    NOT EXISTS (SELECT 1 FROM settings ps WHERE ps.key='svenskalag_presence:' || m.id::text)
    OR EXISTS (SELECT 1 FROM development_activities pa
      JOIN development_activity_participation pp ON pp.activity_id=pa.id
      WHERE pa.match_id=m.id AND pp.player_id=p.id AND pp.attendance_status='present'))`;
  const [settings, matches, trainings] = await Promise.all([
    all<{key: string; value: string}>(`SELECT key, value FROM settings WHERE key IN (${marks})`, ids.map(capacityKey)),
    all<MatchSpaceParticipant & {id: number; date: string; start_time: string | null; opponent: string; duration: number; played: boolean; callup_status: string | null}>(`
      SELECT p.id AS player_id, m.id, m.date, m.start_time, m.opponent,
        m.periods * m.period_minutes AS duration,
        p.preferred_position_primary, p.position, mr.selected_position, mr.callup_status,
        (SELECT pp.position FROM development_activities pa
          JOIN development_activity_participation pp ON pp.activity_id=pa.id
          WHERE pa.match_id=m.id AND pp.player_id=p.id AND pp.attendance_status='present'
            AND pp.position <> '' ORDER BY pp.updated_at DESC LIMIT 1) AS attendance_position,
        (${participated} AND (m.finished=1 OR m.date < ?)) AS played
      FROM players p JOIN matches m ON m.date BETWEEN ? AND ? AND m.cancelled=0
      LEFT JOIN match_players mp ON mp.match_id=m.id AND mp.player_id=p.id
      LEFT JOIN match_roster mr ON mr.match_id=m.id AND mr.player_id=p.id
      WHERE (
        (${participated} AND (m.finished=1 OR m.date < ?))
        OR (m.finished=0 AND m.date >= ? AND mr.callup_status IS DISTINCT FROM 'declined'
          AND (mr.selection_status='selected' OR mr.callup_status IN ('accepted','pending'))))
      ORDER BY m.date, m.start_time, m.id`, [swedishDate(new Date(now)), from, to, swedishDate(new Date(now)), swedishDate(new Date(now))]),
    all<{player_id: number; id: string; activity_date: string; start_time: string | null; title: string; played: boolean}>(`
      SELECT DISTINCT ON (p.id, da.activity_date, da.start_time, da.group_id)
        p.id AS player_id, da.id, da.activity_date, da.start_time, da.title,
        (ap.attendance_status='present') IS TRUE AS played
      FROM players p JOIN development_activities da ON da.activity_type='training' AND da.activity_date BETWEEN ? AND ?
      LEFT JOIN development_activity_participation ap ON ap.activity_id=da.id AND ap.player_id=p.id
      LEFT JOIN development_activity_callups ac ON ac.activity_id=da.id AND ac.player_id=p.id
      WHERE p.id IN (${marks}) AND (
        ap.attendance_status='present' OR (da.activity_date >= ? AND ac.attendance_status IN ('present','unknown') AND ap.attendance_status IS DISTINCT FROM 'absent'))
      ORDER BY p.id, da.activity_date, da.start_time, da.group_id, played DESC, da.id`, [from, to, ...ids, swedishDate(new Date(now))]),
  ]);
  // Alla deltagare behövs i nämnaren, även när bara en spelarprofil efterfrågas.
  const matchIds = [...new Set([...matches.map(m => m.id), ...(target ? [target.id] : [])])];
  const plans = matchIds.length ? await all<{key:string; value:string}>(
    `SELECT key,value FROM settings WHERE key IN (${matchIds.map(() => "?").join(",")})`, matchIds.map(id => `match_plan:${id}`)) : [];
  const planById = new Map(plans.map(p => [Number(p.key.split(":")[1]), p.value]));
  const participants = new Map(matchIds.map(id => {
    const rows = matches.filter(m => m.id === id);
    const confirmed = rows.filter(m => m.played || m.callup_status === "accepted");
    return [id, confirmed.length ? confirmed : rows];
  }));
  const estimate = (matchId:number, playerId:number, duration:number) => {
    const rows = participants.get(matchId)!;
    const included = rows.some(p => p.player_id === playerId);
    const candidate = matches.find(m => m.id === matchId && m.player_id === playerId);
    const keeper = matchSpaceGoalkeeper(!included && candidate ? [...rows,candidate] : rows, planById.get(matchId));
    return {minutes:sharedMatchMinutes(duration, rows.length + (included ? 0 : 1), keeper === playerId), keeper};
  };
  const capacities = new Map(settings.map(row => [row.key, Number(row.value)]));
  const result = new Map<number, SpaceInput>(ids.map(id => {
    const capacity = capacities.get(capacityKey(id)) ?? 100;
    return [id, { sourceWarning, capacity: validCapacity(capacity) ? capacity : 100, now, events: [], target: target ? {
      id: `match:${target.id}`, title: `Mot ${target.opponent}`, start: targetStart, duration: target.periods * target.period_minutes,
      minutes: estimate(target.id, id, target.periods * target.period_minutes).minutes, kind: "match", planned: true, estimated: true,
    } : undefined }];
  }));
  for (const row of matches) {
    if (!result.has(row.player_id)) continue;
    const start = swedishWallClockToEpoch(row.date, row.start_time || "12:00");
    if (!row.played && start < now) continue;
    const event: SpaceEvent = { id: `match:${row.id}`, title: `Mot ${row.opponent}`, start,
      duration: row.duration, minutes: estimate(row.id, row.player_id, row.duration).minutes,
      kind: "match", planned: !row.played, estimated: true };
    result.get(row.player_id)!.events.push(event);
  }
  for (const row of trainings) {
    const start = swedishWallClockToEpoch(row.activity_date, row.start_time || "18:00");
    if (!row.played && start < now) continue;
    result.get(row.player_id)!.events.push({id: `training:${row.id}`, title: row.title, start,
      duration: 60, minutes: 60, kind: "training", planned: !row.played, estimated: true});
  }
  for (const [id, input] of result) {
    const relevant = matches.filter(m => m.player_id === id).map(m => m.id);
    if (target) relevant.push(target.id);
    if (relevant.some(matchId => estimate(matchId, id, 60).keeper == null)) {
      input.sourceWarning = [input.sourceWarning, "Målvakt saknas eller är otydlig i någon match. Speltiden uppskattas med en reserverad målvaktsplats; kontrollera matchens positioner."].filter(Boolean).join(" ");
    }
  }
  return result;
}
