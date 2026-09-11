# Uttagningsmotor – 11 september 2026

## Beslut och beteende

Gul är rättvisegruppen. Motorn fyller tomma platser i en vald match till nio
spelare. F15/Grön kan komplettera Gul; på Grönmatch föreslås enbart Gul-lån.
Befintliga manuella val och ja-svar bevaras. Ingen kallelse skickas av motorn.
Spara utkast respektive Skicka till Svenska Lag använder befintliga separata flöden.

- Fyra senaste genomförda ordinarie träningar vid lästillfället: 3–4 bekräftade
  deltaganden stärker prioriteten, två är neutralt, 0–1 sänker prioriteten bara
  när underlaget är komplett nog att styrka detta. Saknad registrering är
  okänd. Extraträning ger ingen närvaroprioritet men ingår fortsatt i batteriet.
- Rättvisehistorik: fyra veckor bakåt över spelarens lag, utan cuper/inställda
  matcher. Spelade, erbjudna, nej och obesvarade redovisas separat. Ett
  deltagande/ja/ej undantaget nej räknas som en matchmöjlighet, högst en gång
  per match. Obesvarat räknas inte som nej eller förbrukad matchmöjlighet.
  Kommande åtaganden redovisas separat; målmatchen dubbleras inte.
- Giltig träningsfrånvaro och erbjudna matcher kan undantas på spelarprofilen.
  Känd otillgänglighet anges som ett datumintervall. Det stoppar nya förslag
  under perioden och neutraliserar frånvaro/nej då. Ett historiskt nej med
  krockande registrerat deltagande eller ja till annan match undantas också.
  Faktisk närvaro och kallelsesvar ändras aldrig av ett undantag.
- Högst två matcher per dag. Dubbelmatch kräver tränarvald nivåparning, till
  exempel Medel + Svår. Tom inställning kräver tränarbedömning; normalnivå
  och utmaningsnivå tolkas inte som automatiskt dubbelmatchtillstånd.
- Automatisk dubbelmatch kräver minst 60 % lägsta batterimarginal i den
  gemensamma prognosen från första matchen och framåt. 40–59 % kräver aktivt
  tränarval. Gränsen jämförs utan avrundning. Nya dubbelmatcher under 40 %
  och nya tredje matcher nekas även vid sparande. Redan gjorda val återkallas
  inte vid nya underlagsvarningar.
- Tidsantagande för nya dubbelmatcher: minst 15 minuter efter matchens
  speltid på samma plats, 60 minuter på olika platser. Detta omfattar
  antagna pauser/övergång respektive samling/resa; det är inte uppmätt restid.
  Saknad tid/plats eller otillräcklig marginal kräver tränarbedömning.
- Prioritering bland möjliga Gulspelare: belastningskategori, närvarokategori,
  erbjudna/använda matchmöjligheter plus kommande åtaganden, nivåpassning,
  faktiskt deltagande, sist namn för determinism. En tillgänglig Gulmålvakt
  ges en plats före övriga. Saknad målvakt och tomma platser flaggas.

## Arbetsflöde

Spelarprofil → **Uttagningsregler · två matcher och frånvaro**: välj tillåtna
parningar, datumintervall eller undantag och spara. Versionskontroll hindrar
att en äldre öppen vy skriver över ett nyare beslut.

Match → **Laguttagning** → **Föreslå spelare för tomma platser**. Varje rad
visar närvaro och matchhistorik; fördjupningen visar skäl, blockerande regler
och källvarningar. Förslaget går att ångra. Ett manuellt varnat val kräver en
markerad tränarbedömning. Sparandet läser om verkliga underlag och använder
standardspeltid; en osparad speltidssimulering får inte kringgå spargränserna.

Speltiden i målmatchen följer antalet valda spelare, med reserverad målvaktsplats.
Ett ofullständigt automatförslag kontrolleras på nytt med längre speltid och
nya olämpliga kandidater tas bort. Befintliga svar ligger kvar. Träningens
60-minutersantagande och övriga batterikonstanter är oförändrade.

## Lagring, åtkomst och begränsningar

`settings.selection_policy:<playerId>` lagrar parningar, undantag, datum och
senaste ändring. Ingen migration. Läsning/skrivning kräver manage_squads,
spelaråtkomst och vid målmatch även lagåtkomst. Policy följer spelarutdrag och
permanent radering. Appen sparar inga medicinska orsaker eller nya totalbetyg.

Detta är ett matchbundet förslagsflöde. Andra sparade uttagningar/kallelser
räknas med över laggränser, men osparade ändringar i en annan flik ingår inte.
Ingen global optimering av två veckor eller automatisk omflyttning mellan
matcher görs. Ingen särskild snapshot av beslutshistorik införs i detta steg;
underlag uppdateras vid omladdning. Ingen modell för att säkert avgöra när en
känd otillgänglighet först uppstod finns – tränaren kan undanta matchen.

Svenska Lags frånvarorader är ofullständiga på vissa aktiviteter. Kallelsesvar
används därför aldrig för att hitta på faktisk träningsfrånvaro. En importerad
matchnivå kan kompletteras från verifierad serieinformation när level saknas.

Återgång: återställ kodreleasen. Inställningsnycklar kan ligga kvar utan att
äldre kod använder dem. Befintliga matcher, svar och deltaganden bevaras.

## Verifiering

Regeltester: närvarogränser, okänt/undantag, upprepade nej, krockande erbjudande,
framtida åtaganden, nivåpar, 40/60-procentsgräns, individuell kapacitet, tredje
match, tidsmarginaler och förändrat spelarantal. Databastester: verklig SQL,
cup/inställt/lagavgränsning, serieinformation, närvaro, versionskonflikt och
negativa behörigheter. Sparprov: aktivt tränarval och bevarade tidigare val.

Lokalt webbläsarprov med enbart syntetiska spelare verifierar sparade parningar
över omladdning, förslag med redovisade luckor, stopp utan tränarbekräftelse och
sparat utkast efter bekräftelse. Dator och 390 px mobil kontrollerade; ingen
horisontell sidöverströmning eller JavaScript-fel.

Slutlig lokal kontroll: 236 tester godkända, fyra befintliga villkorade tester
överhoppade. Typkontroll och produktionsbygge godkända. Skrivskyddad körning
av nya läsmodellen mot produktion verifierade tolv Gulspelare, de fyra
ordinarie passen och matchnivå från serieinformation.

## Batterikalibrering 2026-09-11

Efter Österåker-provet fastställde användaren att ordinarie träningar och två matcher ska fungera utan batterivarning. Den gemensamma batterimodellen har omkalibrerats enligt docs/MATCH_SPACE.md (0,1 per matchminut, 0,05 per träningsminut). Detta ersätter tidigare simuleringars batteriprocent. Samma beräkning används vid förslag, visning och sparande. Godkända individuella nivåpar, tidskontroll och tvåmatchergräns kvarstår; ändringen tillåter inte automatiskt varje nivåkombination.
