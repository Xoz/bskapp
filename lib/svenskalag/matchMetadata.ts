export type MatchMetadata = {
  competitionId: string | null;
  competitionName: string;
  matchType: "seriespel" | "traningsmatch" | null;
  format: 7 | 9 | null;
  formatSource: "explicit" | "default" | null;
  scope: "supported" | "cup" | "unknown";
};
// Verifierade tävlings-id:n för F2014:s Sanktan 2026, Gul och Grön.
// Nya serier behöver verifieras; URL-prefixet sanktan är inte ett typbevis.
const sanktanCompetitions = new Set(["383770", "383772", "384047", "384048", "384049"]);
export const matchMetadataKey = (id:number) => `svenskalag_match_metadata:${id}`;
export function classifyMatch(competitionId:string | null, competitionName:string, description=""): MatchMetadata {
  const name=competitionName.trim().replace(/\s+/g," ");
  const base:MatchMetadata={competitionId,competitionName:name,matchType:null,format:null,formatSource:null,scope:"unknown"};
  // Friendly-grupper inom en cup ska inte omklassas till träningsmatch.
  if (/\bcup(?:en)?\b/i.test(name)) return {...base,scope:"cup"};
  const matchType = /^träningsmatch(?:er)?(?:\s|$)/i.test(name) ? "traningsmatch"
    : competitionId && sanktanCompetitions.has(competitionId) ? "seriespel" : null;
  if (!matchType) return base;
  const text=`${name} ${description}`;
  const nine=/(?:\b9\s*(?:v|mot|x)\s*9\b|\b9[ -]?manna\b)/i.test(text);
  const seven=/(?:\b7\s*(?:v|mot|x)\s*7\b|\b7[ -]?manna\b)/i.test(text);
  if (nine && seven) return base;
  return {...base,scope:"supported",matchType,format:nine?9:7,formatSource:nine||seven?"explicit":"default"};
}
export function validMatchMetadata(value:unknown): value is MatchMetadata {
  if (!value || typeof value!=="object") return false;
  const m=value as MatchMetadata;
  return (m.competitionId===null || (typeof m.competitionId==="string" && /^\d+$/.test(m.competitionId)))
    && typeof m.competitionName==="string" && m.competitionName.length<=250
    && ["supported","cup","unknown"].includes(m.scope)
    && (m.scope==="supported" ? ["seriespel","traningsmatch"].includes(m.matchType!) && [7,9].includes(m.format!) && ["explicit","default"].includes(m.formatSource!)
      : m.matchType===null && m.format===null && m.formatSource===null);
}
export function readMatchMetadata(raw:string): MatchMetadata | null {
  try {const value=JSON.parse(raw);return validMatchMetadata(value)?value:null;}catch{return null;}
}
