// Spelarutvecklingsträd 7v7 → 9v9: kategorier, färdigheter (statisk data) och
// statuslogik (upplåsning, prioritering). Status per spelare/färdighet lagras i
// player_skill_status (se lib/db.ts) och nås via getPlayerSkillStatuses/setSkillStatus.

export type CategoryId =
  | "bollkontroll"
  | "driva"
  | "vandning"
  | "passning"
  | "mottagning"
  | "skott"
  | "1v1_off"
  | "1v1_def"
  | "spelforstaelse"
  | "positionsspel"
  | "kommunikation"
  | "matchbeteende";

export interface Category {
  id: CategoryId;
  name: string;
  short: string;
  icon: string;
  color: string;
}

export const CATEGORIES: Category[] = [
  { id: "bollkontroll", name: "Bollkontroll", short: "Kontroll", icon: "⚽", color: "#1fba8a" },
  { id: "driva", name: "Driva bollen", short: "Driva", icon: "🏃", color: "#4d8ef0" },
  { id: "vandning", name: "Vända och byta riktning", short: "Vändning", icon: "🔄", color: "#a78bfa" },
  { id: "passning", name: "Passning", short: "Passning", icon: "🎯", color: "#f59e0b" },
  { id: "mottagning", name: "Mottagning / första touch", short: "Mottagning", icon: "🤲", color: "#22d3ee" },
  { id: "skott", name: "Skott och avslut", short: "Avslut", icon: "🥅", color: "#f87171" },
  { id: "1v1_off", name: "1 mot 1 offensivt", short: "1v1 off", icon: "💥", color: "#f472b6" },
  { id: "1v1_def", name: "1 mot 1 defensivt", short: "1v1 def", icon: "🛡️", color: "#818cf8" },
  { id: "spelforstaelse", name: "Spelförståelse", short: "Spelförståelse", icon: "🧠", color: "#a3e635" },
  { id: "positionsspel", name: "Positionsspel 7v7/9v9", short: "Position", icon: "📍", color: "#fb923c" },
  { id: "kommunikation", name: "Kommunikation", short: "Kommunikation", icon: "🗣️", color: "#86efac" },
  { id: "matchbeteende", name: "Matchbeteende", short: "Matchbeteende", icon: "🔥", color: "#facc15" },
];

export function category(id: CategoryId): Category {
  return CATEGORIES.find((c) => c.id === id)!;
}

export const LEVEL_INFO: Record<1 | 2 | 3 | 4 | 5, { label: string; description: string }> = {
  1: { label: "Grund", description: "Klarar momentet långsamt och utan press." },
  2: { label: "Kontroll", description: "Klarar momentet med bättre kvalitet, rätt teknik och viss fart." },
  3: { label: "Matchtempo", description: "Klarar momentet i fart och i en realistisk matchlik situation." },
  4: { label: "Under press", description: "Klarar momentet med motståndare nära, tidspress eller fysisk press." },
  5: { label: "Beslut", description: "Klarar momentet och fattar rätt beslut beroende på situationen." },
};

export interface Skill {
  id: string;
  category: CategoryId;
  level: 1 | 2 | 3 | 4 | 5;
  order: number;
  title: string;
  question: string;
  criterion: string;
  advice: string;
  nextStep: string;
  requires?: string;
}

interface SkillSpec {
  level: 1 | 2 | 3 | 4 | 5;
  title: string;
  question: string;
  criterion: string;
  advice: string;
}

function buildCategory(catId: CategoryId, masteryMessage: string, specs: SkillSpec[]): Skill[] {
  return specs.map((s, i) => {
    const next = specs[i + 1];
    return {
      id: `${catId}-${i + 1}`,
      category: catId,
      order: i + 1,
      requires: i === 0 ? undefined : `${catId}-${i}`,
      nextStep: next ? `Nästa steg: ${next.title.toLowerCase()}.` : masteryMessage,
      ...s,
    };
  });
}

