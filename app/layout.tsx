import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { getAllSettings } from "@/lib/db";

const geistSans = Geist({
  variable: "--font-geist-sans",
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
    <html lang="sv" className={`${geistSans.variable} h-full antialiased`}>
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
