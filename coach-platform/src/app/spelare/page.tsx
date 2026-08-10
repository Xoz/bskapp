import { createGoalAction, reactivatePlayer, removePlayer, restrictPlayer, upsertPlayer } from "@/app/actions";
import { Badge, PageHeader } from "@/components/ui";
import { listGoals, listPlayers, listSkills } from "@/repositories/postgres";

export const dynamic = "force-dynamic";

function PlayerForm({ player }: { player?: Awaited<ReturnType<typeof listPlayers>>[number] }) {
  return (
    <form action={upsertPlayer} className="edit-form">
      {player && <input name="id" type="hidden" value={player.id} />}
      <input name="name" defaultValue={player?.name} placeholder="Namn" required minLength={2} />
      <input name="birthYear" type="number" defaultValue={player?.birthYear ?? 2014} aria-label="Födelseår" required />
      <input name="number" type="number" defaultValue={player?.number} placeholder="Tröjnummer" />
      <input name="positions" defaultValue={player?.positions.join(", ")} placeholder="Positioner, kommaseparerade" />
      <button className="button primary">{player ? "Spara" : "Lägg till"}</button>
    </form>
  );
}

export default async function PlayersPage() {
  const [players, goals, skills] = await Promise.all([listPlayers(), listGoals(), listSkills()]);
  const byPlayer = new Map<string, typeof goals>();
  for (const goal of goals) byPlayer.set(goal.playerId, [...(byPlayer.get(goal.playerId) ?? []), goal]);

  return (
    <div className="page">
      <PageHeader eyebrow="F2014 GUL" title={`Spelare (${players.length})`}>
        <details className="create-panel"><summary className="button primary">+ Lägg till spelare</summary><PlayerForm /></details>
      </PageHeader>
      <div className="player-grid">
        {players.map(player => (
          <article className="player-card" key={player.id}>
            <div className="avatar">{player.name[0]}</div>
            <div>
              <h2>{player.name}</h2>
              <p>#{player.number ?? "–"} · {player.positions.join(" / ") || "Ingen position"}</p>
              <Badge tone={player.status === "paused" ? "amber" : "green"}>{player.status === "paused" ? "BEGRÄNSAD" : "AKTIV"}</Badge>
              {(byPlayer.get(player.id) ?? []).map(goal => <p key={goal.id}><b>{goal.status === "active" ? "Pågående:" : "Plan:"}</b> {goal.title}</p>)}
              <details>
                <summary>Redigera</summary>
                <PlayerForm player={player} />
              </details>
              <div className="edit-form">
                <a className="button" href={`/api/export/player/${player.id}`}>Ladda ner spelarutdrag (JSON)</a>
                {player.status === "active" ? (
                  <form action={restrictPlayer}>
                    <input name="id" type="hidden" value={player.id} />
                    <button className="button">Begränsa behandling</button>
                  </form>
                ) : (
                  <form action={reactivatePlayer}>
                    <input name="id" type="hidden" value={player.id} />
                    <button className="button">Återaktivera</button>
                  </form>
                )}
                <details>
                  <summary className="delete-button">Permanent radering</summary>
                  <form action={removePlayer} className="edit-form">
                    <input name="id" type="hidden" value={player.id} />
                    <p>Raderar spelarprofil, närvaro, bedömningar, mål och spelaranknutna observationer. Åtgärden kan inte ångras i appen.</p>
                    <label>Skriv <b>{player.name}</b> för att bekräfta</label>
                    <input name="confirmation" required autoComplete="off" />
                    <button className="delete-button">Radera permanent</button>
                  </form>
                </details>
              </div>
              <details>
                <summary>+ Individuellt utvecklingsmål</summary>
                <form action={createGoalAction} className="edit-form">
                  <input name="playerId" type="hidden" value={player.id} />
                  <input name="title" placeholder="Tydligt, uppmuntrande mål" required />
                  <input name="startsOn" type="date" required />
                  <input name="endsOn" type="date" required />
                  <textarea name="description" placeholder="Vad tränar vi på och hur följer vi upp?" />
                  <select name="status" defaultValue="active"><option value="planned">Planerat</option><option value="active">Pågående</option><option value="completed">Klart</option></select>
                  <fieldset><legend>Färdigheter</legend>{skills.map(skill => <label key={skill.id}><input type="checkbox" name="skillIds" value={skill.id} /> {skill.name} </label>)}</fieldset>
                  <button className="button primary">Spara mål</button>
                </form>
              </details>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
