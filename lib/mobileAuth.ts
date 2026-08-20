import "server-only";

import crypto from "crypto";
import { get, run } from "./db";
import { loadCurrentUserById, type CurrentUser } from "./auth";

const PKCE_PATTERN = /^[A-Za-z0-9_-]{43,128}$/;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43,128}$/;
const DEVICE_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const OAUTH_STATE_MAX_AGE_MS = 10 * 60 * 1000;
const AUTH_CODE_MAX_AGE_MS = 60 * 1000;
const ACCESS_TOKEN_MAX_AGE_SECONDS = 15 * 60;
const REFRESH_TOKEN_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

export type MobileTokenPair = {
  accessToken: string;
  accessTokenExpiresIn: number;
  refreshToken: string;
  refreshTokenExpiresIn: number;
  sessionId: string;
};

function randomToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

function tokenHash(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function verifierMatchesChallenge(verifier: string, challenge: string): boolean {
  if (!PKCE_PATTERN.test(verifier) || !PKCE_PATTERN.test(challenge)) return false;
  const actual = Buffer.from(crypto.createHash("sha256").update(verifier).digest("base64url"));
  const expected = Buffer.from(challenge);
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

export function validPkceChallenge(value: unknown): value is string {
  return typeof value === "string" && PKCE_PATTERN.test(value);
}

export function validDeviceId(value: unknown): value is string {
  return typeof value === "string" && DEVICE_ID_PATTERN.test(value);
}

export function bearerTokenFromRequest(request: Request): string | null {
  const match = /^Bearer ([A-Za-z0-9_-]{43,128})$/.exec(request.headers.get("authorization") ?? "");
  return match?.[1] ?? null;
}

export function nativeCallbackUrl(params: Record<string, string>): URL {
  const configured = process.env.NATIVE_APP_REDIRECT_URI ?? "se.bsk2014.app://auth/callback";
  const url = new URL(configured);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return url;
}

export async function createNativeOAuthState(codeChallenge: string): Promise<string> {
  if (!validPkceChallenge(codeChallenge)) throw new Error("invalid_pkce");
  const state = randomToken();
  await run("DELETE FROM mobile_oauth_states WHERE expires_at <= now() OR consumed_at IS NOT NULL");
  await run(
    `INSERT INTO mobile_oauth_states (state_hash, code_challenge, expires_at)
     VALUES (?, ?, now() + (? * interval '1 millisecond'))`,
    [tokenHash(state), codeChallenge, OAUTH_STATE_MAX_AGE_MS]
  );
  return state;
}

export async function nativeOAuthStateExists(state: string): Promise<boolean> {
  if (!TOKEN_PATTERN.test(state)) return false;
  const row = await get<{ ok: number }>(
    `SELECT 1 AS ok FROM mobile_oauth_states
     WHERE state_hash = ? AND expires_at > now() AND consumed_at IS NULL`,
    [tokenHash(state)]
  );
  return !!row;
}

async function consumeNativeOAuthState(state: string): Promise<string | null> {
  if (!TOKEN_PATTERN.test(state)) return null;
  const rows = await run(
    `UPDATE mobile_oauth_states
     SET consumed_at = now()
     WHERE state_hash = ? AND expires_at > now() AND consumed_at IS NULL
     RETURNING code_challenge`,
    [tokenHash(state)]
  );
  return typeof rows[0]?.code_challenge === "string" ? rows[0].code_challenge : null;
}

export async function abandonNativeOAuthState(state: string): Promise<void> {
  if (!TOKEN_PATTERN.test(state)) return;
  await run(
    "UPDATE mobile_oauth_states SET consumed_at = now() WHERE state_hash = ? AND consumed_at IS NULL",
    [tokenHash(state)]
  );
}

export async function createNativeAuthCode(userId: number, state: string): Promise<string | null> {
  const codeChallenge = await consumeNativeOAuthState(state);
  if (!codeChallenge) return null;
  const code = randomToken();
  await run("DELETE FROM mobile_auth_codes WHERE expires_at <= now() OR consumed_at IS NOT NULL");
  await run(
    `INSERT INTO mobile_auth_codes (code_hash, user_id, code_challenge, expires_at)
     VALUES (?, ?, ?, now() + (? * interval '1 millisecond'))`,
    [tokenHash(code), userId, codeChallenge, AUTH_CODE_MAX_AGE_MS]
  );
  return code;
}

async function consumeNativeAuthCode(code: string, verifier: string): Promise<number | null> {
  if (!TOKEN_PATTERN.test(code) || !PKCE_PATTERN.test(verifier)) return null;
  const candidate = await get<{ user_id: number; code_challenge: string }>(
    `SELECT user_id, code_challenge FROM mobile_auth_codes
     WHERE code_hash = ? AND expires_at > now() AND consumed_at IS NULL`,
    [tokenHash(code)]
  );
  if (!candidate || !verifierMatchesChallenge(verifier, candidate.code_challenge)) return null;
  const rows = await run(
    `UPDATE mobile_auth_codes SET consumed_at = now()
     WHERE code_hash = ? AND consumed_at IS NULL
     RETURNING user_id`,
    [tokenHash(code)]
  );
  return typeof rows[0]?.user_id === "number" ? rows[0].user_id : null;
}

async function issueSession(userId: number, deviceId: string, deviceName: string): Promise<MobileTokenPair> {
  const accessToken = randomToken();
  const refreshToken = randomToken();
  const rows = await run(
    `INSERT INTO mobile_device_sessions (
       id, user_id, device_id, device_name,
       access_token_hash, access_expires_at,
       refresh_token_hash, refresh_expires_at
     ) VALUES (
       ?, ?, ?, ?, ?, now() + (? * interval '1 second'),
       ?, now() + (? * interval '1 second')
     )
     ON CONFLICT (user_id, device_id) DO UPDATE SET
       device_name = excluded.device_name,
       access_token_hash = excluded.access_token_hash,
       access_expires_at = excluded.access_expires_at,
       previous_refresh_token_hash = NULL,
       refresh_token_hash = excluded.refresh_token_hash,
       refresh_expires_at = excluded.refresh_expires_at,
       revoked_at = NULL,
       last_used_at = now()
     RETURNING id`,
    [
      crypto.randomUUID(), userId, deviceId, deviceName.slice(0, 80),
      tokenHash(accessToken), ACCESS_TOKEN_MAX_AGE_SECONDS,
      tokenHash(refreshToken), REFRESH_TOKEN_MAX_AGE_SECONDS,
    ]
  );
  return {
    accessToken,
    accessTokenExpiresIn: ACCESS_TOKEN_MAX_AGE_SECONDS,
    refreshToken,
    refreshTokenExpiresIn: REFRESH_TOKEN_MAX_AGE_SECONDS,
    sessionId: String(rows[0]?.id ?? ""),
  };
}

export async function exchangeNativeAuthCode(input: {
  code: string;
  codeVerifier: string;
  deviceId: string;
  deviceName: string;
}): Promise<{ tokens: MobileTokenPair; user: CurrentUser } | null> {
  if (!validDeviceId(input.deviceId) || input.deviceName.trim().length < 1) return null;
  const userId = await consumeNativeAuthCode(input.code, input.codeVerifier);
  if (!userId) return null;
  const user = await loadCurrentUserById(userId);
  if (!user) return null;
  return { tokens: await issueSession(userId, input.deviceId, input.deviceName.trim()), user };
}

export async function resolveMobileAccessToken(token: string): Promise<CurrentUser | null> {
  if (!TOKEN_PATTERN.test(token)) return null;
  const session = await get<{ id: string; user_id: number }>(
    `SELECT id, user_id FROM mobile_device_sessions
     WHERE access_token_hash = ? AND access_expires_at > now() AND revoked_at IS NULL`,
    [tokenHash(token)]
  );
  if (!session) return null;
  return loadCurrentUserById(session.user_id);
}

export async function refreshMobileSession(refreshToken: string): Promise<MobileTokenPair | null> {
  if (!TOKEN_PATTERN.test(refreshToken)) return null;
  const presentedHash = tokenHash(refreshToken);
  const nextAccess = randomToken();
  const nextRefresh = randomToken();
  const rows = await run(
    `UPDATE mobile_device_sessions SET
       access_token_hash = ?,
       access_expires_at = now() + (? * interval '1 second'),
       previous_refresh_token_hash = refresh_token_hash,
       refresh_token_hash = ?,
       refresh_expires_at = now() + (? * interval '1 second'),
       last_used_at = now()
     WHERE refresh_token_hash = ? AND refresh_expires_at > now() AND revoked_at IS NULL
     RETURNING id`,
    [
      tokenHash(nextAccess), ACCESS_TOKEN_MAX_AGE_SECONDS,
      tokenHash(nextRefresh), REFRESH_TOKEN_MAX_AGE_SECONDS,
      presentedHash,
    ]
  );
  if (rows.length === 0) {
    await run(
      `UPDATE mobile_device_sessions SET revoked_at = now()
       WHERE previous_refresh_token_hash = ? AND revoked_at IS NULL`,
      [presentedHash]
    );
    return null;
  }
  return {
    accessToken: nextAccess,
    accessTokenExpiresIn: ACCESS_TOKEN_MAX_AGE_SECONDS,
    refreshToken: nextRefresh,
    refreshTokenExpiresIn: REFRESH_TOKEN_MAX_AGE_SECONDS,
    sessionId: String(rows[0].id),
  };
}

export async function revokeMobileAccessToken(accessToken: string): Promise<boolean> {
  if (!TOKEN_PATTERN.test(accessToken)) return false;
  const rows = await run(
    `UPDATE mobile_device_sessions SET revoked_at = now()
     WHERE access_token_hash = ? AND revoked_at IS NULL
     RETURNING id`,
    [tokenHash(accessToken)]
  );
  return rows.length > 0;
}
