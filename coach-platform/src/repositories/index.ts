import type { Exercise, MatchObservation, Player, SeasonPeriod, TrainingSession } from "@/domain/model";

export interface CoachRepository {
  players(teamId: string): Promise<Player[]>;
  exercises(): Promise<Exercise[]>;
  sessions(teamId: string): Promise<TrainingSession[]>;
  periods(teamId: string): Promise<SeasonPeriod[]>;
  observations(teamId: string): Promise<MatchObservation[]>;
}
