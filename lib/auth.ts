import { cookies } from "next/headers";
import crypto from "crypto";
import path from "path";
import fs from "fs";

export type Role = "coach" | "parent";

export function coachEmailToken(email: string): string {
  return `${email}.${sign(`coach_email:${email}`)}`;
}

export async function getCoachEmail(): Promise<string | null> {
  const store = await cookies();
  const token = store.get("bsk_coach_email")?.value;
  if (!token) return null;
  const dot = token.lastIndexOf(".");
  if (dot < 1) return null;
  const email = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  if (sig !== sign(`coach_email:${email}`)) return null;
  return email;
}

export async function getCoachName(): Promise<string | null> {
  const store = await cookies();
  return store.get("bsk_coach_name")?.value || null;
}
// Visningsroll inkl. "player" (publik vy) – används för navigering och växeln.
export type ViewRole = "coach" | "parent" | "player";

// I produktion (Vercel) MÅSTE SESSION_SECRET sättas som miljövariabel –
// filsystemet är flyktigt där. Lokalt genereras en hemlighet i data/.
const SECRET_FILE = path.join(process.cwd(), "data", "session-secret");

function getSecret(): string {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  if (!fs.existsSync(SECRET_FILE)) {
    fs.mkdirSync(path.dirname(SECRET_FILE), { recursive: true });
    fs.writeFileSync(SECRET_FILE, crypto.randomBytes(32).toString("hex"));
  }
  return fs.readFileSync(SECRET_FILE, "utf8").trim();
}

function sign(value: string): string {
  return crypto.createHmac("sha256", getSecret()).update(value).digest("hex");
}

export function sessionToken(role: Role): string {
  return `${role}.${sign(role)}`;
}

export function playerSessionToken(playerId: number): string {
  return `${playerId}.${sign(`player:${playerId}`)}`;
}

export async function getPlayerSession(): Promise<number | null> {
  const store = await cookies();
  const token = store.get("bsk_player_session")?.value;
  if (!token) return null;
  const dot = token.lastIndexOf(".");
  if (dot < 1) return null;
  const id = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  if (sig !== sign(`player:${id}`)) return null;
  const num = Number(id);
  return Number.isFinite(num) && num > 0 ? num : null;
}

// Den verkligt inloggade rollen (från den signerade sessionscookien).
export async function getRealRole(): Promise<Role | null> {
  const store = await cookies();
  const token = store.get("bsk_session")?.value;
  if (!token) return null;
  const [role, sig] = token.split(".");
  if ((role === "coach" || role === "parent") && sig === sign(role)) return role;
  return null;
}

// Visningsrollen. En tränare kan förhandsvisa appen som förälder eller spelare
// via cookien bsk_view (sätts bara nedåt – ingen behörighetshöjning sker här).
export async function getViewRole(): Promise<ViewRole> {
  const real = await getRealRole();
  if (real === "coach") {
    const v = (await cookies()).get("bsk_view")?.value;
    if (v === "parent" || v === "player") return v;
    return "coach";
  }
  if (real === "parent") return "parent";
  return "player";
}

// Effektiv roll för behörighet/sidoskydd.
export async function getRole(): Promise<Role | null> {
  return getRealRole();
}
