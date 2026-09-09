export type ThemePreference = "light" | "dark" | "system";
export function readThemePreference(value: string | null): ThemePreference {
  return value === "dark" || value === "system" ? value : "light";
}
export function resolveTheme(preference: ThemePreference, systemDark: boolean): "light" | "dark" {
  return preference === "system" ? (systemDark ? "dark" : "light") : preference;
}
export const THEME_COLORS = { light: "#F7F7F3", dark: "#151A18" } as const;

// Kör före första paint, även när lokal lagring är blockerad.
export const THEME_INIT_SCRIPT = `(function(){var p='light';try{var v=localStorage.getItem('bsk_theme');if(v==='dark'||v==='system')p=v;}catch(e){}var dark=p==='dark'||(p==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.dataset.theme=dark?'dark':'light';var m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute('content',dark?'#151A18':'#F7F7F3');})();`;
