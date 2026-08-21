import crypto from "node:crypto";
import { all, batch } from "../db";
import { normalizePersonName } from "../attendance";
import { swedishToday } from "../dates";
import {
  normalizeMatchName,
  parseSvenskaLagCallupWorkbook,
  workbookOpponent,
  type SvenskaLagCallupWorkbook,
} from "../callupWorkbook";

export type WorkbookFileInput = {
  name: string;
  buffer: ArrayBuffer;
};

export type CallupWorkbookImportResult = {
  files: number;
  duplicateFiles: number;
  parsedMatchActivities: number;
  matchedMatches: number;
  skippedUnmatchedMatches: number;
  callups: number;
  accepted: number;
  declined: number;
  pending: number;
  attendedPlayersAdded: number;
  ignoredPeople: number;
  dryRun: boolean;
  unmatched: string[];
};

type DbMatch = {
  match_id: number;
  activity_id: string;
  date: string;
  start_time: string | null;
  opponent: string;
  source_team: string;
};

type PreparedMatch = {
  db: DbMatch;
  label: string;
  callups: { playerId: number; status: "present" | "absent" | "unknown" }[];
  attendedPlayerIds: number[];
};

function exactKey(date: string, startTime: string | null, opponent: string, team: string): string {
  return [date, startTime ?? "", normalizeMatchName(opponent), team].join("|");
}

function bufferHash(buffer: ArrayBuffer): string {
  return crypto.createHash("sha256").update(Buffer.from(buffer)).digest("hex");
}

export function canImportPlayedAttendance(activityDate: string, today = swedishToday()): boolean {
  return activityDate <= today;
}

async function parseFiles(files: readonly WorkbookFileInput[]): Promise<{
  workbook: SvenskaLagCallupWorkbook;
  hash: string;
}[]> {
  return Promise.all(files.map(async (file) => ({
    workbook: await parseSvenskaLagCallupWorkbook(file.buffer, file.name),
    hash: bufferHash(file.buffer),
  })));
}

