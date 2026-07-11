"use client";

import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [show, setShow] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Redan installerad eller nyligen avvisad
    if (window.matchMedia("(display-mode: standalone)").matches) return;
    if (localStorage.getItem("pwa-dismissed")) return;

    const ios =
      /iphone|ipad|ipod/i.test(navigator.userAgent) &&
      !(navigator as unknown as { chrome?: unknown }).chrome;

    if (ios) {
      setIsIOS(true);
      // Visa lite fördröjt så sidan hunnit laddas
      setTimeout(() => setShow(true), 3000);
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setTimeout(() => setShow(true), 3000);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const dismiss = () => {
    setShow(false);
    localStorage.setItem("pwa-dismissed", "1");
  };

  const install = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setShow(false);
      localStorage.setItem("pwa-dismissed", "1");
    }
    setDeferredPrompt(null);
  };

  if (!show) return null;

  return (
    <div
      className="md:hidden fixed left-4 right-4 z-[60] rounded-2xl p-4 flex items-start gap-3 shadow-xl"
      style={{
        bottom: "calc(5rem + env(safe-area-inset-bottom))",
        background: "var(--surface)",
        border: "1px solid var(--primary)",
      }}
    >
      <div className="text-xl shrink-0 mt-0.5">📲</div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm" style={{ color: "var(--ink)" }}>
          Installera appen
        </p>
        {isIOS ? (
          <p className="caption mt-0.5 leading-relaxed" style={{ color: "var(--ink-secondary)" }}>
            Tryck på <strong>Dela</strong>{" "}
            <span style={{ color: "var(--primary)" }}>⎙</span> och sedan{" "}
            <strong>Lägg till på hemskärmen</strong>.
          </p>
        ) : (
          <p className="caption mt-0.5 leading-relaxed" style={{ color: "var(--ink-secondary)" }}>
            Lägg till på hemskärmen för snabb åtkomst.
          </p>
        )}
      </div>
      <div className="flex flex-col gap-1.5 shrink-0">
        {!isIOS && (
          <button
            onClick={install}
            className="btn-primary text-xs px-3 py-1.5 whitespace-nowrap"
          >
            Installera
          </button>
        )}
        <button
          onClick={dismiss}
          className="caption px-3 py-1.5 rounded-lg text-center"
          style={{ color: "var(--ink-muted)", border: "1px solid var(--border)" }}
        >
          Stäng
        </button>
      </div>
    </div>
  );
}
