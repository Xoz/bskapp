import type { MetadataRoute } from "next";
import { getAllSettings } from "@/lib/db";

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const settings = await getAllSettings();
  return {
    name: `${settings.team_name || "BSK"} – Matchrapport`,
    short_name: settings.team_name || "BSK",
    description: `Liverapportering och spelarutveckling för ${settings.team_name || "BSK"}`,
    start_url: "/rapportera",
    display: "standalone",
    background_color: "#0e0f11",
    theme_color: settings.accent_color || "#ffd23f",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}
