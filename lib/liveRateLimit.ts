import { run } from "./db";

const WINDOW_SECONDS = 10;

async function consume(matchId: number, key: string, limit: number, now: number): Promise<boolean> {
  const rows = await run(
    `INSERT INTO live_rate_limits (match_id, reporter_key, window_start, event_count)
     VALUES (?, ?, ?, 1)
     ON CONFLICT(match_id, reporter_key) DO UPDATE SET
       window_start = CASE WHEN live_rate_limits.window_start <= ? THEN excluded.window_start ELSE live_rate_limits.window_start END,
       event_count = CASE WHEN live_rate_limits.window_start <= ? THEN 1 ELSE live_rate_limits.event_count + 1 END
     WHERE live_rate_limits.window_start <= ? OR live_rate_limits.event_count < ?
     RETURNING event_count`,
    [matchId, key, now, now - WINDOW_SECONDS, now - WINDOW_SECONDS, now - WINDOW_SECONDS, limit]
  );
  return rows.length === 1;
}

export async function consumePublicReportRate(matchId: number, reporterKey: string): Promise<boolean> {
  const now = Math.floor(Date.now() / 1000);
  if (!(await consume(matchId, "__match__", 60, now))) return false;
  return consume(matchId, reporterKey, 30, now);
}
