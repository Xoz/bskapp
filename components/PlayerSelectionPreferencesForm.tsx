"use client";

import { useState } from "react";
import { isValidChallengeLevel, normalizeChallengeLevel } from "@/lib/playerLevelPreferences";

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
  primaryLabel = "Normal",
  secondaryLabel = "Utmaning",
  secondaryAllowed,
}: {
  title: string;
  choices: Choice[];
  primary: string;
  secondary: string;
  onPrimaryChange: (value: string) => void;
  onSecondaryChange: (value: string) => void;
  primaryLabel?: string;
  secondaryLabel?: string;
  secondaryAllowed?: (value: string) => boolean;
}) {
  return (
    <fieldset className="min-w-0">
      <legend className="mb-2 text-sm font-semibold">{title}</legend>
      <div className="grid grid-cols-[minmax(0,1fr)_2.5rem_2.5rem] items-center gap-x-2 gap-y-1">
        <span className="caption" style={{ color: "var(--ink-muted)" }}>Val</span>
        <span className="caption text-center" style={{ color: "var(--ink-muted)" }}>{primaryLabel}</span>
        <span className="caption text-center" style={{ color: "var(--ink-muted)" }}>{secondaryLabel}</span>
        {choices.map((choice) => {
          const primaryId = `${title}-${choice.value}-primary`;
          const secondaryId = `${title}-${choice.value}-secondary`;
          const secondaryDisabled = secondaryAllowed ? !secondaryAllowed(choice.value) : false;
          return (
            <div key={choice.value} className="contents">
              <span className="body-small py-1">{choice.label}</span>
              <label htmlFor={primaryId} className="flex justify-center cursor-pointer py-1">
                <input id={primaryId} type="checkbox" checked={primary === choice.value} onChange={() => onPrimaryChange(primary === choice.value ? "" : choice.value)} className="h-5 w-5 accent-[var(--primary)]" aria-label={`${choice.label}, förstaval`} />
              </label>
              <label htmlFor={secondaryId} className="flex justify-center cursor-pointer py-1">
                <input id={secondaryId} type="checkbox" checked={secondary === choice.value} disabled={secondaryDisabled} onChange={() => onSecondaryChange(secondary === choice.value ? "" : choice.value)} className="h-5 w-5 accent-[var(--primary)] disabled:cursor-not-allowed disabled:opacity-35" aria-label={`${choice.label}, andraval`} />
              </label>
            </div>
          );
        })}
      </div>
    </fieldset>
  );
}

function SingleChoiceRows({ title, choices, selected, onChange }: {
  title: string;
  choices: Choice[];
  selected: string;
  onChange: (value: string) => void;
}) {
  return (
    <fieldset className="min-w-0">
      <legend className="mb-2 text-sm font-semibold">{title}</legend>
      <div className="grid grid-cols-[minmax(0,1fr)_3.5rem] items-center gap-x-2 gap-y-1">
        <span className="caption" style={{ color: "var(--ink-muted)" }}>Position</span>
        <span className="caption text-center" style={{ color: "var(--ink-muted)" }}>Primär</span>
        {choices.map((choice) => (
          <div key={choice.value} className="contents">
            <span className="body-small py-1">{choice.label}</span>
            <label className="flex justify-center cursor-pointer py-1">
              <input type="checkbox" checked={selected === choice.value} onChange={() => onChange(selected === choice.value ? "" : choice.value)} className="h-5 w-5 accent-[var(--primary)]" aria-label={`${choice.label}, primär position`} />
            </label>
          </div>
        ))}
      </div>
    </fieldset>
  );
}

export default function PlayerSelectionPreferencesForm({ action, defaults }: Props) {
  const [positionPrimary, setPositionPrimary] = useState(defaults.positionPrimary);
  const [positionSecondary, setPositionSecondary] = useState(defaults.positionSecondary);
  const [levelPrimary, setLevelPrimary] = useState(defaults.levelPrimary);
  const [levelSecondary, setLevelSecondary] = useState(normalizeChallengeLevel(defaults.levelPrimary, defaults.levelSecondary));
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
      if (!isValidChallengeLevel(value, levelSecondary)) setLevelSecondary("");
    } else {
      setLevelSecondary(isValidChallengeLevel(levelPrimary, value) ? value : "");
    }
  };

  return (
    <form action={action} className="mt-4 space-y-3">
      <input type="hidden" name="preferred_position_primary" value={positionPrimary} />
      <input type="hidden" name="preferred_position_secondary" value={positionSecondary} />
      <input type="hidden" name="preferred_level_primary" value={levelPrimary} />
      <input type="hidden" name="preferred_level_secondary" value={levelSecondary} />
      <label className="flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2" style={{ background: selectionEligible ? "var(--primary-wash)" : "var(--elevated)" }}>
        <input name="selection_eligible" value="1" type="checkbox" checked={selectionEligible} onChange={(event) => setSelectionEligible(event.target.checked)} className="h-5 w-5 accent-[var(--primary)]" />
        <span className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <strong className="text-sm">Kan föreslås till match</strong>
          <span className="caption" style={{ color: "var(--ink-muted)" }}>Avmarkera tillfälligt vid frånvaro.</span>
        </span>
      </label>
      <div className="grid gap-5 rounded-xl border p-3 md:grid-cols-2 md:gap-8" style={{ borderColor: "var(--border)", background: "var(--elevated)" }}>
        <SingleChoiceRows title="Primär position" choices={POSITIONS.map((value) => ({ value, label: value }))} selected={positionPrimary} onChange={(value) => setPosition("primary", value)} />
        <PreferenceRows title="Tränarbedömd Sanktan-nivå" choices={LEVELS} primary={levelPrimary} secondary={levelSecondary} onPrimaryChange={(value) => setLevel("primary", value)} onSecondaryChange={(value) => setLevel("secondary", value)} secondaryAllowed={(value) => isValidChallengeLevel(levelPrimary, value)} />
      </div>
      <div className="flex justify-end"><button type="submit" className="btn-primary">Spara preferenser</button></div>
    </form>
  );
}
