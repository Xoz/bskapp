import { NextRequest, NextResponse } from "next/server";
import { getRole } from "@/lib/auth";
import { getPlayer, getPlayerMatchStats } from "@/lib/queries";
import { CATEGORIES } from "@/lib/svff";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const role = await getRole();
  if (role !== "coach") return NextResponse.json({ error: "Ej behörig" }, { status: 401 });

  const { playerId, scores } = (await req.json()) as {
    playerId: number;
    scores: Record<string, number>;
  };

  const [player, matchStats] = await Promise.all([
    getPlayer(playerId),
    getPlayerMatchStats(playerId),
  ]);
  if (!player) return NextResponse.json({ error: "Spelare saknas" }, { status: 404 });

  const firstName = player.name.replace(/^Exempel:\s*/, "").split(" ")[0];

  // Bygg skill-text från de skickade värdena
  const levelLabel: Record<number, string> = { 1: "Nybörjare", 2: "På väg", 3: "Klarar det", 4: "Starka" };
  const skillLines = CATEGORIES.flatMap((cat) =>
    cat.skills
      .filter((s) => scores[s.id] != null)
      .map((s) => `- ${s.name} (${cat.name}): ${scores[s.id]}/4 – ${levelLabel[scores[s.id]] ?? ""}`)
  ).join("\n");

  // Matchstatistik
  let matchSection = "Ingen matchstatistik finns ännu.";
  if (matchStats.length > 0) {
    const totals = matchStats.reduce(
      (acc, m) => {
        acc.matcher++;
        acc.mål += m.goals ?? 0;
        acc.assist += m.assists ?? 0;
        acc.skott += m.shots ?? 0;
        acc.spm += m.shots_on_target ?? 0;
        acc.pass += m.passes_completed ?? 0;
        acc.brytn += m.interceptions ?? 0;
        acc.räddningar += m.saves ?? 0;
        return acc;
      },
      { matcher: 0, mål: 0, assist: 0, skott: 0, spm: 0, pass: 0, brytn: 0, räddningar: 0 }
    );
    matchSection = `${totals.matcher} matcher: ${totals.mål} mål, ${totals.assist} assist, ${totals.skott} skott (${totals.spm} på mål), ${totals.pass} lyckade passningar, ${totals.brytn} brytningar${totals.räddningar > 0 ? `, ${totals.räddningar} räddningar` : ""}`;
  }

  const prompt = `Du är assistent till en fotbollstränare för BSK F2014 (flickor ca 12 år) i Bollstanäs SK.

Spelare: ${player.name}

Matchstatistik säsongen:
${matchSection}

Utvärdering (SvFF-skala 1–4):
${skillLines}

Skriv korta, konkreta texter för:
1. Styrkor (2–3 meningar): Vad ${firstName} gör bra – koppla ihop utvärdering och matchstatistik
2. Fokusområden (2–3 meningar): Konkreta saker att jobba med framåt

Ton: positiv, direkt, riktat till tränaren. Inte till spelaren.
Svara exakt i detta format utan rubriker eller förklaringar:
STYRKOR: [text]
FOKUS: [text]`;

  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) return NextResponse.json({ error: "ANTHROPIC_API_KEY saknas" }, { status: 500 });

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 400,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error("Anthropic error", res.status, err);
    return NextResponse.json({ error: `AI-fel: ${err}` }, { status: 500 });
  }

  const data = await res.json();
  const text: string = data.content?.[0]?.text ?? "";

  const strengthsMatch = text.match(/STYRKOR:\s*([\s\S]*?)(?=FOKUS:|$)/);
  const focusMatch = text.match(/FOKUS:\s*([\s\S]*?)$/);

  return NextResponse.json({
    strengths: strengthsMatch?.[1]?.trim() ?? "",
    development_goals: focusMatch?.[1]?.trim() ?? "",
  });
}
