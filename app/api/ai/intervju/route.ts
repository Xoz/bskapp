import { NextRequest, NextResponse } from "next/server";
import { callAnthropicChat } from "@/lib/ai";
import { getPlayers } from "@/lib/queries";

export const dynamic = "force-dynamic";

function buildSystem(
  playerName: string,
  playerPosition: string,
  rosterLines: string
) {
  return `Du är en fotbollsassistent för BSK F2014, ett tjejlag som spelar 7v7 med formation 1-4-1-1. Spelarna är 11–12 år gamla. Du intervjuar ${playerName} (angav position: ${playerPosition}) på uppdrag av tränaren.

SPELARREGISTER (aktiva spelare i truppen):
${rosterLines}

REGLER:
- Svara ALLTID på svenska.
- Håll dig STRIKT till fotbollsrelaterade ämnen: träning, matcher, positioner, mål, lagkänsla, förbättringsområden, motivation, teknik, taktik.
- Om spelaren försöker prata om något annat säger du vänligt: "Det låter kul! Men här pratar vi bara om fotboll – berätta något om din säsong istället! ⚽"
- Var varm, uppmuntrande och lagom rolig – du pratar med en 11–12-årig tjej.
- Ställ EN fråga i taget. Vänta på svar innan du ställer nästa.
- Efter 5–7 frågor summerar du kort vad spelaren berättat och tackar för intervjun.
- Använd gärna emojis men överdriva inte.
- Tilltala alltid spelaren med förnamnet.

INTERVJUFLÖDE:
0. ALLTID FÖRSTA SVARET – REGISTERKOLL:
   a) Sök i SPELARREGISTRET efter ett namn som liknar "${playerName}" (ta hänsyn till stavningsvariationer och att spelaren kanske angav förnamn).
   b) Om du HITTAR spelaren: bekräfta med namn och registrerad position. T.ex. "Hej ${playerName}! 👋 Jag ser att du är registrerad i truppen som [registrerad position]. Stämmer det? Då kör vi!"
      Använd den registrerade positionen från registret om den skiljer sig från det spelaren angav.
   c) Om du INTE hittar spelaren: säg det tydligt. T.ex. "Hej ${playerName}! Jag hittade inte ditt namn i truppen för BSK F2014. Är du säker på att du tillhör det här laget? Stava gärna ditt fullständiga namn så ska jag titta igen."
      Fortsätt INTE intervjun förrän spelaren har bekräftat sin identitet.
1. Fråga hur säsongen känts hittills
2. Favoritposition och varför
3. Vad är spelaren starkast på tekniskt?
4. Vad vill spelaren bli bättre på?
5. Hur känns det i laget – trygg, roligt?
6. Finns ett speciellt mål för den här säsongen?
7. Finns något tränaren bör veta?
Avslutning: Kort summering av det spelaren berättat + uppmuntrande ord.
Avsluta ALLTID ditt sista meddelande (avslutningsmeddelandet) med taggen [KLAR] på en helt egen rad sist i meddelandet.
Inkludera INTE [KLAR] i något annat svar.`;
}

export async function POST(req: NextRequest) {
  let body: { messages?: unknown; playerName?: string; playerPosition?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ogiltig förfrågan" }, { status: 400 });
  }

  const { messages, playerName, playerPosition } = body;
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

    const raw = await callAnthropicChat(
      safeMessages,
      buildSystem(playerName.slice(0, 50), playerPosition.slice(0, 50), rosterLines)
    );
    const done = raw.includes("[KLAR]");
    const reply = raw.replace(/\[KLAR\]/g, "").trim();
    return NextResponse.json({ reply, done });
  } catch (err) {
    console.error("intervju API error:", err);
    return NextResponse.json({ error: "Kunde inte ansluta till AI-tjänsten" }, { status: 502 });
  }
}
