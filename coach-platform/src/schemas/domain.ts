import { z } from "zod";

export const seasonPeriodSchema = z.object({
  id: z.string().min(1), name: z.string().min(2).max(80),
  startsOn: z.iso.date(), endsOn: z.iso.date(), theme: z.string().min(2),
  skillIds: z.array(z.string()),
}).refine((period) => period.startsOn <= period.endsOn, { message: "Slutdatum måste vara efter startdatum", path: ["endsOn"] });

export const attendanceSchema = z.object({
  playerId: z.string().min(1),
  status: z.enum(["present", "absent", "late", "partial", "trial"]),
});

export const matchSchema = z.object({ opponent: z.string().min(2).max(100), startsAt: z.string().datetime(), location: z.string().max(120), gameFormat: z.enum(["5v5", "7v7", "9v9", "11v11"]), result: z.string().max(30) });
export const observationSchema = z.object({ matchId: z.string().uuid(), summary: z.string().min(4).max(1200), sentiment: z.enum(["positive", "develop", "neutral"]), playerId: z.string().uuid().optional(), skillIds: z.array(z.string().uuid()).max(5), priority: z.boolean() });
export const developmentGoalSchema = z.object({ playerId: z.string().uuid(), title: z.string().min(3).max(160), description: z.string().max(1200), startsOn: z.iso.date(), endsOn: z.iso.date(), status: z.enum(["planned", "active", "completed"]), skillIds: z.array(z.string().uuid()).min(1).max(4) }).refine(v => v.startsOn <= v.endsOn, { path: ["endsOn"], message: "Slutdatum måste vara efter startdatum" });
