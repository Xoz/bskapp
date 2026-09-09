import type { MetadataRoute } from "next";
import { getAllSettings } from "@/lib/db";

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const settings = await getAllSettings();
  return {
    name: `Bollstanäs SK – ${settings.team_name || "F2014"}`,
    short_name: "BSK",
    description: `Spelarutveckling och matchstatistik för ${settings.team_name || "BSK"}`,
    start_url: "/",
    display: "standalone",
    background_color: "#F7F7F3",
    theme_color: "#F7F7F3",
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
