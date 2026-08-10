import crypto from "crypto";

export function hasReportingCapability(supplied: string | null | undefined, expected: string | null | undefined): boolean {
  if (!supplied || !expected || supplied.length < 24 || supplied.length > 128) return false;
  const suppliedBuffer = Buffer.from(supplied, "utf8");
  const expectedBuffer = Buffer.from(expected, "utf8");
  return suppliedBuffer.length === expectedBuffer.length && crypto.timingSafeEqual(suppliedBuffer, expectedBuffer);
}
