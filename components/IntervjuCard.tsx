import { getCoachCategoryScores, findPlayerForIntervju, type PlayerInterview } from "@/lib/queries";

const CAT_LABELS: Record<string, string> = {
  anfall_boll: "Med boll",
  anfall_utan_boll: "Utan boll",
  forsvar: "Försvar",
  fysik: "Fysik",
  psykosocialt: "Psykosocialt",
};
const CAT_ORDER = ["anfall_boll", "anfall_utan_boll", "forsvar", "fysik", "psykosocialt"];

const LEVEL_LABEL: Record<number, string> = { 1: "Utforskar", 2: "Utvecklar", 3: "Befäster", 4: "Behärskar" };

function scoreColor(playerScore: number, coachScore: number | undefined) {
  if (coachScore == null) return "var(--ink-secondary)";
  const diff = playerScore - coachScore;
  if (Math.abs(diff) <= 0.5) return "var(--primary)"; // eniga
  if (diff > 0) return "#f59e0b"; // spelaren skattar sig högre
  return "#a78bfa"; // spelaren skattar sig lägre
}

function ScoreBar({ value }: { value: number }) {
  return (
    <div className="flex gap-0.5 mt-1">
      {[1, 2, 3, 4].map((v) => (
        <div
          key={v}
          className="h-1.5 flex-1 rounded-full"
          style={{ background: v <= value ? "var(--primary)" : "var(--elevated)" }}
        />
      ))}
    </div>
  );
}

async function ScoreComparison({ intervju }: { intervju: PlayerInterview }) {
  let playerScores: Record<string, number> = {};
  try { playerScores = JSON.parse(intervju.scores); } catch { /* tom */ }
  if (Object.keys(playerScores).length === 0) return null;

  // Försök hitta matchande spelare i truppen
  const player = await findPlayerForIntervju(intervju.player_name);
  const coachScores = player ? await getCoachCategoryScores(player.id) : null;

  return (
    <div className="mt-4">
      <p className="caption uppercase tracking-[0.1em] mb-3" style={{ color: "var(--ink-muted)", fontFamily: "var(--font-display)" }}>
        Egenbedömning {coachScores ? "vs tränarens senaste utvärdering" : "(ingen tränarutvärdering kopplad)"}
      </p>
      <div className="space-y-3">
        {CAT_ORDER.map((cat) => {
          const ps = playerScores[cat];
          const cs = coachScores?.[cat];
          if (ps == null) return null;
          const color = scoreColor(ps, cs);
          return (
            <div key={cat}>
              <div className="flex items-center justify-between mb-0.5">
                <span className="caption" style={{ color: "var(--ink-secondary)" }}>{CAT_LABELS[cat]}</span>
                <span className="caption" style={{ color }}>
                  {LEVEL_LABEL[ps] ?? ps}
                  {cs != null && (
                    <span style={{ color: "var(--ink-muted)" }}>
                      {" "}· Tränare: {cs.toFixed(1)}
                    </span>
                  )}
                </span>
              </div>
              <ScoreBar value={ps} />
              {cs != null && Math.abs(ps - cs) >= 1 && (
                <p className="caption mt-1" style={{ color: "var(--ink-muted)" }}>
                  {ps > cs ? "Spelaren skattar sig högre än tränaren" : "Spelaren skattar sig lägre än tränaren"} — bra att diskutera
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("sv-SE", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function Transcript({ messages }: { messages: string }) {
  let parsed: { role: string; content: string }[] = [];
  try { parsed = JSON.parse(messages); } catch { return null; }
  return (
    <div className="mt-4 flex flex-col gap-2">
      {parsed.map((m, i) => (
        <div key={i} className={`flex flex-col max-w-[90%] ${m.role === "assistant" ? "self-start" : "self-end"}`}>
          <p
            className="caption px-3 py-2 leading-relaxed"
            style={
              m.role === "assistant"
                ? { background: "var(--elevated)", border: "1px solid var(--border)", borderRadius: "10px 10px 10px 3px", color: "var(--ink-secondary)" }
                : { background: "color-mix(in srgb, var(--primary) 12%, transparent)", border: "1px solid color-mix(in srgb, var(--primary) 25%, transparent)", borderRadius: "10px 10px 3px 10px", color: "var(--ink)" }
            }
          >
            {m.content}
          </p>
        </div>
      ))}
    </div>
  );
}

// Delat intervjukort – används både i samlade listan (/spelare/intervjuer) och
// på den enskilda spelarprofilen. När `showName` är false döljs namnchippet
// (på profilen vet man redan vems samtal det är).
export default async function IntervjuCard({ intervju, showName = true }: { intervju: PlayerInterview; showName?: boolean }) {
  const isKvartal = intervju.interview_type === "kvartal";
  return (
    <details className="rounded-2xl overflow-hidden" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
      <summary className="flex items-center gap-4 px-5 py-4 cursor-pointer select-none" style={{ listStyle: "none" }}>
        {showName && (
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold"
            style={{ background: "color-mix(in srgb, var(--primary) 15%, transparent)", border: "1.5px solid var(--primary)", color: "var(--primary)", fontFamily: "var(--font-display)" }}
          >
            {intervju.player_name[0]?.toUpperCase()}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {showName && <p className="font-semibold text-sm" style={{ color: "var(--ink)" }}>{intervju.player_name}</p>}
            <span
              className="caption px-1.5 py-0.5 rounded-full font-semibold uppercase tracking-wide"
              style={{
                background: isKvartal ? "color-mix(in srgb, #a78bfa 15%, transparent)" : "color-mix(in srgb, var(--primary) 12%, transparent)",
                color: isKvartal ? "#a78bfa" : "var(--primary)",
              }}
            >
              {isKvartal ? "Kvartal" : "Spelarsamtal"}
            </span>
          </div>
          <p className="caption mt-0.5" style={{ color: "var(--ink-muted)" }}>
            {intervju.position} · {formatDate(intervju.created_at)}
          </p>
        </div>
        <span className="caption shrink-0" style={{ color: "var(--ink-muted)" }}>▾</span>
      </summary>

      <div className="px-5 pb-5" style={{ borderTop: "1px solid var(--border)" }}>
        {/* Sammanfattning */}
        <div className="mt-4">
          <p className="caption uppercase tracking-[0.1em] mb-2" style={{ color: "var(--ink-muted)", fontFamily: "var(--font-display)" }}>
            {isKvartal ? "AI-summering" : "Sammanfattning"}
          </p>
          <p className="body-small leading-relaxed" style={{ color: "var(--ink-secondary)" }}>{intervju.summary}</p>
        </div>

        {/* Kvartal: poängjämförelse */}
        {isKvartal && <ScoreComparison intervju={intervju} />}

        {/* Transkript */}
        <details className="mt-4">
          <summary className="caption cursor-pointer" style={{ color: "var(--primary)", fontFamily: "var(--font-display)" }}>
            Visa hela intervjun ▾
          </summary>
          <Transcript messages={intervju.messages} />
        </details>
      </div>
    </details>
  );
}
