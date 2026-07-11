/**
 * Funktioner som kan slås av/på i appen utan att radera kod.
 *
 * När en flagga är `false` döljs funktionen i UI:et, men all kod,
 * alla routes och all logik finns kvar – sätt tillbaka till `true`
 * för att återaktivera.
 */
export const FEATURES = {
  /** Matchstatistik: matchflöde, "rätta statistik", spelarmatchstatistik, statistiksidan */
  matchStats: false,
  /** Livescore: publik livescore-landning, live-CTA, liverapportering, föräldrarapportering */
  liveScore: false,
} as const;

export type FeatureFlags = typeof FEATURES;
