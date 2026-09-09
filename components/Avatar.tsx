// Neutral spelaridentitet. Tröjnummer bevaras som information utan stora klubbfärgade ytor.
function clean(name: string) { return name.replace(/^Exempel:\s*/, ""); }
function initials(name: string) {
  return clean(name).split(/\s+/).filter(Boolean).slice(0, 2).map((word) => word[0]?.toUpperCase()).join("");
}
export default function Avatar({ name, jersey, size = 36 }: { name: string; jersey?: number | null; size?: number }) {
  return <span className="bsk-avatar" style={{ width: size, height: size, fontSize: Math.max(12, Math.round(size * .34)) }} title={jersey != null ? `${clean(name)} · #${jersey}` : clean(name)} aria-label={clean(name)}>{jersey != null ? jersey : initials(name) || "?"}</span>;
}
