export const SELF_COMPARISONS = ["below", "usual", "above"] as const;
export const MATCH_IMPACTS = ["struggled", "held", "influenced"] as const;
export const REASON_TAGS = ["", "decisions", "defence", "attack", "effort", "confidence"] as const;

export type SelfComparison = (typeof SELF_COMPARISONS)[number];
export type MatchImpact = (typeof MATCH_IMPACTS)[number];

export const SELF_LABELS: Record<SelfComparison, string> = {
  below: "Sämre",
  usual: "Som vanligt",
  above: "Bättre",
};

export const IMPACT_LABELS: Record<MatchImpact, string> = {
  struggled: "Hade svårt",
  held: "Hängde med",
  influenced: "Påverkade matchen",
};

export const REASON_LABELS: Record<(typeof REASON_TAGS)[number], string> = {
  "": "Ingen orsakstagg",
  decisions: "Beslut",
  defence: "Försvar",
  attack: "Anfall",
  effort: "Arbetsinsats",
  confidence: "Självförtroende",
};

export const isSelfComparison = (value: string): value is SelfComparison =>
  SELF_COMPARISONS.includes(value as SelfComparison);

export const isMatchImpact = (value: string): value is MatchImpact =>
  MATCH_IMPACTS.includes(value as MatchImpact);

export const isReasonTag = (value: string): value is (typeof REASON_TAGS)[number] =>
  REASON_TAGS.includes(value as (typeof REASON_TAGS)[number]);
