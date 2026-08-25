export const SANKTAN_PLAYER_LEVELS = ["2", "3", "4"] as const;

export function isSanktanPlayerLevel(value: string): boolean {
  return SANKTAN_PLAYER_LEVELS.some((level) => level === value);
}

// Svenska Lags lägre serienummer är svårare. En utmaningsnivå måste därför
// ha ett lägre nummer än spelarens normalnivå.
export function isValidChallengeLevel(primary: string, challenge: string): boolean {
  if (challenge === "") return true;
  return isSanktanPlayerLevel(primary)
    && isSanktanPlayerLevel(challenge)
    && Number(challenge) < Number(primary);
}

export function normalizeChallengeLevel(primary: string, challenge: string): string {
  return isValidChallengeLevel(primary, challenge) ? challenge : "";
}
