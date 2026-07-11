export type Id = string;
export type GameFormat = "5v5" | "7v7" | "9v9" | "11v11";
export type SkillLevel = 0 | 1 | 2 | 3 | 4 | 5;

export interface Organization { id: Id; name: string }
export interface Team { id: Id; organizationId: Id; name: string; gameFormat: GameFormat }
export interface Player { id: Id; teamId: Id; name: string; birthYear: number; number?: number; positions: string[]; status: "active" | "paused" }
export interface Skill { id: Id; category: string; name: string; description: string }
export interface Exercise { id: Id; name: string; summary: string; durationMinutes: number; players: [number, number]; gameFormats: GameFormat[]; difficulty: 1 | 2 | 3; skillIds: Id[]; equipment: string[] }
export interface TrainingBlock { id: Id; exerciseId: Id; title: string; minutes: number; coachingPoints: string[] }
export interface TrainingSession { id: Id; teamId: Id; title: string; startsAt: string; theme: string; plannedMinutes: number; blocks: TrainingBlock[]; status: "draft" | "planned" | "completed" }
export interface SeasonPeriod { id: Id; name: string; startsOn: string; endsOn: string; theme: string; skillIds: Id[] }
export interface MatchObservation { id: Id; match: string; occurredOn: string; sentiment: "positive" | "develop" | "neutral"; summary: string; skillIds: Id[]; priority: boolean }
export interface DevelopmentGoal { id: Id; playerId: Id; title: string; startsOn: string; endsOn: string; skillIds: Id[]; status: "planned" | "active" | "completed" }
