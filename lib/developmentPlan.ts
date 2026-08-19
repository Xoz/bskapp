import type { SkillStatus, StatusMap } from "./skillTrappan";

export type DevelopmentPlanAreaId = "teknik" | "spel" | "fokus";

export interface DevelopmentPlanStep {
  id: string;
  area: DevelopmentPlanAreaId;
  label: string;
  question: string;
  criterion: string;
  advice: string;
  step: 1 | 2 | 3;
  requires?: string;
}

export interface DevelopmentPlanArea {
  id: DevelopmentPlanAreaId;
  name: string;
  icon: string;
  color: string;
}

const PLAN_AREAS: DevelopmentPlanArea[] = [
  { id: "teknik", name: "Teknik", icon: "⚽", color: "#4d8ef0" },
  { id: "spel", name: "Spelförståelse", icon: "🧠", color: "#1fba8a" },
  { id: "fokus", name: "Fysik och fokus", icon: "💪", color: "#fb7185" },
];

const PLAN_STEPS: DevelopmentPlanStep[] = [
  {
    id: "plan-teknik-1",
    area: "teknik",
    step: 1,
    label: "Steg 1 · Första touch i lugn miljö",
    question: "Kan du ta emot en passning i lugnt tempo med trygg första touch?",
    criterion: "Bollen kommer till lagkamraten inom kontroll nära foten 8 av 10 gånger.",
    advice: "Börja i enkel övning med lugna passningar och fokus på teknik fram före fart.",
  },
  {
    id: "plan-teknik-2",
    area: "teknik",
    step: 2,
    label: "Steg 2 · Första touch med press",
    question: "Kan du ta första touch när en försvarare står nära?",
    criterion: "Håller kontrollen i matchlika situationer med låg press i 3 av 5 gånger.",
    advice: "Minska ytan, lägg ögat tidigt och använd kroppen för att skapa en touchzon.",
    requires: "plan-teknik-1",
  },
  {
    id: "plan-teknik-3",
    area: "teknik",
    step: 3,
    label: "Steg 3 · Touch + beslut",
    question: "Kan du kombinera första touch med rätt nästa handling?",
    criterion: "Rätt val direkt efter mottagning i träningsspel 8 av 10 gånger.",
    advice: "Spela smålagsspel där nästa handling (pass/löpning/dribbling) alltid måste avgöras direkt.",
    requires: "plan-teknik-2",
  },

  {
    id: "plan-spel-1",
    area: "spel",
    step: 1,
    label: "Steg 1 · Se spelet före bollen",
    question: "Kan du hitta mål/ytor innan bollen når din fot?",
    criterion: "Lyfter blicken innan mottagning i minst en av tre träningssekvenser.",
    advice: "Låt bollen inte styra var du ser – pausa med blicken före du tar emot.",
  },
  {
    id: "plan-spel-2",
    area: "spel",
    step: 2,
    label: "Steg 2 · Vara spelbar",
    question: "Kan du göra dig till en bra mottagare med rörelse före passningen?",
    criterion: "Visar aktiv rörelse till fri yta och signalförmåga i 4 av 5 övningar.",
    advice: "Träna först att kalla på bollen, sedan ta emot i rörelse.",
    requires: "plan-spel-1",
  },
  {
    id: "plan-spel-3",
    area: "spel",
    step: 3,
    label: "Steg 3 · Rätt beslut i övergång",
    question: "Kan du välja rätt handling på under en sekund när rollen byter?",
    criterion: "Rätt beslut i övergångsövningar utan upprepade misstag.",
    advice: "Låt coach ge två snabba scenarier innan spelaren får ta beslut på egen hand.",
    requires: "plan-spel-2",
  },

  {
    id: "plan-fokus-1",
    area: "fokus",
    step: 1,
    label: "Steg 1 · Starttempo",
    question: "Kan du vara med i tempo från avspark och första bytet?",
    criterion: "Aktiv och i rätt position under första 10 minuterna av match/träning.",
    advice: "Sätt ett förberedande tempo och ha en tydlig startrutin innan matchen.",
  },
  {
    id: "plan-fokus-2",
    area: "fokus",
    step: 2,
    label: "Steg 2 · Återhämta snabbare",
    question: "Kan du komma tillbaka direkt efter vila/byten?",
    criterion: "Visar samma kvalitet i intensitet på två intilliggande passager.",
    advice: "Inför ett tydligt återhämtningsfönster med vätskebesked och rörelse innan återstart.",
    requires: "plan-fokus-1",
  },
  {
    id: "plan-fokus-3",
    area: "fokus",
    step: 3,
    label: "Steg 3 · Hålla energin hela matchen",
    question: "Kan du vara med i slutspurten med fortsatt kvalitet?",
    criterion: "Matchlik intensitet mot slutet av andra halvlek i 2 av 3 träningsmatcher.",
    advice: "Lär en personlig minutplan för när kroppen behöver skarp kontroll och andning.",
    requires: "plan-fokus-2",
  },
];

export const DEVELOPMENT_PLAN_STEP_IDS = PLAN_STEPS.map((step) => step.id);

export const DEVELOPMENT_PLAN_AREAS = PLAN_AREAS;

export const DEVELOPMENT_PLAN_STEPS = PLAN_STEPS;

export function statusOfPlanStep(statuses: StatusMap, stepId: string): SkillStatus {
  return (statuses[stepId] as SkillStatus | undefined) ?? "not_started";
}

export function isPlanStepUnlocked(step: DevelopmentPlanStep, statuses: StatusMap): boolean {
  if (!step.requires) return true;
  return statusOfPlanStep(statuses, step.requires) === "done";
}

export function getPlanAreaSteps(areaId: DevelopmentPlanAreaId): DevelopmentPlanStep[] {
  return DEVELOPMENT_PLAN_STEPS.filter((step) => step.area === areaId);
}

export function getNextPlanStep(areaId: DevelopmentPlanAreaId, statuses: StatusMap): DevelopmentPlanStep | null {
  for (const step of getPlanAreaSteps(areaId)) {
    if (statusOfPlanStep(statuses, step.id) !== "done" && isPlanStepUnlocked(step, statuses)) {
      return step;
    }
  }
  return null;
}

export function getPlanAreaDoneCount(areaId: DevelopmentPlanAreaId, statuses: StatusMap): number {
  return getPlanAreaSteps(areaId).filter((step) => statusOfPlanStep(statuses, step.id) === "done").length;
}
