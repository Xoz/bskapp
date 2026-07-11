import Link from "next/link";
import { Badge, Card, PageHeader } from "@/components/ui";
import { observations, periods, sessions } from "@/data/demo";
import { skillMinutes } from "@/domain/training";

export default function Dashboard() {
  const next = sessions[0];
  const minutes = [...skillMinutes(sessions).entries()].sort((a, b) => a[1] - b[1]);
  return <div className="page">
    <PageHeader eyebrow="LÖRDAG 11 JULI" title="God kväll, tränare"><Link className="button primary" href="/traningspass">+ Skapa träningspass</Link></PageHeader>
    <section className="hero"><div><Badge>NÄSTA TRÄNING</Badge><h2>{next.title}</h2><p>Tisdag 14 juli · 18:00–19:15 · Bollplan 1</p><div className="hero-stats"><span><b>12</b> preliminära</span><span><b>75</b> minuter</span><span><b>3</b> moment</span></div></div><div className="hero-actions"><Link className="button primary" href="/traningspass">Öppna passet</Link><button className="button">Starta träningsläge</button></div></section>
    <div className="grid two">
      <Card title="Aktuell träningsperiod" meta={`${periods[1].startsOn} – ${periods[1].endsOn}`}><Badge tone="blue">VECKA 4 AV 7</Badge><h3>{periods[1].name}</h3><p>{periods[1].theme}</p><div className="progress"><i style={{ width: "58%" }} /></div><Link href="/planering">Öppna säsongsplan →</Link></Card>
      <Card title="Senaste matchobservation" meta={observations[0].match}><Badge tone="amber">BEHÖVER UTVECKLAS</Badge><p className="quote">“{observations[0].summary}”</p><p>Föreslaget fokus: scanning, spelbarhet och första touch.</p><Link href="/matcher">Koppla till nästa träning →</Link></Card>
    </div>
    <div className="grid three">
      <Card title="Behöver mer träning" meta="Senaste 8 veckorna"><ul className="meter-list">{minutes.slice(0, 4).map(([skill, value]) => <li key={skill}><span>{skill.replaceAll("-", " ")}</span><b>{value} min</b></li>)}</ul></Card>
      <Card title="Att följa upp" meta="3 aktiva uppgifter"><ul className="check-list"><li>Utvärdera periodens mål</li><li>Följ upp Alvas mottagningsmål</li><li>Förbered material till tisdag</li></ul></Card>
      <Card title="Snabbvägar" meta="Gå direkt till arbetet"><div className="quick-links"><Link href="/ovningar">Hitta en övning</Link><Link href="/planering">Planera nästa vecka</Link><Link href="/matcher">Ny matchobservation</Link></div></Card>
    </div>
  </div>;
}
