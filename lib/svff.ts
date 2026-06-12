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
      { id: "driva", name: "Driva bollen", description: "Driver bollen med kontroll i olika riktningar och tempo" },
      { id: "utmana", name: "Utmana och finta", description: "Vågar utmana en mot en och använder finter" },
      { id: "passa", name: "Passningsspel", description: "Slår passningar med rätt riktning, tempo och vrist/insida" },
      { id: "mottagning", name: "Ta emot bollen", description: "Tar emot bollen med riktning, första touch mot yta" },
      { id: "avslut", name: "Avslut", description: "Avslutar mot mål med olika tekniker och från olika lägen" },
    ],
  },
  {
    id: "anfall_utan_boll",
    name: "Anfallsspel – utan boll",
    short: "Utan boll",
    color: "#1fba8a",
    skills: [
      { id: "spelbarhet", name: "Spelbarhet", description: "Erbjuder sig och gör sig spelbar i rätt ytor" },
      { id: "speldjup_bredd", name: "Speldjup och spelbredd", description: "Förstår och skapar djup och bredd i anfallsspelet" },
    ],
  },
  {
    id: "forsvar",
    name: "Försvarsspel",
    short: "Försvar",
    color: "#a78bfa",
    skills: [
      { id: "press", name: "Press på bollhållare", description: "Sätter press på rätt sätt och i rätt läge" },
      { id: "positionering", name: "Positionering", description: "Täcker yta och har rätt position i förhållande till boll och medspelare" },
      { id: "omstallning", name: "Omställningar", description: "Reagerar snabbt vid bollvinst och bollförlust" },
    ],
  },
  {
    id: "fysik",
    name: "Fysik och motorik",
    short: "Fysik",
    color: "#86efac",
    skills: [
      { id: "motorik", name: "Motorik och koordination", description: "Allsidig rörelseförmåga, balans och kroppskontroll" },
      { id: "snabbhet", name: "Snabbhet och rörlighet", description: "Snabba fötter, riktningsförändringar och löpteknik" },
    ],
  },
  {
    id: "psykosocialt",
    name: "Psykosocialt",
    short: "Psykosocialt",
    color: "#f59e0b",
    skills: [
      { id: "traningsvilja", name: "Träningsvilja och fokus", description: "Vill träna, lyssnar och anstränger sig på övningar" },
      { id: "lagkansla", name: "Samarbete och lagkänsla", description: "Stöttar lagkamrater och bidrar till en bra stämning" },
      { id: "mod", name: "Mod och självförtroende", description: "Vågar försöka, misslyckas och försöka igen" },
      { id: "gladje", name: "Glädje", description: "Visar glädje och trivs med fotbollen" },
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
