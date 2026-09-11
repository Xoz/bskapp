# Hermes låneunderlag – granskning 2026-09-11

## Omfattning och slutsats

Användaren bad om granskning av Hermes svar om lån Gul → Grön den 12 september.
Aktuell produktionsdata och den driftsatta BSK-MCP-koden granskades läsande.
Inga behörigheter, kallelser, spelardata, agentinstruktioner eller tjänster ändrades.
Detta är en konkret ändringsplan, inte en implementerad rättning.
Hermes ursprungliga verktygslogg har inte granskats; den exakta anropskedjan är därför inte fastställd.

## Verifierade avvikelser

- Match 171: Grön–Sollentuna FK 4, 2026-09-12 10:15, Norrvikens IP 12.
- Match 7: Gul–AIK FF 2, samma dag 09:00, Råsunda IP 11.
- Match 149: Gul–Örby IS Blå från Medel, samma dag 16:30, Bollstanäs IP 21.
- Match 6 är inställd och ska inte användas som en extra match.
- De fyra föreslagna kandidaternas primära lag är F15. Ett ja till en Gulmatch gör dem inte till Gulspelare.
- Tre andra spelare har accepted till AIK men saknar selected där. De är därmed redan i den ja-svarande truppen, trots tom uttagningsmarkering.
- Grön + Örby är två matcher. Tre blir det endast om AIK också räknas med; då uppstår dessutom en tidsmarginalfråga.
- En Gulspelare utan lördagsmatch har två accepted i Grön på fredagen (match 162 kl. 18:45 och 184 kl. 20:00). Avsaknad av lördagskallelse betyder inte automatiskt att lån är lämpligt eller accepterat.
- Senaste verifierade synk vid granskningen: Gul/Grön 2026-09-11 08:23 svensk tid. Grön har en olöst personkoppling. Underlaget får inte beskrivas som fullständigt.

## Nuvarande åtkomst och kod

Privata integrationen är bunden till konto 1 och grupp 2 (Gul).
Produktionsvyn bsk_hermes.matches ger 7 och 149 för lördagen, inte Gröns 171.
Hitta_spelare ger de tolv aktiva Gulspelarna; rätt medlemsunderlag finns alltså redan.
Kallelsesvar ger gästers namn/id/svar/selected men ingen lagmarkering. Det ökar risken att gäster förväxlas med egna spelare.
Ingen av de åtta MCP-funktionerna ger batteriprognos eller spelarens matchåtaganden över laggränser.
Bredare privat utvecklingsåtkomst behövs inte för denna fråga.

Driftsatt release /opt/bsk/hermes-mcp-releases/20260910T205637Z.
server.py, views.sql och callups.sql är hashverifierade mot integrationsgrenen feat/hermes-bsk-mcp (f8fe1990), integrations/hermes-bsk/.
Huvudappens relevanta logik: lib/matchSpaceData.ts, lib/matchSpace.ts,
lib/matchSpaceMinutes.ts och lib/regularMatches.ts. Dagens tidskrockstest kontrollerar bara överlappande aktivitetsintervall, inte restid eller samling.

## Föreslagen ändring

1. Utöka kallelsesvar med tillhör_anslutna_laget och primärt lag för att skilja gäst från egen spelare. Giltiga medlemsdatum och aktiv status ska gälla på målmatchens datum. Spelar-id är identitet; kortnamn får aldrig användas för sammanslagning.
2. Lägg till ett skrivskyddat laneunderlag(mal_match_id, fran_lag_id). Avgränsa till anslutna Gulspelare och behörig målmatch. Ge läsning av Gröns nödvändiga matchuppgifter och kandidaternas åtaganden i alla lag. Behåll skyddade vyer eller ett autentiserat servicelager; ge inte generell SELECT på bastabeller eller andra spelares utvecklingsprofiler.
3. Flytta appens befintliga batteriläsning bakom ett transportoberoende behörighetsstyrt servicelager. Använd exakt samma simulering, procentnormalisering, speltidsfördelning, cupfilter och osäkerhetsmarkeringar. Undvik en andra Python-version av batterimodellen.
4. Returnera per kandidat: egna lagkopplingen, accepted/pending/selected/declined var för sig, andra matcher med stabilt id/tid/plats, batteri nu/före/efter/lägst efter tänkt lån, antagen speltid, konflikter, datatäckning och senaste lyckade synk. Hypotetisk målmatch räknas en gång. Antal matcher beräknas från unika id:n.
5. Utöka tidskontrollen med samling, pauser, restid och marginal. Saknad restid/samling ska anges som okänd eller som explicit konfigurerat antagande. En lucka mellan avsparkstider är inte bevis att en spelare hinner.
6. Hermes ska använda verktyget vid lån/kallelsemöjlighet och redovisa kategorierna upptagen, preliminär kandidat att fråga och otillräckligt underlag. Accepted blockerar ledighetsanspråk även utan selected. Pending/selected utan ja kräver kontroll. Saknad kallelse är inte bekräftad tillgänglighet. Ingen utvecklingsranking behövs.
7. Cuper utesluts ur ordinarie matchantal/batteri enligt beslut. En känd cup samma dag måste ändå markeras separat som kalenderåtagande så spelaren inte felaktigt kallas ledig. Ingen historisk cupimport behövs.

## Acceptansprov före aktivering

- F15-gäster får inte bli Gul-kandidater av att delta i en Gulmatch.
- Accepted utan selected ger upptagen, inte ledig.
- Fredagens två Grönmatcher påverkar lördagens batteriprognos.
- Ingen kallelse ger möjlig att fråga, inte bekräftat ledig.
- Inställd match undantas; två unika match-id:n blir aldrig tre.
- Samma målmatch räknas en gång vid befintligt ja-svar.
- Full individuell kapacitet 80 eller 125 visas som 100 procent.
- Bristande Grön-synk/olösta personkopplingar och okänd restid syns.
- Obefogad lag-/spelaråtkomst nekas och återkallad behörighet slår igenom direkt.
- Slutprov med vanlig Hermes-fråga och motstridig äldre assistenthistorik ska faktiskt anropa verktyget, utan utskick eller verksamhetsskrivning.
