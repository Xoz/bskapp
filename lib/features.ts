/**
 * Funktioner som kan slås av/på i appen utan att radera kod.
 *
 * När en flagga är `false` döljs funktionen i UI:et, men all kod,
 * alla routes och all logik finns kvar – sätt tillbaka till `true`
 * för att återaktivera.
 */
export const FEATURES = {
  /**
   * Individuell matchstatistik: pass, skott, mål, assist etc. per spelare.
   * Döljer: statistiksidan, matchflöde, rätta statistik, lägg till händelse,
   * spelarens matchstatistik-tabell, STAT_FIELDS-tabeller.
   * Matchhanteringen (laguttagning, registrera, resultat, betyg) finns kvar.
   */
  matchStats: false,
  /** Livescore: publik livescore-landning, live-CTA, liverapportering, föräldrarapportering */
  liveScore: false,
} as const;

export type FeatureFlags = typeof FEATURES;
