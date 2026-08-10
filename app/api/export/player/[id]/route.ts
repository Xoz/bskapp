import { NextResponse } from "next/server";
import { canAccessPlayer, getCurrentUser, hasPermission } from "@/lib/auth";
import { exportPlayerData } from "@/lib/playerPrivacy";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const playerId = Number(id);
  const user = await getCurrentUser();
  if (!Number.isInteger(playerId) || playerId < 1 || !user || !(await hasPermission("manage_users")) || !(await canAccessPlayer(playerId))) {
    return NextResponse.json({ error: "Behörighet saknas." }, { status: 403 });
  }
  const data = await exportPlayerData(playerId, user.name || user.email);
  if (!data) return NextResponse.json({ error: "Spelaren hittades inte." }, { status: 404 });
  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="bsk-spelarutdrag-${playerId}.json"`,
      "cache-control": "no-store",
    },
  });
}
