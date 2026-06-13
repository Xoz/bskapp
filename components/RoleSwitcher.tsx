"use client";

import { useRouter } from "next/navigation";
import type { Role } from "@/lib/auth";

const ROLES = [
  { key: null, label: "Spelare", href: "/rapportera" },
  { key: "parent" as const, label: "Förälder", href: "/matcher" },
  { key: "coach" as const, label: "Tränare", href: "/" },
] as const;

export default function RoleSwitcher({ role }: { role: Role | null }) {
  const router = useRouter();

  function handleClick(targetKey: Role | null, href: string) {
    if (targetKey === null) {
      router.push(href);
    } else if (role === "coach" || role === targetKey) {
      router.push(href);
    } else {
      router.push("/login");
    }
  }

  return (
    <div
      className="flex items-center rounded-full p-0.5 gap-0.5 shrink-0"
      style={{ background: "var(--bg2)", border: "1px solid var(--line)" }}
    >
      {ROLES.map(({ key, label, href }) => {
        const active = key === role || (key === null && role === null);
        return (
          <button
            key={label}
            onClick={() => handleClick(key, href)}
            className="text-[0.625rem] px-2.5 py-1.5 rounded-full font-medium transition-colors whitespace-nowrap uppercase tracking-wide"
            style={
              active
                ? { background: "var(--primary)", color: "var(--primary-deep)" }
                : { color: "var(--ink-faint)" }
            }
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
