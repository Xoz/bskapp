import { all, get, type SqlArgs } from "./db";

export type MatchRosterSource =
  | "played"
  | "confirmed"
  | "selection"
  | "participation"
  | "accepted"
  | "lineup"
  | "none";

export type MatchRosterPlayer = {
  id: number;
  name: string;
  jersey_number: number | null;
};

type MatchRosterCandidate = MatchRosterPlayer & {
  match_id: number;
  source: Exclude<MatchRosterSource, "none">;
};

export type MatchRoster = {
  matchId: number;
  source: MatchRosterSource;
  label: string;
  confirmed: boolean;
  players: MatchRosterPlayer[];
};

const UPCOMING_PRIORITY: MatchRosterCandidate["source"][] = [
  "confirmed",
  "selection",
  "participation",
  "accepted",
  "played",
  "lineup",
];

const PLAYED_PRIORITY: MatchRosterCandidate["source"][] = [
  "played",
  "confirmed",
  "selection",
  "participation",
  "accepted",
  "lineup",
];

export function matchRosterLabel(source: MatchRosterSource): string {
  switch (source) {
    case "played": return "Deltog";
    case "confirmed": return "Trupp";
    case "lineup": return "Laguppställning";
    case "selection":
    case "participation":
    case "accepted": return "Preliminär trupp";
    default: return "Ingen trupp";
  }
}

export function selectMatchRoster(
  matchId: number,
  isPlayed: boolean,
  candidates: MatchRosterCandidate[]
): MatchRoster {
  const matchCandidates = candidates.filter((candidate) => candidate.match_id === matchId);
  const priority = isPlayed ? PLAYED_PRIORITY : UPCOMING_PRIORITY;
  const source = priority.find((candidateSource) =>
    matchCandidates.some((candidate) => candidate.source === candidateSource)
  ) ?? "none";
  const byId = new Map<number, MatchRosterPlayer>();
  for (const candidate of matchCandidates) {
    if (candidate.source !== source) continue;
    byId.set(candidate.id, {
      id: candidate.id,
      name: candidate.name,
      jersey_number: candidate.jersey_number,
    });
  }
  const players = [...byId.values()].sort((left, right) => left.name.localeCompare(right.name, "sv"));
  return {
    matchId,
    source,
    label: matchRosterLabel(source),
    confirmed: source === "confirmed",
    players,
  };
}

function placeholders(values: readonly unknown[]): string {
  return values.map(() => "?").join(", ");
}

export async function resolveMatchRosters(matchIds: number[]): Promise<Map<number, MatchRoster>> {
  const ids = [...new Set(matchIds.filter((id) => Number.isInteger(id) && id > 0))];
  if (ids.length === 0) return new Map();
  const marks = placeholders(ids);
  const metadata = await all<{ id: number; is_played: boolean }>(
    `SELECT m.id,
            (
              m.finished = 1
              OR m.date < to_char(now() AT TIME ZONE 'Europe/Stockholm', 'YYYY-MM-DD')
              OR (
                m.start_time IS NOT NULL
                AND m.date::date + m.start_time::time + INTERVAL '90 minutes'
                    <= now() AT TIME ZONE 'Europe/Stockholm'
              )
            ) AS is_played
     FROM matches m
     WHERE m.id IN (${marks})`,
    ids
  );
  const repeatedIds: SqlArgs = [ids, ids, ids, ids, ids, ids].flat() as SqlArgs;
  const candidates = await all<MatchRosterCandidate>(
    `SELECT source.match_id, source.source, p.id, p.name, p.jersey_number
     FROM (
       SELECT mp.match_id, mp.player_id, 'played' AS source
       FROM match_players mp WHERE mp.match_id IN (${marks})
       UNION ALL
       SELECT squad.match_id, squad.player_id, 'confirmed' AS source
       FROM match_squad squad WHERE squad.match_id IN (${marks})
       UNION ALL
       SELECT da.match_id, decision.player_id, 'selection' AS source
       FROM development_selection_decisions decision
       JOIN development_activities da ON da.id = decision.activity_id
       WHERE da.match_id IN (${marks}) AND decision.decision = 'selected'
       UNION ALL
       SELECT da.match_id, participation.player_id, 'participation' AS source
       FROM development_activity_participation participation
       JOIN development_activities da ON da.id = participation.activity_id
       WHERE da.match_id IN (${marks}) AND participation.selected = 1
       UNION ALL
       SELECT da.match_id, callup.player_id, 'accepted' AS source
       FROM development_activity_callups callup
       JOIN development_activities da ON da.id = callup.activity_id
       WHERE da.match_id IN (${marks}) AND callup.attendance_status = 'present'
       UNION ALL
       SELECT lineup.match_id, lineup.player_id, 'lineup' AS source
       FROM match_lineup lineup WHERE lineup.match_id IN (${marks})
     ) source
     JOIN players p ON p.id = source.player_id AND p.active = 1`,
    repeatedIds
  );
  return new Map(metadata.map((match) => [
    match.id,
    selectMatchRoster(match.id, Boolean(match.is_played), candidates),
  ]));
}

export async function resolveMatchRoster(matchId: number): Promise<MatchRoster | null> {
  return (await resolveMatchRosters([matchId])).get(matchId) ?? null;
}
