// SvFF:s spelarutbildningsplan – anpassad för åldersgruppen 10–12 år (spelform 7 mot 7).
// Utvärderingen är ett utvecklingsverktyg för tränare, inte ett betygssystem.
// Nivåerna beskriver var spelaren befinner sig i sin inlärning – alla spelare
// utvecklas i olika takt och det är helt normalt.

export type SkillLevel = 1 | 2 | 3 | 4;

export const LEVELS: { value: SkillLevel; label: string; description: string }[] = [
  { value: 1, label: "Utforskar", description: "Har börjat prova färdigheten" },
  { value: 2, label: "Utvecklar", description: "Klarar färdigheten ibland, under enkla förhållanden" },
  { value: 3, label: "Befäster", description: "Klarar färdigheten ofta, även under press" },
  { value: 4, label: "Behärskar", description: "Använder färdigheten naturligt i spelet" },
];

export interface Skill {
  id: string;
  name: string;
  description: string;
  // Konkret "kan spelaren...?"-kriterium per nivå, visas i stället för den
  // generiska nivåbeskrivningen så tränaren bedömer något specifikt, inte en
  // känsla. Psykosocialt är medvetet mjukare formulerat (observation snarare
  // än strikt ja/nej) eftersom de färdigheterna inte är binära på samma sätt.
  criteria: Record<SkillLevel, string>;
}

export interface SkillCategory {
  id: string;
  name: string;
  short: string;
  color: string;
  skills: Skill[];
}

