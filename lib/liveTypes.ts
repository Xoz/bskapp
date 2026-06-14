// Typer som delas mellan live-API:t och klientkomponenten.
// Får inte importera db – används i webbläsaren.

export interface LivePlayer {
  id: number;
  name: string;
  jersey_number: number | null;
}

export interface LiveEvent {
  id: number;
  player_id: number | null;
  player_name: string | null;
  stat_id: string;
  match_second: number | null;
  period: number | null;
}

export interface Reporter {
  name: string;
  stats: string[];
  lastSeen: number | null; // unix sekunder
}

export interface SubEntry {
  id: number;
  offId: number | null;
  offName: string | null;
  onId: number | null;
  onName: string | null;
  second: number | null;
  period: number | null;
}

export interface LiveState {
  matchId: number;
  opponent: string;
  homeAway: string;
  date: string;
  startTime: string | null;
  periods: number;
  periodMinutes: number;
  ourScore: number;
  oppScore: number;
  clockRunning: boolean;
  clockSeconds: number; // sekunder på periodklockan i serverögonblicket
  period: number;
  players: LivePlayer[];
  // counts[playerId][statId] = antal
  counts: Record<number, Record<string, number>>;
  played: number[];
  events: LiveEvent[];
  reporters: Reporter[];
  finished: boolean;
  subs: SubEntry[];
  // minutes[playerId] = spelade minuter (tomt om ingen startelva är satt)
  minutes: Record<number, number>;
  onField: number[]; // spelare som är på plan just nu
  hasLineup: boolean; // finns en startelva i laguttagningen?
}

export type LiveAction =
  | { type: "event"; playerId: number; statId: string; reporter?: string }
  | { type: "opponent_goal"; reporter?: string }
  | { type: "undo" }
  | { type: "clock"; op: "start" | "pause" | "reset" | "next_period" }
  | { type: "toggle_played"; playerId: number }
  | { type: "claim_stats"; name: string; stats: string[] }
  | { type: "sub"; offId: number; onId: number }
  | { type: "undo_sub" }
  | { type: "finish_match" };

export const OPPONENT_GOAL = "opponent_goal";

export function formatClock(totalSeconds: number) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const mm = String(Math.floor(s / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

// "P2 05:30" – periodmarkerad matchtid för händelser
export function formatEventTime(period: number | null, second: number | null) {
  if (second == null) return "–";
  return period != null ? `P${period} ${formatClock(second)}` : formatClock(second);
}
