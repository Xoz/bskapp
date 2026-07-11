import type { Metadata } from "next";
import { AppShell } from "@/components/AppShell";
import "./globals.css";

export const metadata: Metadata = { title: "Planlinjen", description: "Planering och spelarutveckling för ungdomsfotboll" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="sv"><body><AppShell>{children}</AppShell></body></html>;
}
