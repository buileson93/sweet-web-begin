/**
 * "Khoá xác minh lại" trong giờ thi.
 *
 * Khi phát hiện dấu hiệu tự động hoá (webdriver/headless, bấm mồi ẩn...), phòng thi
 * bị khoá thao tác: mọi gói đáp án gửi lên đều bị từ chối cho tới khi thí sinh vượt
 * qua một lần xác minh Turnstile mới. Người thật chỉ mất vài giây (captcha vô hình),
 * còn script thì không tự tạo được token hợp lệ.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { mergeHelpers } from "@/lib/exam/helpersWrite.server";

export const CAPTCHA_LOCK_MESSAGE =
  "Phòng thi đang tạm khoá do phát hiện dấu hiệu tự động hoá. Vui lòng xác minh lại để tiếp tục làm bài.";

type Helpers = Record<string, unknown> | null | undefined;

/** Phòng thi có đang bị khoá chờ xác minh lại không? */
export function isCaptchaLocked(helpers: Helpers): boolean {
  const lock = (helpers as Record<string, unknown> | null)?.["captchaLock"] as
    | { locked?: boolean }
    | undefined;
  return lock?.locked === true;
}

/** Khoá phòng thi, yêu cầu xác minh lại (chỉ áp dụng cho đề nghiêm ngặt). */
export async function lockForCaptcha(sessionId: string, reason: string): Promise<void> {
  await mergeHelpers(sessionId, {
    captchaLock: { locked: true, reason, at: new Date().toISOString() },
  });
}

/** Đề này có bật chế độ nghiêm ngặt không? */
export async function isStrictSession(sessionId: string): Promise<boolean> {
  const { data: session } = await supabaseAdmin
    .from("exam_sessions")
    .select("quiz_id")
    .eq("id", sessionId)
    .maybeSingle();
  if (!session) return false;
  const { data: quiz } = await supabaseAdmin
    .from("quizzes")
    .select("strict_mode")
    .eq("id", session.quiz_id)
    .maybeSingle();
  return quiz?.strict_mode === true;
}

/**
 * Thí sinh gửi token Turnstile mới để mở lại bài. Chỉ mở khi xác minh THÀNH CÔNG.
 */
export async function verifyExamCaptcha(input: {
  sessionId: string;
  submitToken: string;
  captchaToken?: string;
}): Promise<{ ok: boolean; locked: boolean; reason: string }> {
  const { data: session } = await supabaseAdmin
    .from("exam_sessions")
    .select("id, quiz_id, status, submit_token, helpers")
    .eq("id", input.sessionId)
    .maybeSingle();
  if (!session || session.status !== "active" || session.submit_token !== input.submitToken) {
    throw new Error("Phiên thi không hợp lệ.");
  }

  const { verifyTurnstileToken } = await import("@/lib/turnstile.server");
  const verdict = await verifyTurnstileToken(input.captchaToken, {
    action: "exam-guard",
    required: true,
  });

  if (!verdict.ok) {
    const { flagScriptEvent } = await import("@/lib/exam/scriptGuard.server");
    await flagScriptEvent(session.id, "captcha_failed", {
      source: "turnstile",
      stage: "re-verify",
      signals: verdict.codes,
      note: verdict.reason,
    });
    return { ok: false, locked: true, reason: verdict.reason };
  }

  await mergeHelpers(session.id, {
    captchaLock: { locked: false, verifiedAt: new Date().toISOString() },
  });
  return { ok: true, locked: false, reason: "Xác minh thành công, bạn có thể làm bài tiếp." };
}
