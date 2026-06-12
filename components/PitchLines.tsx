// Dekorativt planmotiv – linjer ur fågelperspektiv, används som vattenstämpel
export default function PitchLines({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 400 600"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      className={className}
      aria-hidden
    >
      <rect x="20" y="20" width="360" height="560" rx="8" />
      <line x1="20" y1="300" x2="380" y2="300" />
      <circle cx="200" cy="300" r="60" />
      <circle cx="200" cy="300" r="3" fill="currentColor" stroke="none" />
      <rect x="110" y="20" width="180" height="70" />
      <rect x="155" y="20" width="90" height="30" />
      <rect x="110" y="510" width="180" height="70" />
      <rect x="155" y="550" width="90" height="30" />
      <path d="M150 90a55 55 0 0 0 100 0" />
      <path d="M150 510a55 55 0 0 1 100 0" />
    </svg>
  );
}
