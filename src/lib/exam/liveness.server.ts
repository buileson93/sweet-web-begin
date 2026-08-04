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

type LivenessState = {
  jwk?: JsonWebKey;
  nonce?: string;
  issuedAt?: string;
  failures?: number;
  okAt?: string;
};

function readLiveness(helpers: unknown): LivenessState {
  const raw = (helpers as { liveness?: LivenessState } | null)?.liveness;
  return raw && typeof raw === "object" ? raw : {};
}

function withLiveness(helpers: unknown, next: LivenessState): Record<string, unknown> {
  const base = (helpers as Record<string, unknown> | null) ?? {};
  return { ...base, liveness: next };
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

/** Đăng ký khoá công khai của thiết bị đang thi (chỉ nhận LẦN ĐẦU, không cho thay giữa chừng). */
export async function registerLivenessKey(input: {
  sessionId: string;
  submitToken: string;
  publicJwk: unknown;
}): Promise<{ ok: boolean; alreadyRegistered: boolean }> {
  const session = await loadSession(input.sessionId, input.submitToken);
  if (!session) return { ok: false, alreadyRegistered: false };
  const state = readLiveness(session.helpers);
  if (state.jwk) return { ok: true, alreadyRegistered: true };
  if (!isValidPublicJwk(input.publicJwk)) return { ok: false, alreadyRegistered: false };

  await supabaseAdmin
    .from("exam_sessions")
    .update({
      helpers: withLiveness(session.helpers, {
        ...state,
        jwk: input.publicJwk as JsonWebKey,
      }) as never,
    })
    .eq("id", session.id);
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
  await supabaseAdmin
    .from("exam_sessions")
    .update({ helpers: withLiveness(session.helpers, { ...state, nonce, issuedAt }) as never })
    .eq("id", session.id);
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
  // Chỉ tính là "hỏng" khi thử thách còn hạn mà chữ ký sai (dấu hiệu thay người/script).
  else if (fresh) next.failures = (state.failures ?? 0) + 1;

  await supabaseAdmin
    .from("exam_sessions")
    .update({ helpers: withLiveness(session.helpers, next) as never })
    .eq("id", session.id);

  if (!valid) {
    // Thử thách hết hạn hoặc đã bị nhịp sau thay thế: bỏ qua, nhịp sau sẽ thử lại.
    if (!fresh) return { ok: false, reason: "stale" };
    await reportExamEvent({
      sessionId: input.sessionId,
      submitToken: input.submitToken,
      kind: "liveness_failed",
      detail: { reason: "bad-signature" },
    });
    return { ok: false, reason: "bad-signature" };
  }
  return { ok: true };
}
