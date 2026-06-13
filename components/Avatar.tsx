// Spelaravatar i form av lagets matchtröja med tröjnumret.
// Färgerna styrs av CSS-variabler som sätts från inställningarna:
//   --jersey / --jersey-ink        utespelartröja (gul med svart text)
//   --gk-jersey / --gk-jersey-ink  målvaktströja (annan färg)
// Målvakten är spelaren med tröjnummer 1.

function clean(name: string) {
  return name.replace(/^Exempel:\s*/, "");
}

function initials(name: string) {
  return clean(name)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
}

export default function Avatar({
  name,
  jersey,
  size = 36,
}: {
  name: string;
  jersey?: number | null;
  size?: number;
}) {
  const isKeeper = jersey === 1;
  const fill = isKeeper ? "var(--gk-jersey, #1f9d57)" : "var(--jersey, #ffd23f)";
  const ink = isKeeper ? "var(--gk-jersey-ink, #ffffff)" : "var(--jersey-ink, #111111)";
  const label = jersey != null ? String(jersey) : initials(name) || "?";
  // Mindre text för initialer/tvåsiffriga nummer så det får plats i tröjan
  const fontSize = label.length >= 2 ? 30 : 38;

  return (
    <span
      className="jersey-avatar"
      style={{ width: size, height: size, display: "inline-flex", flexShrink: 0 }}
      title={jersey != null ? `${clean(name)} · #${jersey}` : clean(name)}
      aria-label={clean(name)}
    >
      <svg viewBox="0 0 100 100" width={size} height={size}>
        {/* Tröjsilhuett med korta ärmar och v-ringning */}
        <path
          d="M28,22 L40,22 L50,31 L60,22 L72,22 L90,34 L80,47 L70,41 L70,84 Q70,86 68,86 L32,86 Q30,86 30,84 L30,41 L20,47 L10,34 Z"
          fill={fill}
          stroke="rgba(0,0,0,0.16)"
          strokeWidth={1.5}
          strokeLinejoin="round"
        />
        <text
          x="50"
          y="64"
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={fontSize}
          fontWeight="700"
          fontFamily="var(--font-display)"
          fill={ink}
        >
          {label}
        </text>
      </svg>
    </span>
  );
}
