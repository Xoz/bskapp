import { Badge, PageHeader } from "@/components/ui";
import { removePlayer, upsertPlayer } from "@/app/actions";
import { listPlayers } from "@/repositories/postgres";

export const dynamic = "force-dynamic";

function PlayerForm({ player }: { player?: Awaited<ReturnType<typeof listPlayers>>[number] }) {
  return <form action={upsertPlayer} className="edit-form">
    {player && <input name="id" type="hidden" value={player.id}/>}<input name="name" defaultValue={player?.name} placeholder="Namn" required minLength={2}/><input name="birthYear" type="number" defaultValue={player?.birthYear ?? 2014} aria-label="Födelseår" required/><input name="number" type="number" defaultValue={player?.number} placeholder="Tröjnummer"/><input name="positions" defaultValue={player?.positions.join(", ")} placeholder="Positioner, kommaseparerade"/><button className="button primary">{player ? "Spara" : "Lägg till"}</button>
  </form>;
}

export default async function PlayersPage() {
  const players = await listPlayers();
  return <div className="page"><PageHeader eyebrow="F2014 GUL" title={`Spelare (${players.length})`}><details className="create-panel"><summary className="button primary">+ Lägg till spelare</summary><PlayerForm/></details></PageHeader><div className="player-grid">{players.map((player, index) => <article className="player-card" key={player.id}><div className="avatar">{player.name[0]}</div><div><h2>{player.name}</h2><p>#{player.number ?? "–"} · {player.positions.join(" / ") || "Ingen position"}</p><Badge>AKTIV</Badge><details><summary>Redigera</summary><PlayerForm player={player}/><form action={removePlayer}><input name="id" type="hidden" value={player.id}/><button className="delete-button">Ta bort</button></form></details></div><div className="skill-ring" aria-label={`Utvecklingsprogression ${48 + index * 2}%`}>{48 + index * 2}%</div></article>)}</div></div>;
}
