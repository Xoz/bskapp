import { NextRequest, NextResponse } from "next/server";
import { callAnthropicChat } from "@/lib/ai";
import { getPlayers } from "@/lib/queries";
import { getPlayerSession, getRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

const SCALE = `1=Utforskar (håller på att lära mig), 2=Utvecklar (kan ibland), 3=Befäster (kan ganska ofta), 4=Behärskar (kan nästan alltid)`;

function buildIdentityBlock(playerName: string, playerPosition: string, rosterLines: string) {
  return `SPELARREGISTER (aktiva spelare i truppen):
${rosterLines}

STEG 0 – ALLTID FÖRST – IDENTITETSBEKRÄFTELSE:
Sök i registret efter ett namn som liknar "${playerName}".
• Hittas: hälsa välkommen med namn + bekräfta registrerad position. Gå sedan direkt till fråga 1.
• Hittas ej: tala om att du inte hittar namnet, be om fullständigt namn. Fortsätt INTE intervjun förrän identiteten är bekräftad.
(Spelaren angav position: ${playerPosition} – använd den registrerade positionen om den skiljer sig.)`;
}

function buildSpelarsamtalSystem(playerName: string, playerPosition: string, rosterLines: string) {
  return `Du är en fotbollsassistent för BSK F2014 (7v7, spelare 11–12 år) och intervjuar ${playerName} inför ett spelarsamtal.

${buildIdentityBlock(playerName, playerPosition, rosterLines)}

REGLER:
- Svara ALLTID på svenska. Var varm och uppmuntrande.
- Håll dig STRIKT till fotboll. Avvikelser: "Intressant! Men här pratar vi bara fotboll ⚽ – [upprepa frågan]."
- Ställ EN fråga i taget. Kvittera med MAX en mening. Gå direkt vidare.
- Max en follow-up om svaret är otydligt, sedan vidare.

FRÅGOR (ställ exakt i denna ordning):
F1. Hur har din säsong känd hittills – vad är du mest nöjd med?
F2. Vad tycker du att du är starkast på i fotbollen just nu?
F3. Vad vill du bli bättre på?
F4. Hur känns det i laget – trivs du och känner du dig trygg?
F5. Har du ett mål för den kommande perioden?
F6. Finns något du vill att tränaren ska veta?

AVSLUTNING: Summera kort (2–3 meningar) vad spelaren berättat + ett uppmuntrande ord.
Avsluta ditt sista meddelande med [KLAR] på en egen rad. Inkludera INTE [KLAR] annars.`;
}

function buildKvartalSystem(playerName: string, playerPosition: string, rosterLines: string) {
  return `Du är en fotbollsassistent för BSK F2014 (7v7, spelare 11–12 år) och genomför en kvartalsutvärdering med ${playerName}.
Syftet är att spelaren ska skatta sig själv på SvFF:s fem färdighetsområden (skala 1–4) – tränaren har gjort samma bedömning och resultaten jämförs efteråt.

${buildIdentityBlock(playerName, playerPosition, rosterLines)}

SKALA: ${SCALE}

REGLER:
- Svara ALLTID på svenska. Var varm och uppmuntrande.
- Håll dig STRIKT till dessa fem frågor. Inga sidospår.
- Ställ EN fråga i taget. Kvittera med MAX en mening ("Tack!", "Bra!", "Förstår!"). Gå direkt till nästa.
- Om spelaren inte anger en siffra: be kort om det ("Vilken siffra, 1–4?"). Max en gång.
- Max en follow-up om svaret är helt oklart. Gå sedan vidare oavsett.

FRÅGOR (ställ exakt i denna ordning, en i taget):
F1 [anfall_boll]: "Hur bra är du på att spela MED bollen – driva, finta, passa, ta emot och avsluta? Välj 1–4 och berätta kort varför."
F2 [anfall_utan_boll]: "Hur bra är du på att röra dig UTAN boll – erbjuda dig, hitta ytor och skapa lägen? Välj 1–4."
F3 [forsvar]: "Hur bra är du i FÖRSVARET – pressa, täcka ytor och ställa om snabbt? Välj 1–4."
F4 [fysik]: "Hur känns din rörlighet, snabbhet och koordination? Välj 1–4."
F5 [psykosocialt]: "Hur trivs du med fotbollen och i laget – träningsviljan, modet, glädjen och lagkänslan? Välj 1–4."

AVSLUTNING (när alla 5 svar är insamlade):
Skriv en kort (2–3 meningar) uppmuntrande summering.
Skriv sedan dessa två rader SIST – exakt så här:
[SCORES]{"anfall_boll":[siffra],"anfall_utan_boll":[siffra],"forsvar":[siffra],"fysik":[siffra],"psykosocialt":[siffra]}[/SCORES]
[KLAR]
(Ersätt [siffra] med spelarens faktiska svar. Inkludera INTE [SCORES] eller [KLAR] i andra svar.)`;
}

export async function POST(req: NextRequest) {
  // Skyddad: bara inloggad spelare (PIN) eller tränare får anropa AI:n.
  const [playerId, role] = await Promise.all([getPlayerSession(), getRole()]);
  if (!playerId && role !== "coach") {
    return NextResponse.json({ error: "Ej behörig" }, { status: 401 });
  }

  let body: { messages?: unknown; playerName?: string; playerPosition?: string; interviewType?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ogiltig förfrågan" }, { status: 400 });
  }

  const { messages, playerName, playerPosition, interviewType = "spelarsamtal" } = body;
  if (
    !Array.isArray(messages) ||
    typeof playerName !== "string" ||
    typeof playerPosition !== "string"
  ) {
    return NextResponse.json({ error: "Felaktiga parametrar" }, { status: 400 });
  }

  const safeMessages = (messages as unknown[])
    .filter(
      (m): m is { role: "user" | "assistant"; content: string } =>
        typeof m === "object" &&
        m !== null &&
        ((m as Record<string, unknown>).role === "user" ||
          (m as Record<string, unknown>).role === "assistant") &&
        typeof (m as Record<string, unknown>).content === "string"
    )
    .slice(-30);

  try {
    const players = await getPlayers();
    const rosterLines = players.length > 0
      ? players.map((p) => `- ${p.name}${p.position ? ` (${p.position})` : ""}`).join("\n")
      : "(Inga spelare registrerade ännu)";

    const system = interviewType === "kvartal"
      ? buildKvartalSystem(playerName.slice(0, 50), playerPosition.slice(0, 50), rosterLines)
      : buildSpelarsamtalSystem(playerName.slice(0, 50), playerPosition.slice(0, 50), rosterLines);

    const raw = await callAnthropicChat(safeMessages, system, 1000);

    const done = raw.includes("[KLAR]");

    // Extrahera strukturerade poäng från kvartalsutvärdering
    let scores: Record<string, number> | null = null;
    const scoresMatch = raw.match(/\[SCORES\]([\s\S]*?)\[\/SCORES\]/);
    if (scoresMatch) {
      try { scores = JSON.parse(scoresMatch[1].trim()); } catch { /* ignorera */ }
    }

    const reply = raw
      .replace(/\[SCORES\][\s\S]*?\[\/SCORES\]/g, "")
      .replace(/\[KLAR\]/g, "")
      .trim();

    return NextResponse.json({ reply, done, scores });
  } catch (err) {
    console.error("intervju API error:", err);
    return NextResponse.json({ error: "Kunde inte ansluta till AI-tjänsten" }, { status: 502 });
  }
}
