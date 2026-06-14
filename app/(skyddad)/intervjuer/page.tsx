import { getIntervjuer, type PlayerInterview } from "@/lib/queries";

export const dynamic = "force-dynamic";
export const metadata = { title: "Spelarintervjuer" };

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("sv-SE", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function Transcript({ messages }: { messages: string }) {
  let parsed: { role: string; content: string }[] = [];
  try {
    parsed = JSON.parse(messages);
  } catch {
    return null;
  }
  return (
    <div className="mt-4 flex flex-col gap-2">
      {parsed.map((m, i) => (
        <div
          key={i}
          className={`flex flex-col max-w-[90%] ${m.role === "assistant" ? "self-start" : "self-end"}`}
        >
          <p
            className="text-xs px-3 py-2 leading-relaxed"
            style={
              m.role === "assistant"
                ? {
                    background: "var(--bg3)",
                    border: "1px solid var(--line)",
                    borderRadius: "10px 10px 10px 3px",
                    color: "var(--ink-soft)",
                  }
                : {
                    background: "color-mix(in srgb, var(--primary) 15%, transparent)",
                    border: "1px solid color-mix(in srgb, var(--primary) 30%, transparent)",
                    borderRadius: "10px 10px 3px 10px",
                    color: "var(--ink)",
                  }
            }
          >
            {m.content}
          </p>
        </div>
      ))}
    </div>
  );
}

function IntervjuCard({ intervju }: { intervju: PlayerInterview }) {
  return (
    <details
      className="rounded-2xl overflow-hidden"
      style={{ background: "var(--bg2)", border: "1px solid var(--line)" }}
    >
      <summary
        className="flex items-center gap-4 px-5 py-4 cursor-pointer select-none"
        style={{ listStyle: "none" }}
      >
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold"
          style={{
            background: "color-mix(in srgb, var(--primary) 15%, transparent)",
            border: "1.5px solid var(--primary)",
            color: "var(--primary)",
            fontFamily: "var(--font-display)",
          }}
        >
          {intervju.player_name[0]?.toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-sm" style={{ color: "var(--ink)" }}>
            {intervju.player_name}
          </p>
          <p className="text-[0.7rem] mt-0.5" style={{ color: "var(--ink-faint)" }}>
            {intervju.position} · {formatDate(intervju.created_at)}
          </p>
        </div>
        <span
          className="text-[0.65rem] shrink-0 details-arrow"
          style={{ color: "var(--ink-faint)", transition: "transform 0.2s" }}
        >
          ▾
        </span>
      </summary>

      <div
        className="px-5 pb-5"
        style={{ borderTop: "1px solid var(--line)" }}
      >
        {/* AI-sammanfattning */}
        <div className="mt-4">
          <p
            className="text-[0.6rem] uppercase tracking-[0.1em] mb-2"
            style={{ color: "var(--ink-faint)", fontFamily: "var(--font-display)" }}
          >
            Sammanfattning
          </p>
          <p className="text-sm leading-relaxed" style={{ color: "var(--ink-soft)" }}>
            {intervju.summary}
          </p>
        </div>

        {/* Full transkript */}
        <details className="mt-4">
          <summary
            className="text-[0.7rem] cursor-pointer"
            style={{ color: "var(--primary)", fontFamily: "var(--font-display)" }}
          >
            Visa hela intervjun ▾
          </summary>
          <Transcript messages={intervju.messages} />
        </details>
      </div>
    </details>
  );
}

export default async function IntervjuerPage() {
  const intervjuer = await getIntervjuer();

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1
          className="text-2xl font-bold tracking-tight"
          style={{ fontFamily: "var(--font-display)", color: "var(--ink)" }}
        >
          Spelarintervjuer
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--ink-faint)" }}>
          {intervjuer.length === 0
            ? "Inga intervjuer än – dela /intervju-länken med spelarna."
            : `${intervjuer.length} intervju${intervjuer.length === 1 ? "" : "er"}`}
        </p>
      </div>

      {intervjuer.length === 0 ? (
        <div
          className="rounded-2xl flex flex-col items-center gap-3 py-14 text-center"
          style={{ background: "var(--bg2)", border: "1px solid var(--line)" }}
        >
          <span className="text-4xl">💬</span>
          <p className="text-sm" style={{ color: "var(--ink-faint)" }}>
            Spelarna når intervjun via landningssidan eller direkt på<br />
            <span style={{ color: "var(--primary)", fontFamily: "var(--font-display)" }}>
              /intervju
            </span>
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {intervjuer.map((iv) => (
            <IntervjuCard key={iv.id} intervju={iv} />
          ))}
        </div>
      )}
    </div>
  );
}
