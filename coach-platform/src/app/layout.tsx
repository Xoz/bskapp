import type { Metadata } from "next";
import { AppShell } from "@/components/AppShell";
import { requireCoachIdentity } from "@/lib/coach-session";
import "./globals.css";

export const metadata: Metadata = { title: "Planlinjen", description: "Planering och spelarutveckling för ungdomsfotboll" };

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const coach = await requireCoachIdentity();
  return <html lang="sv"><body><AppShell coachName={coach.name}>{children}</AppShell></body></html>;
}
