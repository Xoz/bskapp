import type { MetadataRoute } from "next";
import { getAllSettings } from "@/lib/db";

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const settings = await getAllSettings();
  return {
    name: `+90 – ${settings.team_name || "BSK"}`,
    short_name: "+90",
    description: `Spelarutveckling och matchstatistik för ${settings.team_name || "BSK"}`,
    start_url: "/",
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
