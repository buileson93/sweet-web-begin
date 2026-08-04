import { evaluateTurnstile, type TurnstileVerifyResponse, type TurnstileVerdict } from "@/lib/turnstile/verify";

const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/**
 * Đổi token Turnstile lấy kết luận từ Cloudflare.
 * Chưa cấu hình TURNSTILE_SECRET_KEY thì bỏ qua (ok = true) để không chặn thi.
 */
export async function verifyTurnstileToken(
  token: string | undefined,
  options: { action?: string; ip?: string } = {},
): Promise<TurnstileVerdict & { skipped: boolean }> {
  const secret = (process.env["TURNSTILE_SECRET_KEY"] ?? "").trim();
  if (!secret) return { ok: true, reason: "Turnstile chưa bật.", codes: [], skipped: true };
  if (!token) {
    return {
      ok: false,
      reason: "Thiếu token xác minh chống script. Vui lòng tải lại trang và thử lại.",
      codes: ["missing-input-response"],
      skipped: false,
    };
  }

  const body = new URLSearchParams({ secret, response: token });
  if (options.ip) body.set("remoteip", options.ip);

  let json: TurnstileVerifyResponse | null = null;
  try {
    const res = await fetch(SITEVERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    json = (await res.json()) as TurnstileVerifyResponse;
  } catch {
    // Cloudflare lỗi mạng tạm thời: không phạt oan thí sinh.
    return { ok: true, reason: "Không liên hệ được Turnstile, tạm bỏ qua.", codes: ["network"], skipped: true };
  }

  return { ...evaluateTurnstile(json, options.action), skipped: false };
}
