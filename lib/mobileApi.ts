import "server-only";

import { getCurrentUser, type CurrentUser } from "./auth";
import { bearerTokenFromRequest, resolveMobileAccessToken } from "./mobileAuth";
import { DevelopmentServiceError } from "./services/development";

export async function requireMobileActor(request?: Request): Promise<CurrentUser> {
  const bearer = request ? bearerTokenFromRequest(request) : null;
  const actor = bearer ? await resolveMobileAccessToken(bearer) : await getCurrentUser();
  if (!actor) throw new DevelopmentServiceError("unauthorized", "Inloggning krävs.", 401);
  return actor;
}

export function mobileResponse(data: unknown, status = 200): Response {
  return Response.json(
    { apiVersion: "1", data },
    { status, headers: { "cache-control": "no-store" } }
  );
}

export function mobileError(error: unknown): Response {
  if (error instanceof DevelopmentServiceError) {
    return Response.json(
      { apiVersion: "1", error: { code: error.code, message: error.message } },
      { status: error.status, headers: { "cache-control": "no-store" } }
    );
  }
  console.error("Mobile API internal error", error);
  return Response.json(
    { apiVersion: "1", error: { code: "internal_error", message: "Ett oväntat serverfel inträffade." } },
    { status: 500, headers: { "cache-control": "no-store" } }
  );
}