export async function importSvenskaLagCallupWorkbooks(
  files: readonly WorkbookFileInput[],
  importedBy: string,
  options: { dryRun?: boolean } = {},
): Promise<CallupWorkbookImportResult> {
  if (files.length === 0) throw new Error("Minst en Excel-fil krävs.");
  const parsedFiles = await parseFiles(files);
  const periods = [...new Set(parsedFiles.map(({ workbook }) => workbook.period))];
  if (periods.length !== 1) throw new Error("Alla filer måste avse samma år.");
  const teams = parsedFiles.map(({ workbook }) => workbook.sourceTeam);
  if (new Set(teams).size !== teams.length) throw new Error("Ladda endast upp en fil per lag och exporttillfälle.");

  const [players, dbMatches, existingImports] = await Promise.all([
    all<{ id: number; name: string }>("SELECT id, name FROM players WHERE active = 1 ORDER BY name"),
    all<DbMatch>(
      `SELECT DISTINCT ON (m.id) m.id AS match_id, da.id AS activity_id, m.date, m.start_time,
              m.opponent, COALESCE(g.name, '') AS source_team
       FROM matches m
       JOIN development_activities da ON da.match_id = m.id
       LEFT JOIN groups g ON g.id = m.group_id
       WHERE m.date LIKE ?
       ORDER BY m.id,
         CASE WHEN da.external_source = 'svenskalag_sanktan' THEN 0 ELSE 1 END,
         da.id`,
      [`${periods[0]}-%`],
    ),
    all<{ file_hash: string }>(
      `SELECT file_hash FROM svenskalag_file_imports
       WHERE file_hash IN (${parsedFiles.map(() => "?").join(", ")})`,
      parsedFiles.map(({ hash }) => hash),
    ),
  ]);
  const existingHashes = new Set(existingImports.map((row) => row.file_hash));
  const playerByName = new Map(players.map((player) => [normalizePersonName(player.name), player] as const));
  const matchesByKey = new Map<string, DbMatch[]>();
  for (const match of dbMatches) {
    const key = exactKey(match.date, match.start_time, match.opponent, match.source_team);
    matchesByKey.set(key, [...(matchesByKey.get(key) ?? []), match]);
  }

  const prepared: PreparedMatch[] = [];
  const unmatched: string[] = [];
  let parsedMatchActivities = 0;
  let ignoredPeople = 0;
  for (const { workbook } of parsedFiles) {
    for (const activity of workbook.activities) {
      if (!activity.isMatch) continue;
      const opponent = workbookOpponent(activity.title);
      if (!opponent) continue;
      const relevantPeople = activity.people.filter((person) => person.called || person.attended);
      if (relevantPeople.length === 0) continue;
      parsedMatchActivities++;
      const candidates = matchesByKey.get(exactKey(activity.date, activity.startTime, opponent, workbook.sourceTeam)) ?? [];
      const label = `${workbook.sourceTeam} ${activity.date} ${activity.startTime ?? "--:--"} ${opponent}`;
      if (candidates.length !== 1) {
        unmatched.push(label);
        continue;
      }
      const callups: PreparedMatch["callups"] = [];
      const attendedPlayerIds: number[] = [];
      const seenCallups = new Set<number>();
      const seenAttendance = new Set<number>();
      for (const person of relevantPeople) {
        const player = playerByName.get(normalizePersonName(person.name));
        if (!player) {
          ignoredPeople++;
          continue;
        }
        if (person.called && !seenCallups.has(player.id)) {
          seenCallups.add(player.id);
          callups.push({
            playerId: player.id,
            status: person.accepted ? "present" : person.declined ? "absent" : "unknown",
          });
        }
        // Svenska Lag kan ha N-markeringar även för framtida aktiviteter.
        // Sådana är planering, aldrig bevis för en redan spelad match.
        if (person.attended && canImportPlayedAttendance(activity.date) && !seenAttendance.has(player.id)) {
          seenAttendance.add(player.id);
          attendedPlayerIds.push(player.id);
        }
      }
      // En match med enbart ledare eller spelare som inte finns i appen får
      // aldrig radera redan sparade kallelser.
      if (callups.length > 0 || attendedPlayerIds.length > 0) {
        prepared.push({ db: candidates[0], label, callups, attendedPlayerIds });
      }
    }
  }

  const duplicateActivityIds = prepared
    .map((item) => item.db.activity_id)
    .filter((id, index, allIds) => allIds.indexOf(id) !== index);
  if (duplicateActivityIds.length > 0) {
    throw new Error(`Samma match förekommer i flera filer: ${[...new Set(duplicateActivityIds)].join(", ")}`);
  }

  const result: CallupWorkbookImportResult = {
    files: parsedFiles.length,
    duplicateFiles: parsedFiles.filter(({ hash }) => existingHashes.has(hash)).length,
    parsedMatchActivities,
    matchedMatches: prepared.length,
    skippedUnmatchedMatches: unmatched.length,
    callups: prepared.reduce((sum, item) => sum + item.callups.length, 0),
    accepted: prepared.reduce((sum, item) => sum + item.callups.filter((callup) => callup.status === "present").length, 0),
    declined: prepared.reduce((sum, item) => sum + item.callups.filter((callup) => callup.status === "absent").length, 0),
    pending: prepared.reduce((sum, item) => sum + item.callups.filter((callup) => callup.status === "unknown").length, 0),
    attendedPlayersAdded: prepared.reduce((sum, item) => sum + item.attendedPlayerIds.length, 0),
    ignoredPeople,
    dryRun: options.dryRun ?? false,
    unmatched,
  };
  if (options.dryRun) return result;

  const statements: { sql: string; args: (string | number | null)[] }[] = [];
  for (const { workbook, hash } of parsedFiles) {
    statements.push({
      sql: `INSERT INTO svenskalag_file_imports
            (file_hash, file_name, team_name, period_label, exported_at, imported_by)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT (file_hash) DO UPDATE SET imported_at = to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD HH24:MI:SS')`,
      args: [hash, workbook.fileName.slice(0, 180), workbook.teamName, workbook.period, workbook.exportedAt, importedBy],
    });
  }
  for (const item of prepared) {
    statements.push({ sql: "DELETE FROM development_activity_callups WHERE activity_id = ?", args: [item.db.activity_id] });
    for (const callup of item.callups) {
      statements.push({
        sql: "INSERT INTO development_activity_callups (activity_id, player_id, attendance_status) VALUES (?, ?, ?)",
        args: [item.db.activity_id, callup.playerId, callup.status],
      });
    }
    const accepted = item.callups.filter((callup) => callup.status === "present").length;
    const declined = item.callups.filter((callup) => callup.status === "absent").length;
    const pending = item.callups.filter((callup) => callup.status === "unknown").length;
    statements.push({
      sql: `INSERT INTO development_activity_callup_summaries
            (activity_id, accepted_count, declined_count, pending_count, source, updated_at)
            VALUES (?, ?, ?, ?, 'svenskalag_file', to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD HH24:MI:SS'))
            ON CONFLICT (activity_id) DO UPDATE SET accepted_count = excluded.accepted_count,
              declined_count = excluded.declined_count, pending_count = excluded.pending_count,
              source = excluded.source, updated_at = excluded.updated_at`,
      args: [item.db.activity_id, accepted, declined, pending],
    });
    for (const playerId of item.attendedPlayerIds) {
      statements.push({
        sql: "INSERT INTO match_players (match_id, player_id) VALUES (?, ?) ON CONFLICT (match_id, player_id) DO NOTHING",
        args: [item.db.match_id, playerId],
      });
      statements.push({
        sql: `INSERT INTO development_activity_participation
              (activity_id, player_id, attendance_status, source)
              VALUES (?, ?, 'present', 'svenskalag_file')
              ON CONFLICT (activity_id, player_id) DO UPDATE SET attendance_status = 'present',
                source = CASE WHEN development_activity_participation.source = 'manual'
                  THEN development_activity_participation.source ELSE excluded.source END,
                updated_at = to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD HH24:MI:SS')`,
        args: [item.db.activity_id, playerId],
      });
    }
  }
  await batch(statements);
  return result;
}
