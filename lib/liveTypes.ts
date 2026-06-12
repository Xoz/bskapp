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
}

export interface LiveState {
  matchId: number;
  opponent: string;
  homeAway: string;
  date: string;
  ourScore: number;
  oppScore: number;
  clockRunning: boolean;
  clockSeconds: number; // sekunder på matchklockan i serverögonblicket
  players: LivePlayer[];
  // counts[playerId][statId] = antal
  counts: Record<number, Record<string, number>>;
  played: number[];
  events: LiveEvent[];
}

export type LiveAction =
  | { type: "event"; playerId: number; statId: string }
  | { type: "opponent_goal" }
  | { type: "undo" }
  | { type: "clock"; op: "start" | "pause" | "reset" }
  | { type: "toggle_played"; playerId: number };

export const OPPONENT_GOAL = "opponent_goal";
