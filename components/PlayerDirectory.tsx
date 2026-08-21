"use client";

import Link from "next/link";
import { useDeferredValue, useMemo, useState } from "react";
import Avatar from "@/components/Avatar";
import { sanktanLevelLabel } from "@/lib/sanktanLevel";

export type PlayerDirectoryItem = {
  id: number;
  name: string;
  jersey: number | null;
  teams: { id: number; name: string }[];
  goals: string[];
  matchCount: number;
  callupCount: number;
  positionPrimary: string;
  positionSecondary: string;
  levelPrimary: string;
  levelSecondary: string;
};

const TEAM_TONES: Record<string, "yellow" | "green" | "blue"> = { Gul: "yellow", Grön: "green", F15: "blue" };

function preferenceSummary(player: PlayerDirectoryItem) {
  const normalLevel = sanktanLevelLabel(Number(player.levelPrimary));
  const challengeLevel = sanktanLevelLabel(Number(player.levelSecondary));
  if (!player.positionPrimary && !normalLevel) return "Tränarbedömning saknas";
  return [
    player.positionPrimary && `Position: ${player.positionPrimary}`,
    normalLevel && `Normal nivå: ${normalLevel}`,
    challengeLevel && `Utmaning: ${challengeLevel}`,
  ].filter(Boolean).join(" · ");
}

export default function PlayerDirectory({ players }: { players: PlayerDirectoryItem[] }) {
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query.trim().toLocaleLowerCase("sv"));
  const visiblePlayers = useMemo(() => {
    if (!deferredQuery) return players;
    return players.filter((player) => [
      player.name,
      ...player.teams.map((team) => team.name),
      player.positionPrimary,
      player.positionSecondary,
      sanktanLevelLabel(Number(player.levelPrimary)),
      sanktanLevelLabel(Number(player.levelSecondary)),
    ].join(" ").toLocaleLowerCase("sv").includes(deferredQuery));
  }, [deferredQuery, players]);

  return (
    <>
      <div className="player-directory-toolbar">
        <label className="player-directory-search">
          <span>Sök spelare</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Namn, position eller nivå"
            autoComplete="off"
          />
        </label>
        <span className="player-directory-count">{visiblePlayers.length} visas</span>
      </div>

      {visiblePlayers.length > 0 ? (
        <div className="player-directory-list">
          {visiblePlayers.map((player) => (
            <Link key={player.id} href={`/spelare/${player.id}`} className="player-directory-row">
              <Avatar name={player.name} jersey={player.jersey} size={38} />
              <div className="player-directory-main">
                <div className="player-directory-name-row">
                  <h2>{player.name}</h2>
                  <span className="player-directory-teams">
                    {player.teams.length > 0
                      ? player.teams.map((team) => <span key={team.id} className="core-team-tag" data-team-tone={TEAM_TONES[team.name]}>{team.name}</span>)
                      : <span className="core-team-tag core-team-tag-unassigned">Ej tilldelat</span>}
                  </span>
                </div>
                <p className="player-directory-preferences">{preferenceSummary(player)}</p>
                <p className={`player-directory-goal ${player.goals.length === 0 ? "player-directory-goal-empty" : ""}`}>
                  {player.goals.length > 0 ? player.goals.join(" · ") : "Inget aktivt utvecklingsmål"}
                </p>
              </div>
              <div className="player-directory-stats">
                <span><strong>{player.matchCount}</strong> {player.matchCount === 1 ? "match" : "matcher"}</span>
                <span><strong>{player.callupCount}</strong> {player.callupCount === 1 ? "kallelse" : "kallelser"}</span>
              </div>
              <span className="core-chevron" aria-hidden>›</span>
            </Link>
          ))}
        </div>
      ) : (
        <div className="core-panel core-form-panel player-directory-empty">
          <strong>Ingen spelare matchar sökningen</strong>
          <button type="button" className="btn-secondary btn-sm" onClick={() => setQuery("")}>Rensa sökning</button>
        </div>
      )}
    </>
  );
}
