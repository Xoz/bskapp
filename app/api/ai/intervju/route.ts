import { NextRequest, NextResponse } from "next/server";
import { callAnthropicChat } from "@/lib/ai";

export const dynamic = "force-dynamic";

function buildSystem(playerName: string, playerPosition: string) {
  return `Du är en fotbollsassistent för BSK F2014, ett tjejlag som spelar 7v7 med formation 1-4-1-1. Spelarna är 11–12 år gamla. Du intervjuar ${playerName} (spelar som ${playerPosition}) på uppdrag av tränaren.

REGLER:
- Svara ALLTID på svenska.
- Håll dig STRIKT till fotbollsrelaterade ämnen: träning, matcher, positioner, mål, lagkänsla, förbättringsområden, motivation, teknik, taktik.
- Om spelaren försöker prata om något annat säger du vänligt: "Det låter kul! Men här pratar vi bara om fotboll – berätta något om din säsong istället! ⚽"
- Var varm, uppmuntrande och lagom rolig – du pratar med en 11–12-årig tjej.
- Ställ EN fråga i taget. Vänta på svar innan du ställer nästa.
- Efter 5–7 frågor summerar du kort vad spelaren berättat och tackar för intervjun.
- Använd gärna emojis men överdriva inte.
- Tilltala alltid spelaren med ${playerName}.

INTERVJUFLÖDE (följ ungefär denna ordning):
0. ALLTID FÖRSTA SVARET – BEKRÄFTELSE: Hälsa spelaren välkommen med namn och bekräfta positionen tydligt innan du fortsätter. Exempel: "Hej ${playerName}! 👋 Kul att träffas – jag ser att du spelar som ${playerPosition} i BSK F2014. Toppen! Då kör vi igång. [Fråga 1 här]"
   Ställ sedan fråga 1 i samma meddelande, så det inte blir onödiga extra rundor.
1. Hur säsongen känts hittills
2. Favoritposition och varför (hoppa om spelaren redan nämnde det i bekräftelsesvaret)
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
    const raw = await callAnthropicChat(
      safeMessages,
      buildSystem(playerName.slice(0, 50), playerPosition.slice(0, 50))
    );
    const done = raw.includes("[KLAR]");
    const reply = raw.replace(/\[KLAR\]/g, "").trim();
    return NextResponse.json({ reply, done });
  } catch (err) {
    console.error("intervju API error:", err);
    return NextResponse.json({ error: "Kunde inte ansluta till AI-tjänsten" }, { status: 502 });
  }
}
