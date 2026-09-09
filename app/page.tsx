import Link from "next/link";
import { redirect } from "next/navigation";
import { getRole, getPlayerSession } from "@/lib/auth";
import { getAllSettings } from "@/lib/db";
import { getMatches, mootMatchIds } from "@/lib/queries";
import { swedishToday, swedishMinutesSinceMidnight } from "@/lib/dates";
import { FEATURES } from "@/lib/features";
import BrandLockup from "@/components/BrandLockup";
import { IconWhistle, IconPlayers, IconArrowRight, IconPitch } from "@/components/Icons";

export const dynamic = "force-dynamic";

export default async function LandingPage() {
  const [role, playerId] = await Promise.all([getRole(), getPlayerSession()]);
  if (role === "coach") redirect("/idag");
  if (role === "parent" || role === "player") redirect("/mina-spelare");
  if (playerId) redirect("/min-profil");

  const [settings, allMatches] = await Promise.all([getAllSettings(), getMatches()]);

  // "Live nu": matcher idag som startat men inte är klara (samma logik som /live).
  // feature-flag: liveScore — koden finns kvar men körs bara när flaggan är på.
  const today = swedishToday();
  const nowMinutes = swedishMinutesSinceMidnight();
  const moot = mootMatchIds(allMatches);
  const liveCount = FEATURES.liveScore
    ? allMatches.filter((m) => {
        if (m.date !== today || moot.has(m.id)) return false;
        if (m.our_score != null && m.opponent_score != null) return false;
        if (!m.start_time) return false;
        const [h, min] = m.start_time.split(":").map(Number);
        const start = h * 60 + min;
        return nowMinutes >= start && nowMinutes < start + 120;
      }).length
    : 0;

  return (
    <main className="flex-1 flex items-center justify-center px-5 py-10" style={{ minHeight: "100svh", paddingTop: "max(2.5rem, env(safe-area-inset-top))", paddingBottom: "max(2.5rem, env(safe-area-inset-bottom))" }}>
      <div className="bsk-landing">
        <BrandLockup team={settings.team_name} club={settings.club_name} />
        <div><h1>En gemensam plats för laget.</h1><p className="core-lead">Matcher, spelarutveckling och samtal för {settings.team_name}.</p></div>
        <div className="bsk-landing-links">
          <Link href="/login" className="core-panel"><IconWhistle width={24} height={24} /><span><strong>Tränare och ledare</strong><small>Planera, följ upp och utveckla laget</small></span><IconArrowRight width={20} height={20} /></Link>
          <Link href="/spelare/login" className="core-panel"><IconPlayers width={24} height={24} /><span><strong>Spelare</strong><small>Din utveckling och nästa steg</small></span><IconArrowRight width={20} height={20} /></Link>
          {FEATURES.liveScore && <Link href="/live" className="core-panel"><IconPitch width={24} height={24} /><span><strong>Livescore{liveCount > 0 ? ` · ${liveCount} live` : ""}</strong><small>Följ lagets matcher utan inloggning</small></span><IconArrowRight width={20} height={20} /></Link>}
        </div>
        <p className="text-sm text-center" style={{ color: "var(--ink-secondary)" }}>{settings.club_name || "Bollstanäs SK"}</p>
      </div>
    </main>
  );
}
