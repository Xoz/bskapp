import { NextResponse } from "next/server";
import { requireHeadCoachIdentity } from "@/lib/coach-session";
import { exportPlayerData } from "@/repositories/postgres";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireHeadCoachIdentity();
  const { id } = await params;
  const data = await exportPlayerData(id);
  if (!data) return NextResponse.json({ error: "Spelaren hittades inte." }, { status: 404 });
  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="planlinjen-spelarutdrag-${id}.json"`,
      "cache-control": "no-store",
    },
  });
}
