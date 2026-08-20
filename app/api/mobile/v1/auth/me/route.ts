import { mobileError, mobileResponse, requireMobileActor } from "@/lib/mobileApi";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const actor = await requireMobileActor(request);
    return mobileResponse({
      id: actor.id,
      email: actor.email,
      name: actor.name,
      roles: actor.roles,
      primaryRole: actor.primaryRole,
      permissions: actor.permissions,
      groupIds: actor.groupIds,
    });
  } catch (error) {
    return mobileError(error);
  }
}
