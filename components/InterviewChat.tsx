"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";

const POSITIONS = [
  { label: "🧤 Målvakt", value: "Målvakt" },
  { label: "Högerback", value: "Högerback" },
  { label: "Mittback", value: "Mittback" },
  { label: "Vänsterback", value: "Vänsterback" },
  { label: "Mittfältare", value: "Mittfältare" },
  { label: "⚡ Forward", value: "Forward" },
  { label: "Flera positioner", value: "Flera positioner" },
];

type InterviewType = "spelarsamtal" | "kvartal";

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
  prefilledName,
  prefilledPosition,
}: {
  teamName: string;
  clubName: string;
  prefilledName?: string;
  prefilledPosition?: string;
}) {
  const isPrefilled = !!prefilledName;
  const [phase, setPhase] = useState<"onboarding" | "chat" | "done">("onboarding");
  const [name, setName] = useState(prefilledName ?? "");
  const [position, setPosition] = useState(prefilledPosition ?? "");
  const [interviewType, setInterviewType] = useState<InterviewType | "">("");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [history, setHistory] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scroll = () => setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 60);

  const callAI = useCallback(
    async (hist: typeof history) => {
      setBusy(true);
      try {
        const res = await fetch("/api/ai/intervju", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: hist,
            playerName: name,
            playerPosition: position,
            interviewType,
          }),
        });
        const data: { reply?: string; done?: boolean; scores?: Record<string, number> } = await res.json();
        const reply = data.reply ?? "Hmm, något gick fel. Försök igen!";

        setMessages((m) => [...m, { role: "ai", text: reply, time: nowTime() }]);
        scroll();

        const newHist = [...hist, { role: "assistant" as const, content: reply }];
        setHistory(newHist);

        if (data.done) {
          await fetch("/api/ai/intervju/spara", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              playerName: name,
              position,
              interviewType,
              summary: reply,
              scores: data.scores ?? {},
              messages: newHist,
            }),
          });
          setTimeout(() => setPhase("done"), 2000);
        }
      } catch {
        setMessages((m) => [...m, { role: "ai", text: "⚠️ Kunde inte ansluta. Försök igen.", time: nowTime() }]);
        scroll();
      }
      setBusy(false);
      textareaRef.current?.focus();
    },
    [name, position, interviewType] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const startInterview = () => {
    setPhase("chat");
    const firstHist = [{ role: "user" as const, content: `Jag heter ${name} och spelar som ${position}.` }];
    setMessages([]);
    setHistory(firstHist);
    callAI(firstHist);
  };

  const send = (text = input.trim()) => {
    if (!text || busy) return;
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    setMessages((m) => [...m, { role: "player", text, time: nowTime() }]);
    scroll();
    const newHist = [...history, { role: "user" as const, content: text }];
    setHistory(newHist);
    callAI(newHist);
  };

  const restart = () => {
    if (!confirm("Avsluta och börja om?")) return;
    setPhase("onboarding");
    setName(""); setPosition(""); setInterviewType("");
    setMessages([]); setHistory([]); setInput("");
  };

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + "px";
    }
  }, [input]);

  // ── AVSLUTSSKÄRM ──────────────────────────────────────────────
  if (phase === "done") {
    return (
      <div className="flex flex-col items-center justify-center gap-8 text-center px-6 w-full max-w-sm mx-auto" style={{ minHeight: "100svh" }}>
        <div
          className="flex h-20 w-20 items-center justify-center rounded-full text-4xl"
          style={{ background: "color-mix(in srgb, var(--primary) 15%, transparent)", border: "2px solid var(--primary)", color: "var(--primary)" }}
        >✓</div>
        <div>
          <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-display)", color: "var(--ink)" }}>
            Toppen, {name}!
          </h1>
          <p className="mt-3 text-sm leading-relaxed" style={{ color: "var(--ink-secondary)" }}>
            Din {interviewType === "kvartal" ? "utvärdering" : "intervju"} är sparad och skickas till tränaren.<br />Bra jobbat! ⚽
          </p>
        </div>
        <Link href="/" className="btn-primary w-full" style={{ fontFamily: "var(--font-display)", letterSpacing: "0.04em" }}>
          Tillbaka till start
        </Link>
      </div>
    );
  }

  // ── ONBOARDING ───────────────────────────────────────────────
  if (phase === "onboarding") {
    const ready = name.trim().length >= 2 && !!position && !!interviewType;
    return (
      <div className="flex flex-col items-center gap-7 w-full max-w-sm mx-auto px-6 py-10" style={{ minHeight: "100svh", justifyContent: "center" }}>
        {/* Header */}
        <div className="text-center">
          <p className="caption uppercase tracking-[0.14em] mb-3" style={{ color: "var(--primary)", fontFamily: "var(--font-display)" }}>
            {clubName} · {teamName}
          </p>
          <h1 className="text-[30px] font-bold leading-tight" style={{ fontFamily: "var(--font-display)", letterSpacing: "-0.5px", color: "var(--ink)" }}>
            Berätta för<br /><span style={{ color: "var(--primary)" }}>tränaren</span>
          </h1>
        </div>

        {/* Namn — dolt om pre-ifyllt (inloggad spelare) */}
        {!isPrefilled && (
          <div className="w-full space-y-2">
            <label className="block caption uppercase tracking-[0.1em]" style={{ color: "var(--ink-muted)", fontFamily: "var(--font-display)" }}>
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
        )}

        {/* Position — dolt om pre-ifyllt */}
        {!isPrefilled && (
          <div className="w-full space-y-2">
            <p className="caption uppercase tracking-[0.1em]" style={{ color: "var(--ink-muted)", fontFamily: "var(--font-display)" }}>
              Din position
            </p>
            <div className="flex flex-wrap gap-2">
              {POSITIONS.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setPosition(p.value)}
                  className="body-small rounded-lg px-3 py-2 transition-all"
                  style={{
                    background: position === p.value ? "color-mix(in srgb, var(--primary) 15%, transparent)" : "var(--surface)",
                    border: `1px solid ${position === p.value ? "var(--primary)" : "var(--border)"}`,
                    color: position === p.value ? "var(--primary)" : "var(--ink-secondary)",
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Visa vem som är inloggad om pre-ifyllt */}
        {isPrefilled && (
          <div
            className="w-full flex items-center gap-3 rounded-2xl px-4 py-3"
            style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
          >
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full font-bold text-sm"
              style={{ background: "color-mix(in srgb, var(--primary) 15%, transparent)", border: "1.5px solid var(--primary)", color: "var(--primary)", fontFamily: "var(--font-display)" }}
            >
              {name[0]?.toUpperCase()}
            </div>
            <div>
              <p className="body-small font-semibold" style={{ color: "var(--ink)" }}>{name}</p>
              {position && <p className="caption" style={{ color: "var(--ink-muted)" }}>{position}</p>}
            </div>
          </div>
        )}

        {/* Intervjutyp */}
        <div className="w-full space-y-2">
          <p className="caption uppercase tracking-[0.1em]" style={{ color: "var(--ink-muted)", fontFamily: "var(--font-display)" }}>
            Typ av intervju
          </p>
          <div className="grid grid-cols-2 gap-3">
            {([
              { value: "spelarsamtal" as const, label: "Spelarsamtal", desc: "Säsongsreflektion och samtalsfrågor" },
              { value: "kvartal" as const, label: "Kvartalsutvärdering", desc: "Egenbedömning mot tränarens betyg" },
            ] as const).map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => setInterviewType(t.value)}
                className="flex flex-col gap-1 rounded-xl p-3 text-left transition-all"
                style={{
                  background: interviewType === t.value ? "color-mix(in srgb, var(--primary) 12%, transparent)" : "var(--surface)",
                  border: `1.5px solid ${interviewType === t.value ? "var(--primary)" : "var(--border)"}`,
                }}
              >
                <span className="body-small font-semibold" style={{ color: interviewType === t.value ? "var(--primary)" : "var(--ink)" }}>
                  {t.label}
                </span>
                <span className="caption leading-snug" style={{ color: "var(--ink-muted)" }}>
                  {t.desc}
                </span>
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={startInterview}
          disabled={!ready}
          className="btn-primary w-full"
          style={{ fontFamily: "var(--font-display)", letterSpacing: "0.04em" }}
        >
          Starta {interviewType === "kvartal" ? "utvärderingen" : "intervjun"} →
        </button>
      </div>
    );
  }

  // ── CHAT ──────────────────────────────────────────────────────
  return (
    <div className="flex flex-col w-full max-w-xl mx-auto" style={{ height: "100svh" }}>
      {/* Topbar */}
      <div
        className="flex items-center gap-3 px-5 py-3 shrink-0"
        style={{ background: "var(--surface)", borderBottom: "1px solid var(--border)", paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}
      >
        <div
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold"
          style={{ background: "color-mix(in srgb, var(--primary) 20%, transparent)", border: "1.5px solid var(--primary)", color: "var(--primary)", fontFamily: "var(--font-display)" }}
        >
          {name[0]?.toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="body-small font-semibold leading-tight" style={{ color: "var(--ink)" }}>{name}</p>
          <p className="caption leading-tight" style={{ color: "var(--ink-muted)", fontFamily: "var(--font-display)" }}>
            {position} · {interviewType === "kvartal" ? "Kvartalsutvärdering" : "Spelarsamtal"}
          </p>
        </div>
        <button
          onClick={restart}
          className="caption px-3 py-1.5 rounded-lg"
          style={{ border: "1px solid var(--border)", color: "var(--ink-muted)", background: "transparent" }}
        >
          ↩ Börja om
        </button>
      </div>

      {/* Meddelanden */}
      <div className="flex-1 overflow-y-auto flex flex-col gap-3 px-5 py-5" style={{ scrollbarWidth: "thin" }}>
        {messages.map((m, i) => (
          <div key={i} className={`flex flex-col max-w-[82%] ${m.role === "ai" ? "self-start" : "self-end"}`}>
            <div
              className="body-small leading-relaxed px-4 py-3"
              style={
                m.role === "ai"
                  ? { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "14px 14px 14px 4px", color: "var(--ink)" }
                  : { background: "var(--primary)", borderRadius: "14px 14px 4px 14px", color: "var(--primary-deep)", fontWeight: 500 }
              }
            >
              {m.text}
            </div>
            <p
              className="caption mt-1 px-1"
              style={{ color: "var(--ink-muted)", fontFamily: "var(--font-display)", textAlign: m.role === "player" ? "right" : "left" }}
            >
              {m.time}
            </p>
          </div>
        ))}

        {busy && (
          <div className="self-start">
            <div className="flex gap-1.5 items-center px-4 py-3" style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "14px 14px 14px 4px" }}>
              {[0, 1, 2].map((i) => (
                <span key={i} className="block h-2 w-2 rounded-full" style={{ background: "var(--ink-muted)", animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite` }} />
              ))}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div
        className="flex gap-3 px-4 pt-3 shrink-0"
        style={{ background: "var(--bg)", borderTop: "1px solid var(--border)", paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))" }}
      >
        <textarea
          ref={textareaRef}
          rows={1}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder="Skriv ditt svar…"
          maxLength={500}
          disabled={busy}
          className="flex-1 resize-none rounded-xl px-4 py-3 text-sm outline-none"
          style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--ink)", fontSize: "16px", maxHeight: "120px", minHeight: "46px" }}
        />
        <button
          onClick={() => send()}
          disabled={busy || !input.trim()}
          className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-xl transition-all"
          style={{ background: busy || !input.trim() ? "var(--elevated)" : "var(--primary)", color: busy || !input.trim() ? "var(--ink-muted)" : "var(--primary-deep)" }}
          aria-label="Skicka"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 2L11 13" /><path d="M22 2L15 22 11 13 2 9l20-7z" />
          </svg>
        </button>
      </div>
    </div>
  );
}
