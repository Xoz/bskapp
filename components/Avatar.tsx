// Deterministisk spelaravatar – initialer på accentfärgad platta
// Färgerna kommer från designsystemets accentpalett (Dark Mono Dashboard)
const PALETTE = [
  "#4d8ef0", "#1fba8a", "#a78bfa", "#f59e0b",
  "#f87171", "#86efac", "#6b7280", "#e8e6de",
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
        fontSize: size * 0.36,
        background: color,
      }}
    >
      {initials || "?"}
    </span>
  );
}
