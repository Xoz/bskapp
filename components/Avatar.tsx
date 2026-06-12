// Deterministisk spelaravatar – initialer på färgad platta
const PALETTE = [
  "#1d44a0", "#0e7490", "#7c3aed", "#0f766e",
  "#b45309", "#be185d", "#4338ca", "#15803d",
];

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export default function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  const clean = name.replace(/^Exempel:\s*/, "");
  const initials = clean
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
  const color = PALETTE[hash(clean) % PALETTE.length];

  return (
    <span
      className="avatar"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.38,
        background: `linear-gradient(145deg, color-mix(in srgb, ${color}, #ffffff 22%), ${color})`,
        boxShadow: `inset 0 1px 0 rgba(255,255,255,0.25), 0 2px 6px -2px ${color}66`,
      }}
    >
      {initials || "?"}
    </span>
  );
}
