import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./calm.css";
import { THEME_INIT_SCRIPT } from "@/lib/theme";
import { getAllSettings } from "@/lib/db";
import ServiceWorkerRegistration from "@/components/ServiceWorkerRegistration";

// Mobil först: viewport-fit=cover ger oss env(safe-area-inset-*) för notch och
// home-indikator. Temainit och temaväljaren håller statusradens färg i synk.
// Vi behåller användarens möjlighet att zooma (tillgänglighet).
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#F7F7F3",
  colorScheme: "light dark",
};

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getAllSettings();
  return {
    title: `${settings.team_name} – Spelarutveckling`,
    description: `Spelarutveckling och matchstatistik för ${settings.team_name}, ${settings.club_name}`,
    manifest: "/manifest.webmanifest",
    appleWebApp: {
      capable: true,
      title: settings.team_name || "BSK",
      statusBarStyle: "black-translucent",
    },
    icons: {
      icon: [
        { url: "/icon.svg", media: "(prefers-color-scheme: dark)" },
        { url: "/icon-light.svg", media: "(prefers-color-scheme: light)" },
      ],
      apple: "/icon.svg",
    },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const settings = await getAllSettings();
  return (
    <html lang="sv" className="h-full antialiased" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} /></head>
      <body
        className="min-h-full flex flex-col"
        style={
          {
            // Klubbfärgen bevaras separat; den får inte skriva över UI-temats kontrast.
            ...(settings.accent_color
              ? { "--club-primary": settings.accent_color }
              : {}),
            // Matchtröjefärger för spelaravatarerna
            "--jersey": settings.jersey_color || "#ffd23f",
            "--jersey-ink": settings.jersey_text_color || "#111111",
            "--gk-jersey": settings.gk_jersey_color || "#1f9d57",
            "--gk-jersey-ink": settings.gk_jersey_text_color || "#ffffff",
          } as React.CSSProperties
        }
      >
        <ServiceWorkerRegistration />
        {children}
      </body>
    </html>
  );
}
