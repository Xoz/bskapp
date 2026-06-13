import type { Metadata } from "next";
import { Syne, DM_Mono } from "next/font/google";
import "./globals.css";
import { getAllSettings } from "@/lib/db";

// Designsystem "Dark Mono Dashboard": Syne för display, DM Mono för allt annat
const display = Syne({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const mono = DM_Mono({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["300", "400", "500"],
});

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getAllSettings();
  return {
    title: `${settings.team_name} – Spelarutveckling`,
    description: `Spelarutveckling och matchstatistik för ${settings.team_name}, ${settings.club_name}`,
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const settings = await getAllSettings();
  return (
    <html lang="sv" className={`${display.variable} ${mono.variable} h-full antialiased`}>
      <body
        className="min-h-full flex flex-col"
        style={
          {
            // Klubbens accentfärg driver hela accentskalan på det mörka temat
            "--primary": settings.accent_color || "#f59e0b",
            "--accent": settings.accent_color || "#f59e0b",
            // Matchtröjefärger för spelaravatarerna
            "--jersey": settings.jersey_color || "#ffd23f",
            "--jersey-ink": settings.jersey_text_color || "#111111",
            "--gk-jersey": settings.gk_jersey_color || "#1f9d57",
            "--gk-jersey-ink": settings.gk_jersey_text_color || "#ffffff",
          } as React.CSSProperties
        }
      >
        {children}
      </body>
    </html>
  );
}
