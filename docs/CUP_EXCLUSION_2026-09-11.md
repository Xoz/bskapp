# Cuper undantagna från ordinarie beräkningar – 2026-09-11

Användarbeslut: cuper hanteras enskilt och ska inte ingå i ordinarie matchantal, matchkallelser, uttagningsstöd eller batteriberäkning. Cuphistorik och deltagande bevaras. Ersätter tidigare plan om gemensamt batteri även för cuper.

Gemensamt SQL-filter i lib/regularMatches.ts. Cup identifieras via match_type, cup_name, cupens matchgroup eller dess föräldrar samt verifierad Svenska Lag-metadata. JSON-tolkning ligger i CASE för endast rätt settings-nyckel; övriga inställningar kan innehålla vanlig text.

Källkontroll av befintliga seriematcher gav 16 Mini Tiger Cup-matcher som låg som seriespel. Dessutom fem närvaroimporter 28 juni utan lag-/käll-id: datum, motståndare och huvuddelen av tiderna motsvarar Stockholm Football Cups fem söndagsmatcher i Svenska Lags offentliga matchlista. Två närvaroimporter har 13.35 i stället för 13.40. Endast cupklassning märks; tider, motståndare, närvaro och match-id ändras inte.

Markerade poster (metadata i settings; inga nya matcher):

| Match-id | Datum | Cup |
|---|---|---|
| 189 | 2026-06-28 | Stockholm Football Cup |
| 190 | 2026-06-28 | Stockholm Football Cup |
| 191 | 2026-06-28 | Stockholm Football Cup |
| 192 | 2026-06-28 | Stockholm Football Cup |
| 193 | 2026-06-28 | Stockholm Football Cup |
| 195 | 2026-08-15 | Mini Tiger Cup BSK 2 |
| 196 | 2026-08-15 | Mini Tiger Cup BSK 1 |
| 197 | 2026-08-15 | Mini Tiger Cup BSK 2 |
| 198 | 2026-08-15 | Mini Tiger Cup BSK 1 |
| 199 | 2026-08-15 | Mini Tiger Cup BSK 2 |
| 200 | 2026-08-15 | Mini Tiger Cup BSK 1 |
| 201 | 2026-08-15 | Mini Tiger Cup BSK 1 |
| 202 | 2026-08-15 | Mini Tiger Cup BSK 2 |
| 203 | 2026-08-16 | Mini Tiger Cup BSK 1 |
| 204 | 2026-08-16 | Mini Tiger Cup BSK 2 |
| 205 | 2026-08-16 | Mini Tiger Cup BSK 2 |
| 206 | 2026-08-16 | Mini Tiger Cup BSK 1 |
| 207 | 2026-08-16 | Mini Tiger Cup BSK 1 |
| 208 | 2026-08-16 | Mini Tiger Cup BSK 2 |
| 209 | 2026-08-16 | Mini Tiger Cup BSK 1 |
| 210 | 2026-08-16 | Mini Tiger Cup BSK 2 |

Källor: https://www.svenskalag.se/bollstanassk-fotboll-f2014-gul/matcher?seasonYear=2026 (tävlingsgrupper 393365/393366/393367, 396538/396541). Mini Tiger-poster verifierades också via sina befintliga käll-id:n på respektive matchsida. Poster utan verifierbar tävling omklassades inte genom datumgissning.

Produktionskontroll: 41 cupmärkta matcher och 21 tidigare seriespel undantas. 78 övriga seriespel och 22 träningsmatcher passerar typfiltret (datum, närvaro och inställdstatus filtreras därutöver av respektive räknare). Adeles registrerade matcher 2026, alla lag, ej inställda t.o.m. 11 september: 44 före cupfiltret, 26 efter. Spelarlistans Gul-filter kan ge annat antal eftersom Grön/lösa lagposter ligger utanför lagurvalet.

Synkarbetaren i /opt/bsk/sync-releases/exclude-cups-20260911 kör commit 61f7bfcb via /opt/bsk/svenskalag-sync. Föregående match-types-20260911 och dess beroendekedja behålls. Nya kända cupträffar märks för filtret men importeras inte. Pågående tidigare synk får avslutas i sin ursprungliga release. Backup av settings före de 21 markeringarna: /opt/bsk/backups/cup-filter-settings-20260911.dump. Återgång av worker: återställ symlänken; ingen automatisk återställning av metadata.

189 tester med lokal PostgreSQL och typkontroll godkända. Efter JSON-korrigeringen även riktade statistik-/batteritester med vanlig text bland settings; skarpa SQL-frågor godkända. Webbens publicerings- och visuella slutkontroll dokumenteras i MAIN_RELEASE.md.
