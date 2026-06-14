// AI-genererad text. Två målgrupper:
//  - tränaren (styrkor/fokus i utvärderingen, se app/api/ai/suggest)
//  - spelaren själv (peppande sammanfattning på spelarkortet)

import { getPlayer, getEvaluations, getScores, getPlayerMatchStats } from "./queries";
import { CATEGORIES } from "./svff";
import { STAT_FIELDS } from "./stats";
import { positionLabel, positionFocus } from "./positions";

const LEVEL_LABEL: Record<number, string> = {
  1: "Nybörjare", 2: "På väg", 3: "Klarar det", 4: "Starka",
};

export async function callAnthropicChat(
  messages: { role: "user" | "assistant"; content: string }[],
  system: string,
  maxTokens = 800
): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY saknas");
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: maxTokens, system, messages }),
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return (data.content?.[0]?.text ?? "").trim();
}

export async function callAnthropic(prompt: string, maxTokens = 500): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY saknas");

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: maxTokens,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Anthropic ${res.status}: ${err}`);
  }
  const data = await res.json();
  return (data.content?.[0]?.text ?? "").trim();
}

// Peppande text riktad direkt till spelaren – visas på spelarkortet (48h-länken).
// Bygger på tränarens senaste utvärdering, med matchstatistik bara som bakgrund
// och med hänsyn till spelarens position. Returnerar null om underlag saknas.
export async function generatePlayerCardText(playerId: number): Promise<string | null> {
  const [player, evaluations] = await Promise.all([
    getPlayer(playerId),
    getEvaluations(playerId),
  ]);
  if (!player) return null;
  const latest = evaluations[0];
  if (!latest) return null; // utan utvärdering finns inget att skriva om

  const [scores, matchStats] = await Promise.all([
    getScores(latest.id),
    getPlayerMatchStats(playerId),
  ]);

  const firstName = player.name.replace(/^Exempel:\s*/, "").split(" ")[0];
  const skillLines = CATEGORIES.flatMap((cat) =>
    cat.skills
      .filter((s) => scores[s.id] != null)
      .map((s) => `- ${s.name} (${cat.name}): ${scores[s.id]}/4 – ${LEVEL_LABEL[scores[s.id]] ?? ""}`)
  ).join("\n");
  if (!skillLines) return null;

  // Matchstatistik – bara matcher med faktisk aktivitet
  const played = matchStats.filter((m) =>
    STAT_FIELDS.some((f) => ((m as unknown as Record<string, number>)[f.id] ?? 0) > 0)
  );
  let matchSection = "Ingen matchstatistik ännu.";
  if (played.length > 0) {
    const sum = (id: string) => played.reduce((s, m) => s + ((m as unknown as Record<string, number>)[id] ?? 0), 0);
    matchSection = `${played.length} matcher: ${sum("goals")} mål, ${sum("assists")} assist, ${sum("passes_completed")} lyckade passningar, ${sum("interceptions")} brytningar, ${sum("saves")} räddningar`;
  }

  const posLabel = positionLabel(player.position);
  const positionLine = posLabel ? `Position: ${posLabel} (relevant: ${positionFocus(player.position)})` : "Position: ej angiven";

  const prompt = `Du skriver en kort, peppande hälsning till en fotbollsspelare i BSK F2014, en flicka som är ungefär 12 år. Texten ska kännas personlig och uppmuntrande och vara skriven DIREKT TILL henne (tilltala med "du").

Spelare: ${firstName}
${positionLine}

Tränarens senaste utvärdering (SvFF-skala 1–4):
${skillLines}

Matchstatistik (bara som bakgrund):
${matchSection}

Regler:
- Skriv 3–4 meningar i ett enda stycke, varmt och positivt, som om tränaren pratar med henne.
- Börja med det hon är bra på enligt utvärderingen. Avsluta med 1–2 konkreta saker hon kan träna på, formulerat som en peppande utmaning ("nästa steg är...").
- Döm ALDRIG utifrån positionsberoende statistik – en back ska inte få höra att hon borde göra fler mål. Få mål betyder inte att något är dåligt.
- Använd inte siffror eller betyg i texten. Inga rubriker, inga punktlistor, ingen hälsningsfras som "Hej" eller signatur. Bara själva stycket.
- Håll det enkelt och glatt – hon ska bli glad och motiverad av att läsa det.`;

  try {
    const text = await callAnthropic(prompt, 400);
    return text || null;
  } catch (e) {
    console.error("generatePlayerCardText", e);
    return null;
  }
}
