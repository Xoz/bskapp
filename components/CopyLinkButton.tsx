"use client";
import { useState } from "react";

export default function CopyLinkButton({
  code,
  path,
  variant = "dark",
  label = "Kopiera länk",
}: {
  code: string;
  path: string;
  variant?: "dark" | "light";
  label?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    const url = `${window.location.origin}/${path}/${code}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (variant === "light") {
    return (
      <button onClick={copy} type="button" className="btn-secondary py-2 px-4 text-sm">
        {copied ? "✓ Länk kopierad!" : `🔗 ${label}`}
      </button>
    );
  }

  return (
    <button
      onClick={copy}
      type="button"
      className="caption underline cursor-pointer transition-colors"
      style={{ color: copied ? "var(--accent)" : "rgba(255,255,255,0.45)" }}
    >
      {copied ? "Länk kopierad!" : label}
    </button>
  );
}
