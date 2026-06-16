import type { Metadata, Viewport } from "next";
import { Syne, DM_Mono } from "next/font/google";
import "./globals.css";
import { getAllSettings } from "@/lib/db";
import ServiceWorkerRegistration from "@/components/ServiceWorkerRegistration";

// Mobil först: viewport-fit=cover ger oss env(safe-area-inset-*) för notch och
// home-indikator. Mörk theme-color så statusbaren smälter ihop med nav-baren.
// Vi behåller användarens möjlighet att zooma (tillgänglighet).
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0a0b0d",
  colorScheme: "dark light",
};

// Designsystem "Dark Mono Dashboard": Syne för display, DM Mono för allt annat
const display = Syne({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
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
    <html lang="sv" className={`${display.variable} ${mono.variable} h-full antialiased`} suppressHydrationWarning>
      <script dangerouslySetInnerHTML={{ __html: `try{var t=localStorage.getItem('bsk_theme');if(t==='light')document.documentElement.dataset.theme='light';}catch(e){}` }} />
      <body
        className="min-h-full flex flex-col"
        style={
          {
            // Klubbens accentfärg vinner över temats default-accent (sätts bara om
            // den finns – annars styr CSS: amber i mörkt, djupare amber i ljust läge).
            ...(settings.accent_color
              ? { "--primary": settings.accent_color, "--accent": settings.accent_color }
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