const SKILL_SPECS: Record<CategoryId, { mastery: string; specs: SkillSpec[] }> = {
  bollkontroll: {
    mastery: "Bollkontrollen är på plats – hjälp gärna en lagkamrat att träna på samma sak.",
    specs: [
      { level: 1, title: "Stanna bollen med sulan", question: "Kan du stanna bollen med sulan?", criterion: "Stannar en rullande boll på under en sekund utan att den studsar iväg.", advice: "Träna att ta emot rullande bollar med sulan, en fot i taget, från kort håll." },
      { level: 1, title: "Föra bollen 5 meter", question: "Kan du föra bollen 5 meter utan att tappa kontrollen?", criterion: "Bollen håller sig inom en armlängd hela sträckan.", advice: "Gå långsamt och känn bollen med insidan av foten – fokus på att den aldrig lämnar fötterna." },
      { level: 2, title: "Driva med små touch", question: "Kan du driva bollen 10 meter med många små touch?", criterion: "Minst 8–10 touch på sträckan, bollen nära foten hela vägen.", advice: "Öva touch-touch-touch i gångfart innan du ökar farten." },
      { level: 2, title: "Insida och utsida", question: "Kan du använda både insida och utsida av foten?", criterion: "Växlar mellan insida och utsida utan att tappa bollen.", advice: "Träna slalom mellan koner och växla insida–utsida varannan touch." },
      { level: 3, title: "Driva i fart", question: "Kan du driva bollen 15 meter i fart?", criterion: "Håller farten och kontrollen hela sträckan utan att bollen kommer bort.", advice: "Öka farten stegvis – längre touch när ytan är fri, kortare touch nära motstånd." },
      { level: 4, title: "Behålla bollen under press", question: "Kan du behålla bollen när någon jagar dig?", criterion: "Skyddar bollen med kroppen och tappar den inte under press.", advice: "Träna 1 mot 1 i en liten ruta med fokus på att skärma bollen med kroppen." },
      { level: 5, title: "Driva eller passa", question: "Kan du välja när du ska driva och när du ska passa?", criterion: "Gör rätt val i en matchlik situation minst 8 av 10 gånger.", advice: "Spela matchlika övningar och prata igenom valen med tränaren efteråt." },
    ],
  },
  driva: {
    mastery: "Bra drivningar! Utmana dig själv i matchlika övningar mot en försvarare.",
    specs: [
      { level: 1, title: "Driva rakt fram", question: "Kan du driva 10 meter rakt fram?", criterion: "Bollen håller sig framför dig hela sträckan.", advice: "Öva korta touch rakt fram i lugnt tempo, ingen press." },
      { level: 1, title: "Driva och titta upp", question: "Kan du driva bollen och lyfta blicken utan att tappa den?", criterion: "Ser upp minst en gång under drivningen utan att bollen kommer bort.", advice: "Träna att titta upp mellan varje touch – börja väldigt långsamt." },
      { level: 2, title: "Stanna kontrollerat", question: "Kan du driva 10 meter och stanna kontrollerat?", criterion: "Stannar bollen inom en meter på valfri signal.", advice: "Öva att bromsa in bollen med sulan på ett givet tecken." },
      { level: 2, title: "Driva med båda fötterna", question: "Kan du driva med både höger och vänster fot?", criterion: "Klarar hela sträckan med endera foten på begäran.", advice: "Kör samma övning två gånger – en gång per fot – varje träning." },
      { level: 3, title: "Driva i högre fart", question: "Kan du driva i fart utan att bollen kommer för långt bort?", criterion: "Bollen inom två meter hela sträckan även i joggfart/löpfart.", advice: "Öka farten stegvis och korta touchen så fort bollen börjar glida ifrån." },
      { level: 4, title: "Driva förbi en försvarare", question: "Kan du driva förbi en passiv försvarare?", criterion: "Tar sig förbi utan att tappa bollen minst 3 av 5 gånger.", advice: "Öva en enkel finish (fint) mot en passiv kompis innan ni ökar tempot." },
      { level: 5, title: "Driva eller passa i rätt läge", question: "Kan du driva framåt när ytan finns och passa när ytan stängs?", criterion: "Läser ytan rätt och väljer driva/passa korrekt i matchlik övning.", advice: "Spela smålagsspel och fråga dig själv 'finns ytan?' varje gång du får bollen." },
    ],
  },
  vandning: {
    mastery: "Vändningarna sitter! Nästa steg är att göra dem ännu snabbare i match.",
    specs: [
      { level: 1, title: "Vända med sulan", question: "Kan du vända med sulan?", criterion: "Drar bollen bakåt med sulan och byter riktning utan att tappa den.", advice: "Öva sulvändningar i stillastående, sedan i gångfart." },
      { level: 1, title: "Vända med insidan", question: "Kan du vända med insidan?", criterion: "Vänder bollen med insidan av foten och behåller kontrollen.", advice: "Träna insidevändning mot en kon – långsamt, sedan snabbare." },
      { level: 2, title: "Vända med utsidan", question: "Kan du vända med utsidan av foten?", criterion: "Vänder bollen med utsidan och fortsätter i ny riktning kontrollerat.", advice: "Öva utsidevändning i en slalombana med koner." },
      { level: 2, title: "180 graders vändning", question: "Kan du vända 180 grader utan att tappa bollen?", criterion: "Byter riktning helt utan att bollen kommer mer än en meter bort.", advice: "Träna vändningen i lugnt tempo tills den sitter, öka sedan farten." },
      { level: 3, title: "Vända i fart", question: "Kan du vända i fart?", criterion: "Klarar vändningen i joggfart utan att tappa kontrollen.", advice: "Öka farten in i vändningen stegvis under träning." },
      { level: 4, title: "Vända bort från press", question: "Kan du vända bort från press?", criterion: "Vänder bort från en jagande motståndare och behåller bollen.", advice: "Öva vändning med en kompis som jagar lugnt bakifrån." },
      { level: 5, title: "Välja rätt vändning", question: "Kan du känna när du ska vända hemåt, framåt eller spela vidare?", criterion: "Gör rätt val i matchlik situation minst 8 av 10 gånger.", advice: "Spela matchlika övningar och prata igenom valen med tränaren efteråt." },
    ],
  },
  passning: {
    mastery: "Passningsspelet är på plats – utmana dig med svagare fot och längre distanser.",
    specs: [
      { level: 1, title: "Passa bredsida 5 meter", question: "Kan du passa bredsida 5 meter?", criterion: "Bollen når lagkamraten rakt och kontrollerat 8 av 10 gånger.", advice: "Träna bredsidespassningar mot en vägg eller en kompis från kort håll." },
      { level: 2, title: "Hårt och rakt 5 meter", question: "Kan du passa bredsida hårt och rakt 5 meter?", criterion: "Passningen är rak och har tillräcklig fart för att inte lätt avvärjas.", advice: "Öva att lägga an foten stadigt och träffa bollens mitt." },
      { level: 2, title: "Hårt och rakt 10 meter", question: "Kan du passa hårt och rakt 10 meter?", criterion: "Bollen når fram rakt och med bra fart på 10 meter.", advice: "Öka avståndet gradvis från 5 till 10 meter mot vägg eller kompis." },
      { level: 3, title: "Precision 15 meter", question: "Kan du passa 15 meter med precision?", criterion: "Träffar en markerad yta (t.ex. koner) minst 6 av 10 gånger.", advice: "Träna mot ett mål av koner och räkna träffar." },
      { level: 3, title: "Svagare fot", question: "Kan du passa med svagare fot 5–10 meter?", criterion: "Bollen når fram kontrollerat med den svagare foten.", advice: "Lägg in 5 minuter varje träning där du bara passar med svagare foten." },
      { level: 4, title: "Passa under press", question: "Kan du passa rätt under press?", criterion: "Väljer och genomför rätt passning trots en jagande motståndare.", advice: "Öva passningsövningar med en passiv, sedan aktiv, försvarare i närheten." },
      { level: 5, title: "Välja rätt passning", question: "Kan du välja rätt passning: framåt, bakåt, snett eller ut på kant?", criterion: "Gör rätt val i matchlik situation minst 8 av 10 gånger.", advice: "Spela positionsspel och prata igenom valen med tränaren efteråt." },
    ],
  },
  mottagning: {
    mastery: "Första touchen sitter – nästa steg är att göra det automatiskt i matchtempo.",
    specs: [
      { level: 1, title: "Stoppa en lös passning", question: "Kan du stoppa en lös passning?", criterion: "Bollen stannar inom en armlängd vid mottagning.", advice: "Öva mottagning av lugna passningar från kort håll, en fot i taget." },
      { level: 1, title: "Ta emot en luftboll med foten", question: "Kan du ta emot en boll som kommer i luften med foten?", criterion: "Dämpar bollen med foten så den landar nära dig.", advice: "Öva att 'ge efter' med foten när bollen träffar den – som en kudde." },
      { level: 2, title: "Ta emot en hård passning", question: "Kan du ta emot en hård passning utan att bollen studsar iväg?", criterion: "Bollen studsar inte mer än en meter bort vid mottagning.", advice: "Träna att dämpa hårda passningar genom att dra tillbaka foten vid kontakt." },
      { level: 3, title: "Touch i rätt riktning", question: "Kan din första touch gå i den riktning du vill spela?", criterion: "Första touchen styr bollen mot mål eller mot en öppen yta.", advice: "Bestäm riktning innan bollen kommer och styr första touchen dit." },
      { level: 3, title: "Vända i mottagningen", question: "Kan du ta emot bollen och vända i samma rörelse?", criterion: "Tar emot och vänder i en och samma rörelse utan extra touch.", advice: "Öva mottagning med vändning mot en kon som markerar ny riktning." },
      { level: 4, title: "Ta emot med spelare i ryggen", question: "Kan du ta emot med spelare i ryggen?", criterion: "Skärmar bollen och behåller kontrollen med en motståndare nära.", advice: "Träna mottagning med en kompis som står tätt bakom dig." },
      { level: 5, title: "Titta upp före mottagning", question: "Kan du titta upp före mottagning och veta vad du ska göra innan bollen kommer?", criterion: "Ser sig om innan bollen kommer och agerar snabbt och rätt efteråt.", advice: "Öva att skanna (titta över axeln) innan varje passning du väntar på." },
    ],
  },
  skott: {
    mastery: "Avslutet sitter – jobba nu på att göra rätt val i avslutsläget varje gång.",
    specs: [
      { level: 1, title: "Skjuta stillaliggande boll", question: "Kan du skjuta på stillaliggande boll?", criterion: "Träffar mål från kort håll minst 6 av 10 gånger.", advice: "Öva att lägga an stödfoten bredvid bollen och träffa med god kontakt." },
      { level: 2, title: "Skjuta med vrist", question: "Kan du skjuta med vrist mot mål?", criterion: "Skottet har tydlig fart med låst vrist vid kontakt.", advice: "Träna vristskott mot en vägg för att känna rätt kontaktpunkt." },
      { level: 2, title: "Skjuta med insidan", question: "Kan du skjuta med insidan mot mål på kort håll?", criterion: "Träffar mål med insidan från kort håll med god precision.", advice: "Öva insideskott mot ett mindre mål eller markerad yta." },
      { level: 3, title: "Skjuta efter drivning", question: "Kan du skjuta efter drivning?", criterion: "Går från drivning till avslut i ett flyt utan extra touch.", advice: "Öva driva-och-skjut från olika vinklar mot mål." },
      { level: 3, title: "Placera i hörn", question: "Kan du placera bollen i hörn?", criterion: "Placerar skottet i valfritt hörn minst 4 av 10 gånger.", advice: "Sikta på koner i hörnen av målet i skottträningen." },
      { level: 4, title: "Avsluta under press", question: "Kan du avsluta med försvarare nära?", criterion: "Genomför avslutet utan att tappa fokus trots en nära motståndare.", advice: "Öva avslut med en passiv försvarare som gradvis blir mer aktiv." },
      { level: 5, title: "Välja rätt avslut", question: "Kan du välja mellan skott, passning eller dribbling i avslutsläge?", criterion: "Gör rätt val i matchlik situation minst 8 av 10 gånger.", advice: "Spela avslutsövningar i litet spel och prata igenom valen efteråt." },
    ],
  },
  "1v1_off": {
    mastery: "1 mot 1-spelet sitter – testa gärna mot en snabbare eller större motståndare.",
    specs: [
      { level: 1, title: "Våga utmana", question: "Vågar du utmana?", criterion: "Försöker driva förbi en motståndare i stället för att passa bort direkt.", advice: "Öva 1 mot 1 i en liten ruta där enda målet är att försöka utmana." },
      { level: 1, title: "Våga dribbla trots risk", question: "Vågar du dribbla även om du kan tappa bollen?", criterion: "Provar en dribbling i match även när utfallet är osäkert.", advice: "Beröm försöket, inte bara resultatet, så vågan växer." },
      { level: 2, title: "Enkel riktningsförändring", question: "Kan du göra en enkel riktningsförändring?", criterion: "Byter riktning tydligt för att lura motståndaren minst en gång.", advice: "Öva en enkel finish (fint) mot en kon innan ni kör mot en person." },
      { level: 3, title: "Komma förbi och accelerera", question: "Kan du komma förbi och accelerera?", criterion: "Ökar farten direkt efter att ha tagit sig förbi motståndaren.", advice: "Träna explosivitet i första steget efter en lyckad dribbling." },
      { level: 3, title: "Använda en finish", question: "Kan du använda en finish (fint) för att komma förbi?", criterion: "Genomför en inövad finish som faktiskt tar sig förbi motståndaren.", advice: "Välj en finish och öva den tills den sitter i både lugnt och snabbt tempo." },
      { level: 4, title: "Skydda bollen nära motstånd", question: "Kan du skydda bollen när försvararen kommer nära?", criterion: "Håller kvar bollen med kroppen som skydd mot en nära motståndare.", advice: "Öva att vända kroppen mellan bollen och motståndaren." },
      { level: 5, title: "Utmana eller spela bollen", question: "Kan du avgöra när du ska utmana och när du ska spela bollen?", criterion: "Gör rätt val i matchlik situation minst 8 av 10 gånger.", advice: "Spela smålagsspel och prata igenom valen med tränaren efteråt." },
    ],
  },
  "1v1_def": {
    mastery: "Försvarsspelet sitter – nästa steg är att läsa anfallarens nästa val i förväg.",
    specs: [
      { level: 1, title: "Stå mellan motståndare och mål", question: "Kan du stå mellan motståndare och mål?", criterion: "Positionerar sig konsekvent mellan bollen/motståndaren och eget mål.", advice: "Öva att alltid kolla var det egna målet är innan du ställer dig." },
      { level: 1, title: "Rätt avstånd", question: "Kan du hålla rätt avstånd utan att rusa in?", criterion: "Håller en armlängds avstånd i stället för att storma rakt på bollen.", advice: "Träna att bromsa in sista metrarna innan du möter anfallaren." },
      { level: 2, title: "Bromsa anfallaren", question: "Kan du bromsa en anfallare utan att rusa?", criterion: "Saktar ner anfallarens fart utan att själv tappa balansen.", advice: "Öva sidledsförflyttning så du kan bromsa utan att falla i en tackling." },
      { level: 3, title: "Styra motståndaren", question: "Kan du styra motståndaren åt ett håll?", criterion: "Tvingar anfallaren mot sidlinjen eller en svagare fot minst hälften av gångerna.", advice: "Öva att vinkla kroppen så du styr anfallaren dit du vill." },
      { level: 3, title: "Vinna bollen direkt", question: "Kan du vinna tillbaka bollen direkt efter bolltapp (retrening)?", criterion: "Reagerar direkt och pressar tillbaka inom några sekunder efter bolltapp.", advice: "Öva ett snabbt återtryck varje gång du förlorar bollen i träning." },
      { level: 4, title: "Vinna bollen utan tackling", question: "Kan du vinna bollen utan att kasta dig?", criterion: "Erövrar bollen stående, tajmat, utan onödiga risktacklingar.", advice: "Träna tajming genom att sätta press precis när mottagaren tar sin touch." },
      { level: 5, title: "Pressa, backa eller täcka", question: "Kan du välja mellan att pressa, backa eller täcka passning?", criterion: "Gör rätt val i matchlik situation minst 8 av 10 gånger.", advice: "Spela försvarsövningar i smålagsspel och prata igenom valen efteråt." },
    ],
  },
  spelforstaelse: {
    mastery: "Spelförståelsen sitter – nästa steg är att hjälpa lagkamrater att se samma saker.",
    specs: [
      { level: 1, title: "Veta var målen är", question: "Vet du var ditt mål och motståndarens mål är?", criterion: "Pekar snabbt ut rätt mål oavsett var på planen hen står.", advice: "Öva att peka ut mål och riktning i pausen varje träning." },
      { level: 1, title: "Förstå löpningarna", question: "Förstår du vart du ska springa när laget har bollen?", criterion: "Rör sig mot en yta i stället för att stå still när laget har bollen.", advice: "Öva enkla positionsspel där alla måste röra sig när bollen rör sig." },
      { level: 2, title: "Göra sig spelbar", question: "Kan du göra dig spelbar?", criterion: "Söker en öppen yta och signalerar för passning.", advice: "Träna att alltid röra sig till en öppen yta när lagkamraten har bollen." },
      { level: 3, title: "Titta upp innan mottagning", question: "Kan du titta upp innan du får bollen?", criterion: "Scannar planen innan bollen når fram, minst en gång.", advice: "Öva att titta över axeln innan varje passning du väntar på." },
      { level: 3, title: "Läsa tempot", question: "Kan du se när du ska spela snabbt och när du ska bromsa tempot?", criterion: "Väljer rätt tempo (snabbt/lugnt) utifrån situationen minst hälften av gångerna.", advice: "Prata igenom matchklipp eller övningar där tempoval var avgörande." },
      { level: 4, title: "Skapa yta åt lagkamrat", question: "Kan du skapa yta för en lagkamrat?", criterion: "Drar med sig en motståndare för att öppna yta åt någon annan.", advice: "Öva löpningar utan boll som drar undan en försvarare." },
      { level: 5, title: "Rätt beslut före touchen", question: "Kan du fatta rätt beslut innan första touchen?", criterion: "Vet redan innan bollen kommer vad nästa handling ska bli.", advice: "Öva att bestämma nästa handling redan när bollen är på väg." },
    ],
  },
  positionsspel: {
    mastery: "Positionsspelet sitter – bra grund inför övergången till större plan och 9v9.",
    specs: [
      { level: 1, title: "Förstå sin position", question: "Förstår du din position?", criterion: "Kan förklara med egna ord vad rollen på planen innebär.", advice: "Gå igenom position och grundyta tillsammans med tränaren." },
      { level: 1, title: "Kända lagkamrater", question: "Vet du vilka lagkamrater som är dina närmaste i din position?", criterion: "Pekar ut rätt lagkamrater att samspela med i sin del av planen.", advice: "Öva positionsspel i mindre grupper så rollerna blir tydliga." },
      { level: 2, title: "Hålla sin yta", question: "Kan du hålla din kant/yta?", criterion: "Stannar inom sin del av planen i stället för att klumpa ihop sig med bollen.", advice: "Öva positionsspel med tydliga zoner markerade med koner." },
      { level: 3, title: "Flytta med laget", question: "Kan du flytta med laget när bollen flyttas?", criterion: "Justerar sin position i takt med att laget skiftar sida.", advice: "Träna sidoförflyttning som grupp när bollen byter sida i smålagsspel." },
      { level: 3, title: "Täcka upp för lagkamrat", question: "Kan du täcka upp för en lagkamrat som gått fram?", criterion: "Fyller upp ytan när en lagkamrat lämnar sin position.", advice: "Öva rotationsövningar där en spelare byter position och en annan täcker." },
      { level: 4, title: "Förstå avstånd", question: "Kan du förstå avstånd till lagkamrater?", criterion: "Håller lagom avstånd – varken för nära eller för långt bort.", advice: "Träna att mäta avstånd med ögonmått under positionsspel." },
      { level: 5, title: "Balansera laget", question: "Kan du balansera laget genom att veta när du ska gå fram och när du ska stanna?", criterion: "Gör rätt val i matchlik situation minst 8 av 10 gånger.", advice: "Spela matchlika övningar och prata igenom valen med tränaren efteråt." },
    ],
  },
  kommunikation: {
    mastery: "Kommunikationen sitter – ta gärna en ledarroll och hjälp yngre lagkamrater.",
    specs: [
      { level: 1, title: "Ropa på bollen", question: "Vågar du ropa på bollen?", criterion: "Ropar tydligt för att be om passning minst någon gång per match.", advice: "Öva att ropa högt i träning tills det känns naturligt." },
      { level: 1, title: "Prata utan bollen", question: "Pratar du med lagkamrater även när du inte har bollen?", criterion: "Ger enkla tillrop till lagkamrater även utan att själv ha bollen.", advice: "Sätt ett litet mål: minst tre tillrop per träningsmatch." },
      { level: 2, title: "Enkla kommandon", question: "Kan du säga 'vänd', 'tid' eller 'rygg'?", criterion: "Använder rätt kommando i rätt situation minst någon gång per match.", advice: "Öva kommandona i en enkel passningsövning tills de sitter." },
      { level: 3, title: "Hjälpa med instruktioner", question: "Kan du hjälpa lagkamrater med enkla instruktioner?", criterion: "Ger konkreta, korta instruktioner som hjälper en lagkamrat.", advice: "Träna att ge en instruktion i taget – kort och tydligt." },
      { level: 3, title: "Peka ut var bollen ska", question: "Kan du peka ut var lagkamraten ska spela bollen?", criterion: "Pekar/ropar ut en öppen yta eller spelare för lagkamraten.", advice: "Öva att peka samtidigt som du ropar för extra tydlighet." },
      { level: 4, title: "Kommunicera i förväg", question: "Kan du kommunicera före situationen händer?", criterion: "Ger information innan bollen kommer, inte efteråt.", advice: "Träna att ropa 'man på dig' eller liknande innan passningen anländer." },
      { level: 5, title: "Styra och hjälpa taktiskt", question: "Kan du styra och hjälpa andra spelare taktiskt?", criterion: "Ger taktiska tillrop som faktiskt förbättrar lagets positionering.", advice: "Öva att peka ut positionsjusteringar åt en hel grupp i smålagsspel." },
    ],
  },
  matchbeteende: {
    mastery: "Matchbeteendet sitter – bra grund för att ta ännu mer ansvar i laget.",
    specs: [
      { level: 1, title: "Komma igång snabbt", question: "Kommer du igång snabbt efter avbrott?", criterion: "Är redo och i rörelse inom några sekunder efter avbrott.", advice: "Öva att räkna till tre och vara i rörelse igen efter varje stopp." },
      { level: 1, title: "Redo innan avspark", question: "Är du redo och fokuserad innan avspark?", criterion: "Har koll på uppgift och motståndare innan matchen/perioden startar.", advice: "Gå igenom uppgiften med tränaren precis innan avspark." },
      { level: 2, title: "Jobba hem efter bolltapp", question: "Jobbar du hem efter bolltapp?", criterion: "Springer tillbaka i försvar direkt efter att ha tappat bollen.", advice: "Öva ett snabbt hemjobb varje gång bollen tappas i träning." },
      { level: 3, title: "Hålla fokus hela bytet", question: "Kan du hålla fokus hela bytet?", criterion: "Behåller koncentrationen genom hela speltiden, inte bara vid bollen.", advice: "Sätt delmål för fokus, t.ex. fem minuter i taget." },
      { level: 3, title: "Hantera besvikelse", question: "Kan du hantera besvikelse utan att tappa fokus?", criterion: "Fortsätter spela fokuserat efter ett misslyckat försök eller mål emot.", advice: "Öva en snabb 'reset'-rutin (andas, skaka av) direkt efter motgång." },
      { level: 4, title: "Studsa tillbaka efter misstag", question: "Kan du fortsätta spela bra efter misstag?", criterion: "Gör inte fler nya misstag som en direkt följd av ett tidigare misstag.", advice: "Träna att direkt tänka 'nästa boll' efter ett misstag." },
      { level: 5, title: "Höja laget", question: "Kan du höja laget med energi, ansvar och smarta beslut?", criterion: "Påverkar lagkamraterna positivt genom energi och goda beslut, sett över en match.", advice: "Ta på dig att peppa och organisera i minst en matchsituation varje match." },
    ],
  },
};

