import { z } from "zod";

export const seasonPeriodSchema = z.object({
  id: z.string().min(1), name: z.string().min(2).max(80),
  startsOn: z.iso.date(), endsOn: z.iso.date(), theme: z.string().min(2),
  skillIds: z.array(z.string()),
}).refine((period) => period.startsOn <= period.endsOn, { message: "Slutdatum måste vara efter startdatum", path: ["endsOn"] });

export const attendanceSchema = z.object({
  playerId: z.string().min(1),
  status: z.enum(["present", "absent", "late", "partial", "injured", "trial"]),
});