export const CATEGORIES: SkillCategory[] = [
  {
    id: "anfall_boll",
    name: "Anfallsspel – med boll",
    short: "Med boll",
    color: "#4d8ef0",
    skills: [
      {
        id: "driva",
        name: "Driva bollen",
        description: "Driver bollen med kontroll i olika riktningar och tempo",
        criteria: {
          1: "Kan spelaren driva bollen 5 meter rakt fram utan att tappa den helt?",
          2: "Kan spelaren driva bollen 10 meter och växla mellan insida/utsida utan press?",
          3: "Kan spelaren driva bollen i matchfart och behålla kontrollen med en motståndare i närheten?",
          4: "Väljer spelaren själv rätt — driva vidare eller passa — i en matchlik situation, minst 8 av 10 gånger?",
        },
      },
      {
        id: "utmana",
        name: "Utmana och finta",
        description: "Vågar utmana en mot en och använder finter",
        criteria: {
          1: "Vågar spelaren försöka dribbla förbi en motståndare, även om bollen tappas?",
          2: "Klarar spelaren en enkel finish (fint) mot en passiv försvarare?",
          3: "Tar sig spelaren förbi en aktiv försvarare och accelererar direkt efteråt, minst 3 av 5 gånger?",
          4: "Avgör spelaren själv i match när hen ska utmana och när hen ska spela bollen vidare?",
        },
      },
      {
        id: "passa",
        name: "Passningsspel",
        description: "Slår passningar med rätt riktning, tempo och vrist/insida",
        criteria: {
          1: "Kan spelaren slå en enkel bredsidespassning 5 meter till en lagkamrat?",
          2: "Väljer spelaren rätt fot och passar både kort och något längre med rimlig precision?",
          3: "Passar spelaren i rätt ögonblick och med rätt tempo även med en motståndare i närheten?",
          4: "Väljer spelaren själv rätt passning (kort/långt, framåt/bakåt) utifrån situationen i match?",
        },
      },
      {
        id: "mottagning",
        name: "Ta emot bollen",
        description: "Tar emot bollen med riktning, första touch mot yta",
        criteria: {
          1: "Kan spelaren stoppa en lugn passning utan att bollen studsar långt bort?",
          2: "Styr spelarens första touch bollen ungefär åt det håll hen vill spela vidare?",
          3: "Kan spelaren ta emot bollen och vända i samma rörelse när ytan tillåter?",
          4: "Skannar spelaren av planen innan bollen kommer och agerar direkt utifrån vad hen ser?",
        },
      },
      {
        id: "avslut",
        name: "Avslut",
        description: "Avslutar mot mål med olika tekniker och från olika lägen",
        criteria: {
          1: "Kan spelaren skjuta mot mål från kort håll på en stillaliggande boll?",
          2: "Kan spelaren avsluta med god kontakt efter en enkel drivning?",
          3: "Väljer spelaren rätt typ av avslut utifrån läget (t.ex. placering eller kraft)?",
          4: "Avslutar spelaren självständigt i matchlika lägen, med försvarare nära, minst hälften av gångerna?",
        },
      },
    ],
  },
  {
    id: "anfall_utan_boll",
    name: "Anfallsspel – utan boll",
    short: "Utan boll",
    color: "#1fba8a",
    skills: [
      {
        id: "spelbarhet",
        name: "Spelbarhet",
        description: "Erbjuder sig och gör sig spelbar i rätt ytor",
        criteria: {
          1: "Rör sig spelaren mot en öppen yta istället för att stå still när laget har bollen?",
          2: "Signalerar spelaren tydligt (rop eller handrörelse) för att be om passning?",
          3: "Skapar spelaren yta åt sig själv genom att röra sig bort från press innan bollen kommer?",
          4: "Läser spelaren när hen ska erbjuda djup eller bredd, beroende på lagets uppspel?",
        },
      },
      {
        id: "speldjup_bredd",
        name: "Speldjup och spelbredd",
        description: "Förstår och skapar djup och bredd i anfallsspelet",
        criteria: {
          1: "Förstår spelaren skillnaden mellan att röra sig djupt (framåt) och brett (i sidled)?",
          2: "Rör sig spelaren till en öppen yta i sidled eller på djupet när laget har bollen?",
          3: "Skapar spelaren yta åt en lagkamrat genom att dra med sig en motståndare?",
          4: "Justerar spelaren sin position i takt med att laget skiftar sida eller trycker upp?",
        },
      },
    ],
  },
  {
    id: "forsvar",
    name: "Försvarsspel",
    short: "Försvar",
    color: "#a78bfa",
    skills: [
      {
        id: "press",
        name: "Press på bollhållare",
        description: "Sätter press på rätt sätt och i rätt läge",
        criteria: {
          1: "Rör sig spelaren mot bollhållaren istället för att stå still?",
          2: "Sätter spelaren press utan att rusa förbi och tappa balansen?",
          3: "Styr spelaren bollhållaren åt ett håll (t.ex. mot sidlinjen) genom sin press?",
          4: "Väljer spelaren rätt läge att pressa hårt eller falla tillbaka, utifrån matchsituationen?",
        },
      },
      {
        id: "positionering",
        name: "Positionering",
        description: "Täcker yta och har rätt position i förhållande till boll och medspelare",
        criteria: {
          1: "Står spelaren mellan sin motståndare och det egna målet?",
          2: "Håller spelaren rimligt avstånd till motståndaren utan att rusa in i tacklingar?",
          3: "Justerar spelaren sin position när bollen eller laget flyttar sig?",
          4: "Täcker spelaren upp för en lagkamrat som lämnat sin position?",
        },
      },
      {
        id: "omstallning",
        name: "Omställningar",
        description: "Reagerar snabbt vid bollvinst och bollförlust",
        criteria: {
          1: "Reagerar spelaren genom att jaga tillbaka direkt efter en bollförlust?",
          2: "Försöker spelaren vinna tillbaka bollen snabbt inom några sekunder efter förlust?",
          3: "Är spelaren snabbt redo att anfalla direkt efter en bollvinst istället för att stanna kvar i försvarsläge?",
          4: "Läser spelaren matchen så pass att hen ligger steget före vid omställningar, i båda riktningarna?",
        },
      },
    ],
  },
  {
    id: "fysik",
    name: "Fysik och motorik",
    short: "Fysik",
    color: "#86efac",
    skills: [
      {
        id: "motorik",
        name: "Motorik och koordination",
        description: "Allsidig rörelseförmåga, balans och kroppskontroll",
        criteria: {
          1: "Klarar spelaren enkla koordinationsövningar (t.ex. balansera, hoppa, springa i mönster)?",
          2: "Rör sig spelaren smidigt mellan olika rörelser (springa, vända, hoppa) utan att tappa balansen?",
          3: "Behåller spelaren god kroppskontroll även i högt tempo eller vid kontakt?",
          4: "Är spelarens rörelsemönster naturliga och automatiserade även under matchpress?",
        },
      },
      {
        id: "snabbhet",
        name: "Snabbhet och rörlighet",
        description: "Snabba fötter, riktningsförändringar och löpteknik",
        criteria: {
          1: "Kan spelaren göra en snabb riktningsförändring utan att ramla eller tappa farten helt?",
          2: "Accelererar spelaren tydligt de första stegen efter en start?",
          3: "Håller spelaren farten genom en kort sprint på 10–15 meter?",
          4: "Kombinerar spelaren snabbhet med bollkontroll eller beslut, utan att tappa tempo?",
        },
      },
    ],
  },
  {
    id: "psykosocialt",
    name: "Psykosocialt",
    short: "Psykosocialt",
    color: "#f59e0b",
    skills: [
      {
        id: "traningsvilja",
        name: "Träningsvilja och fokus",
        description: "Vill träna, lyssnar och anstränger sig på övningar",
        criteria: {
          1: "Deltar oftast i övningarna, kan behöva påminnelse ibland.",
          2: "Håller fokus genom de flesta övningar utan att behöva tillsägelse.",
          3: "Söker gärna extra repetitioner på det som är svårt, av egen vilja.",
          4: "Peppar och hjälper aktivt lagkamrater att hålla fokus och energi uppe.",
        },
      },
      {
        id: "lagkansla",
        name: "Samarbete och lagkänsla",
        description: "Stöttar lagkamrater och bidrar till en bra stämning",
        criteria: {
          1: "Kan samarbeta i enkla övningar tillsammans med andra.",
          2: "Stöttar lagkamrater med uppmuntran under träning och match.",
          3: "Bidrar aktivt till en bra stämning i gruppen, även när det går tungt.",
          4: "Är en person andra i laget söker sig till för stöd och sammanhållning.",
        },
      },
      {
        id: "mod",
        name: "Mod och självförtroende",
        description: "Vågar försöka, misslyckas och försöka igen",
        criteria: {
          1: "Vågar prova nya saker, även om det känns osäkert.",
          2: "Fortsätter försöka igen efter ett misslyckat försök.",
          3: "Vågar ta initiativ i matchsituationer, även med risk att misslyckas.",
          4: "Litar på sin egen förmåga och påverkar andra positivt med sitt självförtroende.",
        },
      },
      {
        id: "gladje",
        name: "Glädje",
        description: "Visar glädje och trivs med fotbollen",
        criteria: {
          1: "Verkar överlag ha roligt på träningar och matcher.",
          2: "Ler och skrattar ofta tillsammans med laget.",
          3: "Sprider glädje omkring sig, även i motgång.",
          4: "Är en av dem som gör att andra i laget trivs och vill komma tillbaka.",
        },
      },
    ],
  },
];

export const ALL_SKILLS: (Skill & { categoryId: string })[] = CATEGORIES.flatMap((c) =>
  c.skills.map((s) => ({ ...s, categoryId: c.id }))
);

export function skillById(id: string) {
  return ALL_SKILLS.find((s) => s.id === id);
}

export function categoryById(id: string) {
  return CATEGORIES.find((c) => c.id === id);
}

// SvFF:s riktlinjer för barn- och ungdomsfotboll som appen bygger på
export const SVFF_PRINCIPLES = [
  "Fotboll ska vara roligt – glädje är grunden för all utveckling",
  "Alla spelare ska få spela lika mycket – jämn speltid över säsongen",
  "Fokus på utveckling, inte resultat – inga tabeller i barnfotbollen",
  "Låt spelarna prova olika positioner och roller",
  "Utvärderingen är ett stöd för tränare – aldrig ett betyg eller en rankning",
  "Alla utvecklas i olika takt – jämför spelaren med sig själv, inte med andra",
];

// Spelform enligt SvFF för 12-åringar
export const GAME_FORMAT = {
  format: "7 mot 7",
  periods: "3 × 20 minuter",
  totalMinutes: 60,
  ballSize: "Storlek 4",
};
