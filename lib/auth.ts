import { cookies } from "next/headers";
import crypto from "crypto";
import path from "path";
import fs from "fs";

export type Role = "coach" | "parent";

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

export async function getRole(): Promise<Role | null> {
  const store = await cookies();
  const token = store.get("bsk_session")?.value;
  if (!token) return null;
  const [role, sig] = token.split(".");
  if ((role === "coach" || role === "parent") && sig === sign(role)) return role;
  return null;
}
