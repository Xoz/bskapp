import { NextRequest, NextResponse } from "next/server";
import { saveIntervju } from "@/lib/queries";
import { getCoachName, getPlayerSession, getRole } from "@/lib/auth";
import { logActivity } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  // Skyddad: bara inloggad spelare (PIN) eller tränare får spara intervjuer.
  const [playerId, role] = await Promise.all([getPlayerSession(), getRole()]);
  if (!playerId && role !== "coach") {
    return NextResponse.json({ error: "Ej behörig" }, { status: 401 });
  }

  let body: {
    playerName?: string;
    position?: string;
    summary?: string;
    messages?: unknown;
    interviewType?: string;
    scores?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ogiltig förfrågan" }, { status: 400 });
  }

  const { playerName, position, summary, messages, interviewType, scores } = body;
  if (typeof playerName !== "string" || typeof position !== "string" || typeof summary !== "string") {
    return NextResponse.json({ error: "Felaktiga parametrar" }, { status: 400 });
  }

  try {
    await saveIntervju(
      playerName.slice(0, 100),
      position.slice(0, 100),
      summary.slice(0, 3000),
      JSON.stringify(Array.isArray(messages) ? messages.slice(-40) : []),
      typeof interviewType === "string" ? interviewType : "spelarsamtal",
      scores && typeof scores === "object" ? JSON.stringify(scores) : "{}"
    );
    const coachName = (await getCoachName()) ?? "Tränare";
    await logActivity(coachName, "Genomförde intervju", playerName.slice(0, 100));
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("spara intervju error:", err);
    return NextResponse.json({ error: "Kunde inte spara" }, { status: 500 });
  }
}