export const SKILLS: Skill[] = Object.entries(SKILL_SPECS).flatMap(([catId, { mastery, specs }]) =>
  buildCategory(catId as CategoryId, mastery, specs)
);

export function skillsByCategory(catId: CategoryId): Skill[] {
  return SKILLS.filter((s) => s.category === catId);
}

export function skill(id: string): Skill | undefined {
  return SKILLS.find((s) => s.id === id);
}

// ---------- Statuslogik, upplåsning och prioritering ----------
// (flyttat hit från prototypens lib/utveckling/logic.ts – samma logik, nu mot
// riktiga spelare i DB i stället för seedad exempeldata.)

export type SkillStatus = "not_started" | "training" | "almost" | "done";

export const STATUS_ORDER: SkillStatus[] = ["not_started", "training", "almost", "done"];

export const STATUS_LABEL: Record<SkillStatus, string> = {
  not_started: "Ej påbörjad",
  training: "Tränar på",
  almost: "Nästan klar",
  done: "Klar",
};

export const STATUS_COLOR: Record<SkillStatus, string> = {
  not_started: "var(--ink-faint)",
  training: "#f59e0b",
  almost: "#4d8ef0",
  done: "#1fba8a",
};

export type StatusMap = Record<string, SkillStatus>;

export function statusOf(statuses: StatusMap, skillId: string): SkillStatus {
  return statuses[skillId] ?? "not_started";
}

