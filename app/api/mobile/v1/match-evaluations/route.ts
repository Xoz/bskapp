import { listMobileMatchEvaluations } from "@/lib/services/matchEvaluationMobile";
import { mobileError, mobileResponse, requireMobileActor } from "@/lib/mobileApi";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    return mobileResponse(await listMobileMatchEvaluations(await requireMobileActor(request)));
  } catch (error) {
    return mobileError(error);
  }
}
