// +90-loggan – "Stopptidsringen": stoppursring där visaren passerat tolv och
// plus-tecknet sitter som krona = den 90:e minuten + tilläggstid.
// Ringen/visaren ärver --ink, plus + mittpunkt ärver --primary (klubbaccenten),
// så märket byter färg med klubben. Bygger på rena geometriska primitiver och
// håller ända ner till 24px.
import type { SVGProps } from "react";

export function Logo90Mark({ size = 26, ...props }: { size?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} fill="none" aria-hidden {...props}>
      <path d="M61.6 18 A34 34 0 1 1 38.4 18" style={{ stroke: "var(--ink)", strokeWidth: 7, strokeLinecap: "round" }} />
      <line x1="50" y1="50" x2="62.6" y2="32" style={{ stroke: "var(--ink)", strokeWidth: 6, strokeLinecap: "round" }} />
      <circle cx="50" cy="50" r="4.5" style={{ fill: "var(--primary)" }} />
      <rect x="41" y="15" width="18" height="6" rx="3" style={{ fill: "var(--primary)" }} />
      <rect x="47" y="9" width="6" height="18" rx="3" style={{ fill: "var(--primary)" }} />
    </svg>
  );
}

// Lockup: märke + ordbild "+90" (plus i accent, 90 i ink).
export function Logo90({ size = 26 }: { size?: number }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "9px" }}>
      <Logo90Mark size={size} />
      <span
        style={{
          fontFamily: "var(--font-display), sans-serif",
          fontWeight: 800,
          fontSize: `${size * 0.85}px`,
          letterSpacing: "-0.02em",
          lineHeight: 1,
        }}
      >
        <span style={{ color: "var(--primary)" }}>+</span>
        <span style={{ color: "var(--ink)" }}>90</span>
      </span>
    </span>
  );
}