// En färdighet är olåst när den saknar krav, eller kravet är klart.
export function isUnlocked(s: Skill, statuses: StatusMap): boolean {
  if (!s.requires) return true;
  return statusOf(statuses, s.requires) === "done";
}

export interface CategoryProgress {
  category: CategoryId;
  total: number;
  done: number;
  percent: number;
  // Nivån spelaren tränar på just nu (första ej klara nivån), 5 om allt är klart.
  currentLevel: 1 | 2 | 3 | 4 | 5;
  mastered: boolean;
}

export function categoryProgress(catId: CategoryId, statuses: StatusMap): CategoryProgress {
  const skills = skillsByCategory(catId);
  const done = skills.filter((s) => statusOf(statuses, s.id) === "done").length;
  const firstUnfinished = skills.find((s) => statusOf(statuses, s.id) !== "done");
  return {
    category: catId,
    total: skills.length,
    done,
    percent: Math.round((done / skills.length) * 100),
    currentLevel: (firstUnfinished?.level ?? 5) as 1 | 2 | 3 | 4 | 5,
    mastered: !firstUnfinished,
  };
}

export function allCategoryProgress(statuses: StatusMap): CategoryProgress[] {
  return CATEGORIES.map((c) => categoryProgress(c.id, statuses));
}

export function totalProgress(statuses: StatusMap): { percent: number; done: number; total: number } {
  const done = SKILLS.filter((s) => statusOf(statuses, s.id) === "done").length;
  return { percent: SKILLS.length ? Math.round((done / SKILLS.length) * 100) : 0, done, total: SKILLS.length };
}

