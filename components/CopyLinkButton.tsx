"use client";
import { useState } from "react";

export default function CopyLinkButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    const url = `${window.location.origin}/rapportera/${code}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      onClick={copy}
      className="text-xs underline cursor-pointer transition-colors"
      style={{ color: copied ? "var(--accent)" : "rgba(255,255,255,0.45)" }}
    >
      {copied ? "Länk kopierad!" : "Kopiera länk"}
    </button>
  );
}
