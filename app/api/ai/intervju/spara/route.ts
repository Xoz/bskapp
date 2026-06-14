import { NextRequest, NextResponse } from "next/server";
import { saveIntervju } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let body: { playerName?: string; position?: string; summary?: string; messages?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ogiltig förfrågan" }, { status: 400 });
  }

  const { playerName, position, summary, messages } = body;
  if (typeof playerName !== "string" || typeof position !== "string" || typeof summary !== "string") {
    return NextResponse.json({ error: "Felaktiga parametrar" }, { status: 400 });
  }

  try {
    await saveIntervju(
      playerName.slice(0, 100),
      position.slice(0, 100),
      summary.slice(0, 3000),
      JSON.stringify(Array.isArray(messages) ? messages.slice(-40) : [])
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("spara intervju error:", err);
    return NextResponse.json({ error: "Kunde inte spara" }, { status: 500 });
  }
}
