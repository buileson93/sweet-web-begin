/**
 * Máy chủ: đăng ký khoá liveness, phát thử thách và xác minh trả lời.
 * Trạng thái nằm trong cột helpers (jsonb) của phiên thi nên không cần đổi lược đồ.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  isChallengeFresh,
  isValidPublicJwk,
  verifyLivenessSignature,
} from "@/lib/exam/livenessVerify";
import { reportExamEvent } from "@/lib/exam/helpers.server";

/** Số lần được phép cấp lại khoá giữa giờ (tránh chặn oan khi trình duyệt xoá dữ liệu). */
export const MAX_LIVENESS_REKEYS = 3;

type LivenessState = {
  jwk?: JsonWebKey;
  /** Số lần đã cấp lại khoá (mỗi lần đều được ghi vết). */
  rekeys?: number;
  nonce?: string;
  issuedAt?: string;
  failures?: number;
  okAt?: string;
};

function readLiveness(helpers: unknown): LivenessState {
  const raw = (helpers as { liveness?: LivenessState } | null)?.liveness;
  return raw && typeof raw === "object" ? raw : {};
}

/** Ghi nhánh liveness bằng phần vá NGUYÊN TỬ (không ghi đè các nhánh khác của helpers). */
async function writeLiveness(sessionId: string, next: LivenessState): Promise<void> {
  const { mergeHelpers } = await import("@/lib/exam/helpersWrite.server");
  await mergeHelpers(sessionId, { liveness: next });
}

async function loadSession(sessionId: string, submitToken: string) {
  const { data } = await supabaseAdmin
    .from("exam_sessions")
    .select("id, status, submit_token, helpers")
    .eq("id", sessionId)
    .maybeSingle();
  if (!data || data.status !== "active" || data.submit_token !== submitToken) return null;
  return data;
}

/**
 * Đăng ký khoá công khai của thiết bị đang thi.
 *
 * BẮT BUỘC đăng ký đầu giờ: gói đáp án không ký được bằng khoá này sẽ bị từ chối
 * ở đề bật chế độ nghiêm ngặt — script "không đăng ký khoá" không còn thoát cửa.
 * Vẫn CHO PHÉP cấp lại khoá (tối đa MAX_LIVENESS_REKEYS lần, mỗi lần ghi vết
 * `liveness_rekey`) để không chặn oan người thật khi trình duyệt xoá dữ liệu giữa giờ.
 */
export async function registerLivenessKey(input: {
  sessionId: string;
  submitToken: string;
  publicJwk: unknown;
}): Promise<{ ok: boolean; alreadyRegistered: boolean; rekeyed?: boolean }> {
  const session = await loadSession(input.sessionId, input.submitToken);
  if (!session) return { ok: false, alreadyRegistered: false };
  if (!isValidPublicJwk(input.publicJwk)) return { ok: false, alreadyRegistered: false };

  const state = readLiveness(session.helpers);
  const jwk = input.publicJwk as JsonWebKey;
  const sameKey = Boolean(state.jwk && state.jwk.x === jwk.x && state.jwk.y === jwk.y);
  if (sameKey) return { ok: true, alreadyRegistered: true };

  const rekeys = Number(state.rekeys ?? 0);
  if (state.jwk && rekeys >= MAX_LIVENESS_REKEYS) {
    const { flagScriptEvent } = await import("@/lib/exam/scriptGuard.server");
    await flagScriptEvent(session.id, "script_suspect", { reason: "rekey_limit", rekeys });
    return { ok: false, alreadyRegistered: true };
  }

  const next: LivenessState = { ...state, jwk };
  delete next.nonce;
  delete next.issuedAt;
  if (state.jwk) next.rekeys = rekeys + 1;
  await writeLiveness(session.id, next);

  if (state.jwk) {
    await reportExamEvent({
      sessionId: input.sessionId,
      submitToken: input.submitToken,
      kind: "liveness_rekey",
      detail: { rekeys: rekeys + 1, reason: "Thiết bị đăng ký lại khoá chống giả mạo giữa giờ" },
    });
    return { ok: true, alreadyRegistered: true, rekeyed: true };
  }
  return { ok: true, alreadyRegistered: false };
}

/** Phát một thử thách ngẫu nhiên; máy khách phải ký bằng khoá riêng không xuất được. */
export async function issueLivenessChallenge(input: {
  sessionId: string;
  submitToken: string;
}): Promise<{ nonce: string | null; registered: boolean }> {
  const session = await loadSession(input.sessionId, input.submitToken);
  if (!session) return { nonce: null, registered: false };
  const state = readLiveness(session.helpers);
  if (!state.jwk) return { nonce: null, registered: false };

  const bytes = crypto.getRandomValues(new Uint8Array(24));
  const nonce = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const issuedAt = new Date().toISOString();
  await writeLiveness(session.id, { ...state, nonce, issuedAt });
  return { nonce, registered: true };
}

/**
 * Xác minh trả lời. Sai chữ ký / thử thách hết hạn / trả lời lại nonce cũ đều bị ghi nhận
 * là sự kiện `liveness_failed` (có trọng số liêm chính) — dấu hiệu thay người giữa chừng.
 */
export async function answerLivenessChallenge(input: {
  sessionId: string;
  submitToken: string;
  nonce: string;
  signature: string;
}): Promise<{ ok: boolean; reason?: "no-key" | "stale" | "bad-signature" }> {
  const session = await loadSession(input.sessionId, input.submitToken);
  if (!session) return { ok: false, reason: "no-key" };
  const state = readLiveness(session.helpers);
  if (!state.jwk) return { ok: false, reason: "no-key" };

  const fresh = state.nonce === input.nonce && isChallengeFresh(state.issuedAt);
  const valid =
    fresh && (await verifyLivenessSignature(state.jwk, input.nonce, input.signature));

  const next: LivenessState = { ...state, nonce: undefined, issuedAt: undefined };
  if (valid) next.okAt = new Date().toISOString();
  else next.failures = (state.failures ?? 0) + 1;

  await writeLiveness(session.id, next);

  if (!valid) {
    await reportExamEvent({
      sessionId: input.sessionId,
      submitToken: input.submitToken,
      kind: "liveness_failed",
      detail: { reason: fresh ? "bad-signature" : "stale" },
    });
    return { ok: false, reason: fresh ? "bad-signature" : "stale" };
  }
  return { ok: true };
}
