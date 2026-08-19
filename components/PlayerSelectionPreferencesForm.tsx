"use client";

import { useState } from "react";

const POSITIONS = ["Målvakt", "Back", "Mittfält", "Vänsterkant", "Högerkant", "Anfall"];
const LEVELS = [
  { value: "2", label: "Svår" },
  { value: "3", label: "Medel" },
  { value: "4", label: "Lätt" },
];

type Props = {
  action: (formData: FormData) => void | Promise<void>;
  defaults: {
    positionPrimary: string;
    positionSecondary: string;
    levelPrimary: string;
    levelSecondary: string;
    selectionEligible: boolean;
  };
};

type Choice = { value: string; label: string };

function PreferenceRows({
  title,
  choices,
  primary,
  secondary,
  onPrimaryChange,
  onSecondaryChange,
}: {
  title: string;
  choices: Choice[];
  primary: string;
  secondary: string;
  onPrimaryChange: (value: string) => void;
  onSecondaryChange: (value: string) => void;
}) {
  return (
    <fieldset className="rounded-xl border p-4" style={{ borderColor: "var(--border)", background: "var(--elevated)" }}>
      <legend className="px-1 font-semibold">{title}</legend>
      <div className="grid grid-cols-[1fr_auto_auto] items-center gap-x-5 gap-y-3 mt-2">
        <span className="caption" style={{ color: "var(--ink-muted)" }}>Val</span>
        <span className="caption text-center" style={{ color: "var(--ink-muted)" }}>Första</span>
        <span className="caption text-center" style={{ color: "var(--ink-muted)" }}>Andra</span>
        {choices.map((choice) => {
          const primaryId = `${title}-${choice.value}-primary`;
          const secondaryId = `${title}-${choice.value}-secondary`;
          return (
            <div key={choice.value} className="contents">
              <span className="body-small">{choice.label}</span>
              <label htmlFor={primaryId} className="flex justify-center cursor-pointer">
                <input id={primaryId} type="checkbox" checked={primary === choice.value} onChange={() => onPrimaryChange(primary === choice.value ? "" : choice.value)} className="h-5 w-5 accent-[var(--primary)]" aria-label={`${choice.label}, förstaval`} />
              </label>
              <label htmlFor={secondaryId} className="flex justify-center cursor-pointer">
                <input id={secondaryId} type="checkbox" checked={secondary === choice.value} onChange={() => onSecondaryChange(secondary === choice.value ? "" : choice.value)} className="h-5 w-5 accent-[var(--primary)]" aria-label={`${choice.label}, andraval`} />
              </label>
            </div>
          );
        })}
      </div>
    </fieldset>
  );
}

export default function PlayerSelectionPreferencesForm({ action, defaults }: Props) {
  const [positionPrimary, setPositionPrimary] = useState(defaults.positionPrimary);
  const [positionSecondary, setPositionSecondary] = useState(defaults.positionSecondary);
  const [levelPrimary, setLevelPrimary] = useState(defaults.levelPrimary);
  const [levelSecondary, setLevelSecondary] = useState(defaults.levelSecondary);
  const [selectionEligible, setSelectionEligible] = useState(defaults.selectionEligible);

  const setPosition = (choice: "primary" | "secondary", value: string) => {
    if (choice === "primary") {
      setPositionPrimary(value);
      if (value && value === positionSecondary) setPositionSecondary("");
    } else {
      setPositionSecondary(value);
      if (value && value === positionPrimary) setPositionPrimary("");
    }
  };
  const setLevel = (choice: "primary" | "secondary", value: string) => {
    if (choice === "primary") {
      setLevelPrimary(value);
      if (value && value === levelSecondary) setLevelSecondary("");
    } else {
      setLevelSecondary(value);
      if (value && value === levelPrimary) setLevelPrimary("");
    }
  };

  return (
    <form action={action} className="mt-4 space-y-4">
      <input type="hidden" name="preferred_position_primary" value={positionPrimary} />
      <input type="hidden" name="preferred_position_secondary" value={positionSecondary} />
      <input type="hidden" name="preferred_level_primary" value={levelPrimary} />
      <input type="hidden" name="preferred_level_secondary" value={levelSecondary} />
      <label className="flex cursor-pointer items-center gap-3 rounded-xl border p-4" style={{ borderColor: selectionEligible ? "var(--primary-line)" : "var(--border)", background: selectionEligible ? "var(--primary-wash)" : "var(--elevated)" }}>
        <input name="selection_eligible" value="1" type="checkbox" checked={selectionEligible} onChange={(event) => setSelectionEligible(event.target.checked)} className="h-5 w-5 accent-[var(--primary)]" />
        <span>
          <strong className="block text-sm">Kan föreslås till match</strong>
          <span className="caption" style={{ color: "var(--ink-muted)" }}>Avmarkera tillfälligt när spelaren inte ska ingå i automatiska förslag.</span>
        </span>
      </label>
      <PreferenceRows title="Position" choices={POSITIONS.map((value) => ({ value, label: value }))} primary={positionPrimary} secondary={positionSecondary} onPrimaryChange={(value) => setPosition("primary", value)} onSecondaryChange={(value) => setPosition("secondary", value)} />
      <PreferenceRows title="Sanktan-nivå" choices={LEVELS} primary={levelPrimary} secondary={levelSecondary} onPrimaryChange={(value) => setLevel("primary", value)} onSecondaryChange={(value) => setLevel("secondary", value)} />
      <div className="flex justify-end"><button type="submit" className="btn-primary">Spara preferenser</button></div>
    </form>
  );
}
