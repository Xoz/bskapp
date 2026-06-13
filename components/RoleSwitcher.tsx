import { setViewAs } from "@/lib/actions";
import type { ViewRole } from "@/lib/auth";

const ITEMS: { key: ViewRole; label: string }[] = [
  { key: "player", label: "Spelare" },
  { key: "parent", label: "Förälder" },
  { key: "coach", label: "Tränare" },
];

// Tränaren kan förhandsvisa appen som förälder/spelare. För övriga fungerar
// knapparna som genvägar (till publik vy eller inloggning).
export default function RoleSwitcher({ view }: { view: ViewRole }) {
  return (
    <div
      className="flex items-center rounded-full p-0.5 gap-0.5 shrink-0"
      style={{ background: "var(--bg2)", border: "1px solid var(--line)" }}
    >
      {ITEMS.map(({ key, label }) => {
        const active = key === view;
        return (
          <form action={setViewAs} key={key}>
            <input type="hidden" name="view" value={key} />
            <button
              type="submit"
              aria-pressed={active}
              className="text-[0.625rem] px-2.5 py-1.5 rounded-full font-medium transition-colors whitespace-nowrap uppercase tracking-wide cursor-pointer"
              style={
                active
                  ? { background: "var(--primary)", color: "var(--primary-deep)" }
                  : { color: "var(--ink-faint)" }
              }
            >
              {label}
            </button>
          </form>
        );
      })}
    </div>
  );
}