// De 3 kategorier som ligger mest efter (lägst klarad andel, ej redan bemästrade).
export function priorityAreas(statuses: StatusMap, count = 3): CategoryProgress[] {
  return allCategoryProgress(statuses)
    .filter((p) => !p.mastered)
    .sort((a, b) => a.percent - b.percent)
    .slice(0, count);
}

// Nästa rekommenderade färdighet: första olåsta, ej klara färdigheten i de mest
// prioriterade kategorierna (i turordning).
export function nextRecommendedSkill(statuses: StatusMap): Skill | null {
  const areas = priorityAreas(statuses, CATEGORIES.length);
  for (const area of areas) {
    const candidate = skillsByCategory(area.category).find(
      (s) => statusOf(statuses, s.id) !== "done" && isUnlocked(s, statuses)
    );
    if (candidate) return candidate;
  }
  return null;
}

export type FilterMode = "all" | "level1" | "level2" | "level3" | "level4" | "level5" | "next";

export function filterSkills(skills: Skill[], statuses: StatusMap, mode: FilterMode): Skill[] {
  switch (mode) {
    case "level1":
      return skills.filter((s) => s.level === 1);
    case "level2":
      return skills.filter((s) => s.level === 2);
    case "level3":
      return skills.filter((s) => s.level === 3);
    case "level4":
      return skills.filter((s) => s.level === 4);
    case "level5":
      return skills.filter((s) => s.level === 5);
    case "next":
      return skills.filter((s) => statusOf(statuses, s.id) !== "done" && isUnlocked(s, statuses));
    default:
      return skills;
  }
}
