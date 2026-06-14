"use client";

import { useState, useRef, useEffect, useCallback } from "react";

const POSITIONS = [
  { label: "🧤 Målvakt", value: "Målvakt" },
  { label: "Högerback", value: "Högerback" },
  { label: "Mittback", value: "Mittback" },
  { label: "Vänsterback", value: "Vänsterback" },
  { label: "Mittfältare", value: "Mittfältare" },
  { label: "⚡ Forward", value: "Forward" },
  { label: "Flera positioner", value: "Flera positioner" },
];

interface Msg {
  role: "ai" | "player";
  text: string;
  time: string;
}

function nowTime() {
  return new Date().toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" });
}

export default function InterviewChat({
  teamName,
  clubName,
}: {
  teamName: string;
  clubName: string;
}) {
  const [phase, setPhase] = useState<"onboarding" | "chat">("onboarding");
  const [name, setName] = useState("");
  const [position, setPosition] = useState("");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [history, setHistory] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [showChips, setShowChips] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scroll = () =>
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 60);

  const appendAI = (text: string) => {
    setMessages((m) => [...m, { role: "ai", text, time: nowTime() }]);
    scroll();
  };

  const callAI = useCallback(
    async (hist: typeof history) => {
      setBusy(true);
      try {
        const res = await fetch("/api/ai/intervju", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: hist, playerName: name, playerPosition: position }),
        });
        const data = await res.json();
        const reply: string = data.reply ?? "Hmm, något gick fel. Försök igen!";
        appendAI(reply);
        setHistory((h) => [...h, { role: "assistant", content: reply }]);
        if (hist.length > 1) setShowChips(false);
      } catch {
        appendAI("⚠️ Kunde inte ansluta. Kontrollera nätverket och försök igen.");
      }
      setBusy(false);
      textareaRef.current?.focus();
    },
    [name, position] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const startInterview = () => {
    setPhase("chat");
    const firstMsg = `Hej! Jag heter ${name} och spelar som ${position}.`;
    const firstHist = [{ role: "user" as const, content: firstMsg }];
    setMessages([{ role: "player", text: firstMsg, time: nowTime() }]);
    setHistory(firstHist);
    callAI(firstHist);
  };

  const send = (text = input.trim()) => {
    if (!text || busy) return;
    setInput("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
    setMessages((m) => [...m, { role: "player", text, time: nowTime() }]);
    scroll();
    const newHist = [...history, { role: "user" as const, content: text }];
    setHistory(newHist);
    callAI(newHist);
  };

  const restart = () => {
    if (!confirm("Avsluta intervjun och börja om?")) return;
    setPhase("onboarding");
    setName("");
    setPosition("");
    setMessages([]);
    setHistory([]);
    setInput("");
    setShowChips(true);
  };

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height =
        Math.min(textareaRef.current.scrollHeight, 120) + "px";
    }
  }, [input]);

  // ── ONBOARDING ──────────────────────────────────────────────────
  if (phase === "onboarding") {
    return (
      <div
        className="flex flex-col items-center gap-8 w-full max-w-sm mx-auto px-6 py-10"
        style={{ minHeight: "100svh", justifyContent: "center" }}
      >
        {/* Hero */}
        <div className="text-center">
          <p
            className="text-[0.65rem] uppercase tracking-[0.14em] mb-3"
            style={{ color: "var(--primary)", fontFamily: "var(--font-display)" }}
          >
            {clubName} · {teamName}
          </p>
          <h1
            className="text-[1.9rem] font-bold leading-tight"
            style={{ fontFamily: "var(--font-display)", letterSpacing: "-0.5px", color: "var(--ink)" }}
          >
            Berätta för<br />
            <span style={{ color: "var(--primary)" }}>tränaren</span>
          </h1>
          <p className="text-sm mt-3 max-w-xs mx-auto" style={{ color: "var(--ink-soft)" }}>
            Svara på några frågor om fotboll och din säsong. Det tar ungefär 5 minuter.
          </p>
        </div>

        {/* Planillustration */}
        <svg
          viewBox="0 0 300 160"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full max-w-[260px]"
          aria-hidden
        >
          <rect width="300" height="160" rx="8" fill="var(--bg2)" />
          <rect x="10" y="10" width="280" height="140" rx="5" fill="none" stroke="var(--primary)" strokeWidth="1.2" strokeOpacity="0.2" />
          <line x1="150" y1="10" x2="150" y2="150" stroke="var(--primary)" strokeWidth="0.8" strokeOpacity="0.15" />
          <circle cx="150" cy="80" r="24" fill="none" stroke="var(--primary)" strokeWidth="0.8" strokeOpacity="0.15" />
          <circle cx="150" cy="80" r="2" fill="var(--primary)" fillOpacity="0.3" />
          <rect x="10" y="55" width="12" height="50" rx="2" fill="none" stroke="var(--primary)" strokeWidth="1" strokeOpacity="0.25" />
          <rect x="278" y="55" width="12" height="50" rx="2" fill="none" stroke="var(--primary)" strokeWidth="1" strokeOpacity="0.25" />
          {/* GK */}
          <circle cx="24" cy="80" r="8" fill="var(--primary)" fillOpacity="0.2" stroke="var(--primary)" strokeWidth="1.2" />
          <text x="24" y="84" textAnchor="middle" fontFamily="var(--font-display)" fontSize="6" fill="var(--primary)">MV</text>
          {/* Backs */}
          {[46, 63, 97, 114].map((y, i) => (
            <g key={i}>
              <circle cx="75" cy={y} r="7" fill="var(--primary)" fillOpacity="0.07" stroke="var(--primary)" strokeWidth="1" strokeOpacity="0.4" />
              <text x="75" y={y + 3} textAnchor="middle" fontFamily="var(--font-display)" fontSize="5.5" fill="var(--primary)" fillOpacity="0.7">
                {["VB","CB","CB","HB"][i]}
              </text>
            </g>
          ))}
          {/* CM */}
          <circle cx="140" cy="80" r="7" fill="var(--primary)" fillOpacity="0.07" stroke="var(--primary)" strokeWidth="1" strokeOpacity="0.4" />
          <text x="140" y="83" textAnchor="middle" fontFamily="var(--font-display)" fontSize="5.5" fill="var(--primary)" fillOpacity="0.7">CM</text>
          {/* ST */}
          <circle cx="200" cy="80" r="7" fill="var(--primary)" fillOpacity="0.07" stroke="var(--primary)" strokeWidth="1" strokeOpacity="0.4" />
          <text x="200" y="83" textAnchor="middle" fontFamily="var(--font-display)" fontSize="5.5" fill="var(--primary)" fillOpacity="0.7">ST</text>
        </svg>

        {/* Naminput */}
        <div className="w-full space-y-2">
          <label
            className="block text-[0.65rem] uppercase tracking-[0.1em]"
            style={{ color: "var(--ink-faint)", fontFamily: "var(--font-display)" }}
          >
            Vad heter du?
          </label>
          <input
            className="input w-full"
            type="text"
            placeholder="Ditt förnamn…"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={30}
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            style={{ fontSize: "16px" }}
          />
        </div>

        {/* Position */}
        <div className="w-full space-y-2">
          <p
            className="text-[0.65rem] uppercase tracking-[0.1em]"
            style={{ color: "var(--ink-faint)", fontFamily: "var(--font-display)" }}
          >
            Din position
          </p>
          <div className="flex flex-wrap gap-2">
            {POSITIONS.map((p) => (
              <button
                key={p.value}
                type="button"
                onClick={() => setPosition(p.value)}
                className="text-sm rounded-lg px-3 py-2 transition-all"
                style={{
                  background: position === p.value ? "color-mix(in srgb, var(--primary) 15%, transparent)" : "var(--bg2)",
                  border: `1px solid ${position === p.value ? "var(--primary)" : "var(--line)"}`,
                  color: position === p.value ? "var(--primary)" : "var(--ink-soft)",
                  fontFamily: "var(--font-body)",
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={startInterview}
          disabled={name.trim().length < 2 || !position}
          className="btn-primary w-full"
          style={{ fontFamily: "var(--font-display)", letterSpacing: "0.04em" }}
        >
          Starta intervjun →
        </button>
      </div>
    );
  }

  // ── CHAT ────────────────────────────────────────────────────────
  return (
    <div
      className="flex flex-col w-full max-w-xl mx-auto"
      style={{ height: "100svh" }}
    >
      {/* Spelarbar */}
      <div
        className="flex items-center gap-3 px-5 py-3 shrink-0"
        style={{
          background: "var(--bg2)",
          borderBottom: "1px solid var(--line)",
          paddingTop: "max(0.75rem, env(safe-area-inset-top))",
        }}
      >
        <div
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold"
          style={{
            background: "color-mix(in srgb, var(--primary) 20%, transparent)",
            border: "1.5px solid var(--primary)",
            color: "var(--primary)",
            fontFamily: "var(--font-display)",
          }}
        >
          {name[0]?.toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-tight" style={{ color: "var(--ink)" }}>{name}</p>
          <p
            className="text-[0.65rem] leading-tight"
            style={{ color: "var(--ink-faint)", fontFamily: "var(--font-display)" }}
          >
            {position}
          </p>
        </div>
        <button
          onClick={restart}
          className="text-[0.65rem] px-3 py-1.5 rounded-lg transition-colors"
          style={{
            border: "1px solid var(--line)",
            color: "var(--ink-faint)",
            fontFamily: "var(--font-display)",
            background: "transparent",
          }}
        >
          ↩ Börja om
        </button>
      </div>

      {/* Meddelanden */}
      <div
        className="flex-1 overflow-y-auto flex flex-col gap-3 px-5 py-5"
        style={{ scrollbarWidth: "thin", scrollbarColor: "var(--bg3) transparent" }}
      >
        {messages.map((m, i) => (
          <div
            key={i}
            className={`flex flex-col max-w-[82%] ${m.role === "ai" ? "self-start" : "self-end"}`}
          >
            <div
              className="text-sm leading-relaxed px-4 py-3"
              style={
                m.role === "ai"
                  ? {
                      background: "var(--bg2)",
                      border: "1px solid var(--line)",
                      borderRadius: "14px 14px 14px 4px",
                      color: "var(--ink)",
                    }
                  : {
                      background: "var(--primary)",
                      borderRadius: "14px 14px 4px 14px",
                      color: "var(--primary-deep)",
                      fontWeight: 500,
                    }
              }
            >
              {m.text}
            </div>
            <p
              className="text-[0.6rem] mt-1 px-1"
              style={{
                color: "var(--ink-faint)",
                fontFamily: "var(--font-display)",
                textAlign: m.role === "player" ? "right" : "left",
              }}
            >
              {m.time}
            </p>
          </div>
        ))}

        {/* Skriver-indikator */}
        {busy && (
          <div className="self-start flex flex-col">
            <div
              className="flex gap-1.5 items-center px-4 py-3"
              style={{
                background: "var(--bg2)",
                border: "1px solid var(--line)",
                borderRadius: "14px 14px 14px 4px",
              }}
            >
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="block h-2 w-2 rounded-full"
                  style={{
                    background: "var(--ink-faint)",
                    animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite`,
                  }}
                />
              ))}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Snabbsvar (visas bara i början) */}
      {showChips && messages.length <= 2 && (
        <div className="flex flex-wrap gap-2 px-5 pb-2 shrink-0">
          {["💪 Mina styrkor", "🎯 Förbättringsområden", "⭐ Vad är roligast"].map((chip) => (
            <button
              key={chip}
              onClick={() => send(chip.replace(/^[^ ]+ /, ""))}
              disabled={busy}
              className="text-xs px-3 py-1.5 rounded-full transition-all"
              style={{
                background: "var(--bg3)",
                border: "1px solid var(--line)",
                color: "var(--ink-faint)",
                fontFamily: "var(--font-body)",
              }}
            >
              {chip}
            </button>
          ))}
        </div>
      )}

      {/* Inputfält */}
      <div
        className="flex gap-3 px-4 pt-3 shrink-0"
        style={{
          background: "var(--bg)",
          borderTop: "1px solid var(--line)",
          paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))",
        }}
      >
        <textarea
          ref={textareaRef}
          rows={1}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          placeholder="Skriv ditt svar…"
          maxLength={500}
          disabled={busy}
          className="flex-1 resize-none rounded-xl px-4 py-3 text-sm outline-none transition-colors"
          style={{
            background: "var(--bg2)",
            border: "1px solid var(--line)",
            color: "var(--ink)",
            fontFamily: "var(--font-body)",
            fontSize: "16px",
            maxHeight: "120px",
            minHeight: "46px",
          }}
        />
        <button
          onClick={() => send()}
          disabled={busy || !input.trim()}
          className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-xl transition-all"
          style={{
            background: busy || !input.trim() ? "var(--bg3)" : "var(--primary)",
            color: busy || !input.trim() ? "var(--ink-faint)" : "var(--primary-deep)",
          }}
          aria-label="Skicka"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 2L11 13"/><path d="M22 2L15 22 11 13 2 9l20-7z"/>
          </svg>
        </button>
      </div>
    </div>
  );
}
