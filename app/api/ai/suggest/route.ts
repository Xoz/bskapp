import { NextRequest, NextResponse } from "next/server";
import { canAccessPlayer, hasPermission } from "@/lib/auth";
import { getPlayer, getPlayerMatchStats, getEvaluations, getScores, getPlayerFormTrend } from "@/lib/queries";
import { CATEGORIES } from "@/lib/svff";
import { positionLabel, positionFocus } from "@/lib/positions";
import { ratingBand, stepByKey } from "@/lib/rating";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const { playerId, scores } = (await req.json()) as {
    playerId: number;
    scores: Record<string, number>;
  };
  if (!(await hasPermission("manage_evaluations")) || !(await canAccessPlayer(playerId))) {
    return NextResponse.json({ error: "Ej behörig" }, { status: 401 });
  }

  const [player, matchStats, evaluations, formTrend] = await Promise.all([
    getPlayer(playerId),
    getPlayerMatchStats(playerId),
    getEvaluations(playerId),
    getPlayerFormTrend(playerId),
  ]);
  if (!player) return NextResponse.json({ error: "Spelare saknas" }, { status: 404 });

  const firstName = player.name.replace(/^Exempel:\s*/, "").split(" ")[0];
  const levelLabel: Record<number, string> = { 1: "Nybörjare", 2: "På väg", 3: "Klarar det", 4: "Starka" };

  // Bygg skill-text från de skickade värdena
  const skillLines = CATEGORIES.flatMap((cat) =>
    cat.skills
      .filter((s) => scores[s.id] != null)
      .map((s) => `- ${s.name} (${cat.name}): ${scores[s.id]}/4 – ${levelLabel[scores[s.id]] ?? ""}`)
  ).join("\n");

  // Trenddata – jämför med föregående utvärdering
  let trendSection = "";
  if (evaluations.length > 0) {
    const prevScores = await getScores(evaluations[0].id);
    const trends: string[] = [];
    for (const cat of CATEGORIES) {
      for (const skill of cat.skills) {
        const prev = prevScores[skill.id];
        const curr = scores[skill.id];
        if (prev != null && curr != null && curr !== prev) {
          const diff = curr - prev;
          trends.push(`${skill.name}: ${diff > 0 ? "+" : ""}${diff} (${prev} → ${curr})`);
        }
      }
    }
    if (trends.length > 0) {
      trendSection = `\nTrend sedan ${evaluations[0].date}:\n${trends.map((t) => `- ${t}`).join("\n")}`;
    }
  }

  // Matchstatistik – räkna bara matcher med faktisk aktivitet
  let matchSection = "Ingen matchstatistik finns ännu.";
  const playedMatches = matchStats.filter(
    (m) =>
      (m.goals ?? 0) + (m.assists ?? 0) + (m.shots ?? 0) +
      (m.passes_completed ?? 0) + (m.interceptions ?? 0) + (m.saves ?? 0) > 0
  );
  if (playedMatches.length > 0) {
    const totals = playedMatches.reduce(
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
    matchSection = `${totals.matcher} spelade matcher: ${totals.mål} mål, ${totals.assist} assist, ${totals.skott} skott (${totals.spm} på mål), ${totals.pass} lyckade passningar, ${totals.brytn} brytningar${totals.räddningar > 0 ? `, ${totals.räddningar} räddningar` : ""}`;
  }

  // Matchform (ELO, nivåjusterad) – stödjande signal om hur spelaren presterat
  // mot förväntan på sistone. Bandet säger vilken nivå formen motsvarar, och de
  // senaste betygen ger riktningen. Inte huvudgrund – färg på trenden.
  let formSection = "Ingen matchform finns ännu (inga betygsatta matcher).";
  if (formTrend.length > 0) {
    const band = ratingBand(formTrend[formTrend.length - 1].rating);
    const recent = formTrend.slice(-3);
    const dir =
      recent.length >= 2
        ? Math.sign(recent[recent.length - 1].rating - recent[0].rating)
        : 0;
    const dirWord = dir > 0 ? "stigande" : dir < 0 ? "sjunkande" : "stabil";
    const outcomeWords = recent
      .map((p) => stepByKey(p.outcome)?.label.toLowerCase())
      .filter(Boolean)
      .join(", ");
    const matchWord = formTrend.length === 1 ? "betygsatt match" : "betygsatta matcher";
    formSection = `Ligger i bandet ${band.label} efter ${formTrend.length} ${matchWord}, trenden är ${dirWord} (senaste betyg mot förväntan: ${outcomeWords}).`;
  }

  const posLabel = positionLabel(player.position);
  const posFocus = positionFocus(player.position);
  const positionLine = posLabel ? `Position: ${posLabel} (relevant statistik: ${posFocus})` : "Position: ej angiven";

  const prompt = `Du är assistent till en fotbollstränare för BSK F2014 (flickor ca 12 år) i Bollstanäs SK.

Spelare: ${player.name}
${positionLine}

PRIMÄR GRUND – tränarens utvärdering (SvFF-skala 1–4):
${skillLines}${trendSection}

Matchstatistik (ENDAST som bakgrund, inte huvudgrund):
${matchSection}

Matchform (stödjande signal – nivåjusterad form mot förväntan, inte huvudgrund):
${formSection}

Viktiga regler:
- Utgå FRÄMST från tränarens utvärdering och trenden ovan. Matchstatistiken och matchformen är bara stödjande färg, inte huvudunderlag.
- Använd matchformen för att färga tonen (t.ex. lyfta att spelaren är i stigande form), men hitta inte på färdigheter utifrån den.
- Dra ALDRIG slutsatser om svagheter från låga siffror i positionsberoende statistik. En back ska t.ex. inte bedömas på antal mål, och en målvakt inte på passningar framåt. Få mål betyder inte att spelaren är dålig på avslut.
- Nämn matchstatistik bara om den tydligt stödjer det utvärderingen redan visar.
- Hitta inte på siffror eller färdigheter som inte finns med ovan.

Skriv korta, konkreta texter:
1. Styrkor (2–3 meningar): Vad ${firstName} gör bra enligt utvärderingen, gärna med positiv trend.
2. Fokusområden (2–3 meningar): Konkreta saker att träna på utifrån utvärderingen – lyft områden som är låga eller sjunkit.

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
