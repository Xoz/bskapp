import { NextResponse } from "next/server";
import { requireCoachIdentity } from "@/lib/coach-session";
import { exportPilotData } from "@/repositories/postgres";
export async function GET() { await requireCoachIdentity(); const data = await exportPilotData(); return new NextResponse(JSON.stringify(data, null, 2), { headers: { "content-type": "application/json", "content-disposition": `attachment; filename="planlinjen-export-${data.exportedAt.slice(0,10)}.json"`, "cache-control": "no-store" } }); }
