import Link from "next/link";
import { redirect } from "next/navigation";
import { getRole, getPlayerSession } from "@/lib/auth";
import { getAllSettings } from "@/lib/db";
import { getMatches, mootMatchIds } from "@/lib/queries";
import { swedishToday, swedishMinutesSinceMidnight } from "@/lib/dates";
import { FEATURES } from "@/lib/features";
import PitchLines from "@/components/PitchLines";
import { Logo90Mark } from "@/components/Logo90";
import { IconWhistle, IconPlayers, IconArrowRight } from "@/components/Icons";

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

  const clubInitial = (settings.club_name || "B").trim().charAt(0).toUpperCase();

  return (
    <main
      className="flex-1 flex flex-col items-center justify-center px-5 relative overflow-hidden"
      style={{
        background: "var(--bg)",
        minHeight: "100svh",
        paddingTop: "max(1.5rem, env(safe-area-inset-top))",
        paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))",
        paddingLeft: "max(1.25rem, env(safe-area-inset-left))",
        paddingRight: "max(1.25rem, env(safe-area-inset-right))",
      }}
    >
      <PitchLines className="pointer-events-none absolute -left-32 top-1/2 -translate-y-1/2 h-[140%] text-white/[0.025]" />
      <PitchLines className="pointer-events-none absolute -right-40 -bottom-36 h-[110%] rotate-12 text-white/[0.018]" />

      <div className="w-full relative rise" style={{ maxWidth: "360px" }}>
        {/* Header: logga + klubbinitial */}
        <header className="flex items-center justify-between">
          <span className="inline-flex items-center" style={{ gap: "9px" }}>
            <Logo90Mark size={26} />
            <span
              className="font-extrabold"
              style={{ fontFamily: "var(--font-display)", fontSize: "22px", letterSpacing: "-0.02em", lineHeight: 1 }}
            >
              <span style={{ color: "var(--primary)" }}>+</span>
              <span style={{ color: "var(--ink)" }}>90</span>
            </span>
          </span>
          <span
            className="flex items-center justify-center rounded-full"
            style={{
              width: "34px",
              height: "34px",
              border: "1px solid var(--border)",
              fontFamily: "var(--font-display)",
              fontWeight: 700,
              fontSize: "14px",
              color: "var(--ink-secondary)",
            }}
          >
            {clubInitial}
          </span>
        </header>

        <p className="mt-3.5 caption uppercase" style={{ letterSpacing: "0.16em", color: "var(--ink-muted)" }}>
          Spelarutveckling · minut för minut
        </p>

        {/* Klubbidentitet */}
        <div className="mt-4">
          <h1
            className="font-extrabold leading-none"
            style={{ fontFamily: "var(--font-display)", fontSize: "clamp(30px, 11vw, 42px)", letterSpacing: "-0.02em", color: "var(--ink)" }}
          >
            {settings.team_name}
          </h1>
          <p className="mt-2 body-small" style={{ color: "var(--ink-secondary)" }}>
            {settings.club_name}
          </p>
        </div>

        {/* HERO – Livescore, publik (dold när liveScore-flaggan är av) */}
        {FEATURES.liveScore && (
        <Link
          href="/live"
          className="relative block overflow-hidden"
          style={{
            marginTop: "20px",
            borderRadius: "24px",
            padding: "22px",
            minHeight: "240px",
            color: "var(--ink)",
            background: "var(--primary-wash)",
            border: "1.5px solid var(--primary-line)",
          }}
        >
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                "radial-gradient(120% 78% at 86% 4%, color-mix(in srgb, var(--primary) 26%, transparent), transparent 60%)",
            }}
          />
          {liveCount > 0 && (
            <div className="relative flex items-center gap-2">
              <span className="relative inline-flex" style={{ width: "8px", height: "8px" }}>
                <span className="absolute inset-0 rounded-full" style={{ background: "var(--live)" }} />
                <span
                  className="absolute rounded-full"
                  style={{ inset: "-3px", border: "1px solid var(--live)", animation: "ring90 1.8s ease-out infinite" }}
                />
              </span>
              <span className="caption uppercase" style={{ letterSpacing: "0.16em", color: "var(--live)" }}>
                Live nu · {liveCount} {liveCount === 1 ? "match" : "matcher"}
              </span>
            </div>
          )}
          <div className="relative" style={{ marginTop: liveCount > 0 ? "50px" : "64px" }}>
            <div className="caption uppercase" style={{ letterSpacing: "0.18em", color: "var(--ink-secondary)" }}>
              Publik · ingen inloggning
            </div>
            <div
              className="font-extrabold"
              style={{ fontFamily: "var(--font-display)", fontSize: "clamp(26px, 9.4vw, 38px)", lineHeight: 0.95, letterSpacing: "-0.03em", marginTop: "8px" }}
            >
              Livescore
            </div>
            <div className="mt-2.5 text-[0.78rem]" style={{ color: "var(--ink-secondary)", maxWidth: "190px", lineHeight: 1.5 }}>
              Följ alla lagets matcher i realtid.
            </div>
          </div>
          <span
            className="absolute flex items-center justify-center rounded-full"
            style={{
              right: "18px",
              bottom: "18px",
              width: "54px",
              height: "54px",
              background: "color-mix(in srgb, var(--primary) 16%, var(--surface))",
              border: "1.5px solid var(--primary)",
              color: "var(--primary)",
            }}
          >
            <IconArrowRight width={20} height={20} />
          </span>
        </Link>
        )}

        {/* Rollkort – sekundära */}
        <div className="flex gap-3" style={{ marginTop: "13px" }}>
          <Link
            href="/login"
            className="group flex flex-1 flex-col"
            style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "18px", padding: "15px", minHeight: "98px", color: "var(--ink)" }}
          >
            <div className="flex items-center justify-between">
              <span style={{ color: "var(--primary)" }}>
                <IconWhistle width={18} height={18} />
              </span>
              <IconArrowRight
                width={13}
                height={13}
                className="transition-transform group-hover:translate-x-0.5"
                style={{ color: "var(--ink-muted)" }}
              />
            </div>
            <span className="mt-auto font-bold" style={{ fontFamily: "var(--font-display)", fontSize: "19px", color: "var(--ink)" }}>
              Tränare
            </span>
            <span className="caption" style={{ color: "var(--ink-secondary)", marginTop: "3px" }}>
              Trupp, utvärderingar &amp; statistik
            </span>
          </Link>

          <Link
            href="/spelare/login"
            className="group flex flex-1 flex-col"
            style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "18px", padding: "15px", minHeight: "98px", color: "var(--ink)" }}
          >
            <div className="flex items-center justify-between">
              <span style={{ color: "var(--primary)" }}>
                <IconPlayers width={18} height={18} />
              </span>
              <IconArrowRight
                width={13}
                height={13}
                className="transition-transform group-hover:translate-x-0.5"
                style={{ color: "var(--ink-muted)" }}
              />
            </div>
            <span className="mt-auto font-bold" style={{ fontFamily: "var(--font-display)", fontSize: "19px", color: "var(--ink)" }}>
              Spelare
            </span>
            <span className="caption" style={{ color: "var(--ink-secondary)", marginTop: "3px" }}>
              Berätta om din säsong
            </span>
          </Link>
        </div>

        {/* Footer */}
        <div
          className="text-center caption"
          style={{ marginTop: "18px", paddingTop: "14px", borderTop: "1px solid var(--border)", letterSpacing: "0.07em", color: "var(--ink-muted)" }}
        >
          Enligt SvFF:s riktlinjer för barnfotboll
        </div>
      </div>
    </main>
  );
}
