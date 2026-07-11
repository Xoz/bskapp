import Link from "next/link";
import type { ReactNode } from "react";

const links = [["/", "Översikt"], ["/planering", "Planering"], ["/traningspass", "Träningspass"], ["/ovningar", "Övningar"], ["/spelare", "Spelare"], ["/matcher", "Matcher"]];

export function AppShell({ children }: { children: ReactNode }) {
  return <div className="shell">
    <aside className="sidebar">
      <Link href="/" className="brand"><span className="brand-mark">P</span><span><b>Planlinjen</b><small>Tränarplattform</small></span></Link>
      <nav aria-label="Huvudnavigation">{links.map(([href, label]) => <Link href={href} key={href}>{label}</Link>)}</nav>
      <div className="team-card"><small>AKTIVT LAG</small><b>F2014 Gul</b><span>7 mot 7 · Säsong 2026</span></div>
    </aside>
    <main><header className="topbar"><div><small>BSK Demo / F2014 Gul</small><strong>Säsong 2026</strong></div><button type="button" aria-label="Byt lag">Byt lag</button></header>{children}</main>
    <nav className="mobile-nav" aria-label="Mobilnavigation">{links.slice(0, 5).map(([href, label]) => <Link href={href} key={href}>{label}</Link>)}</nav>
  </div>;
}
