/**
 * Xác minh chữ ký gói đáp án bằng khoá công khai liveness đã đăng ký của phiên thi.
 * Không phụ thuộc bảng mới: khoá nằm trong cột helpers.liveness.jwk.
 */
import { isValidPublicJwk, verifyLivenessSignature } from "@/lib/exam/livenessVerify";
import { isFreshStamp } from "@/lib/exam/payloadSign";

export type SignatureVerdict =
  | { ok: true }
  | { ok: false; reason: "no_key" | "no_signature" | "stale_stamp" | "bad_signature" };

/** Khoá công khai liveness của phiên (nếu thiết bị đã đăng ký đầu giờ). */
export function sessionPublicJwk(helpers: unknown): JsonWebKey | null {
  const jwk = (helpers as { liveness?: { jwk?: unknown } } | null)?.liveness?.jwk;
  return isValidPublicJwk(jwk) ? jwk : null;
}

/** Kiểm tra chữ ký + mốc thời gian của một gói. */
export async function verifyPayloadSignature(params: {
  helpers: unknown;
  message: string;
  signature?: string | undefined;
  at?: number | undefined;
  nowMs?: number;
}): Promise<SignatureVerdict> {
  const { helpers, message, signature, at } = params;
  const nowMs = params.nowMs ?? Date.now();
  if (!signature) return { ok: false, reason: "no_signature" };
  if (!isFreshStamp(at, nowMs)) return { ok: false, reason: "stale_stamp" };
  const jwk = sessionPublicJwk(helpers);
  if (!jwk) return { ok: false, reason: "no_key" };
  const valid = await verifyLivenessSignature(jwk, message, signature);
  return valid ? { ok: true } : { ok: false, reason: "bad_signature" };
}
