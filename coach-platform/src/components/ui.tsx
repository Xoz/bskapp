import type { ReactNode } from "react";

export function PageHeader({ eyebrow, title, children }: { eyebrow: string; title: string; children?: ReactNode }) {
  return <header className="page-header"><div><small>{eyebrow}</small><h1>{title}</h1></div>{children}</header>;
}

export function Card({ title, meta, children, className = "" }: { title: string; meta?: string; children: ReactNode; className?: string }) {
  return <section className={`card ${className}`}><header><div><h2>{title}</h2>{meta && <small>{meta}</small>}</div></header>{children}</section>;
}

export function Badge({ children, tone = "green" }: { children: ReactNode; tone?: "green" | "amber" | "blue" }) {
  return <span className={`badge ${tone}`}>{children}</span>;
}
