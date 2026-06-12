import type { Metadata } from "next";
import { Space_Grotesk, Inter } from "next/font/google";
import "./globals.css";
import { getAllSettings } from "@/lib/db";

const display = Space_Grotesk({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const body = Inter({
  variable: "--font-body",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const settings = getAllSettings();
  return {
    title: `${settings.team_name} – Spelarutveckling`,
    description: `Spelarutveckling och matchstatistik för ${settings.team_name}, ${settings.club_name}`,
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const settings = getAllSettings();
  return (
    <html lang="sv" className={`${display.variable} ${body.variable} h-full antialiased`}>
      <body
        className="min-h-full flex flex-col"
        style={
          {
            "--primary": settings.primary_color || "#13306e",
            "--accent": settings.accent_color || "#ffd23f",
          } as React.CSSProperties
        }
      >
        {children}
      </body>
    </html>
  );
}
