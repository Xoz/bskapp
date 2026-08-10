import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { verifyCoachBridge } from "@/lib/bridge-auth";

export function proxy(request: NextRequest) {
  if (process.env.NODE_ENV !== "production") return NextResponse.next();

  const payload = request.headers.get("x-bsk-coach");
  const signature = request.headers.get("x-bsk-coach-signature");
  const secret = process.env.BSK_SESSION_BRIDGE_SECRET;
  if (payload && signature && secret && verifyCoachBridge(payload, signature, secret)) return NextResponse.next();

  return new NextResponse("Tränarbehörighet saknas.", {
    status: 401,
    headers: { "cache-control": "no-store", "content-type": "text/plain; charset=utf-8" },
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
