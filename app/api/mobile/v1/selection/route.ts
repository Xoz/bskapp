import { listMobileSelectionMatches } from "@/lib/services/development";
import { mobileError, mobileResponse, requireMobileActor } from "@/lib/mobileApi";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const actor = await requireMobileActor(request);
    return mobileResponse(await listMobileSelectionMatches(actor));
  } catch (error) {
    return mobileError(error);
  }
}
