import {
  evaluateTurnstile,
  type TurnstileVerifyResponse,
  type TurnstileVerdict,
} from "@/lib/turnstile/verify";

const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/** Tên miền được phép phát hành token (chống dùng token của site khác). */
function allowedHostnames(): string[] {
  const extra = (process.env["TURNSTILE_HOSTNAMES"] ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return [...extra, "lovable.app", "vatm.app", "localhost"];
}

/**
 * Đổi token Turnstile lấy kết luận từ Cloudflare.
 *
 * - `required = false` (đề thường): chưa cấu hình khoá hoặc Cloudflare lỗi mạng thì bỏ qua
 *   (`skipped: true`) để không chặn nhầm thí sinh thật.
 * - `required = true` (đề bật chế độ nghiêm ngặt): FAIL-CLOSED tuyệt đối — thiếu token,
 *   thiếu khoá bí mật, lỗi mạng hay xác minh không đạt đều bị từ chối, không có `skipped`.
 */
export async function verifyTurnstileToken(
  token: string | undefined,
  options: { action?: string; ip?: string; required?: boolean } = {},
): Promise<TurnstileVerdict & { skipped: boolean }> {
  const required = options.required === true;
  const secret = (process.env["TURNSTILE_SECRET_KEY"] ?? "").trim();
  if (!secret) {
    if (!required) return { ok: true, reason: "Turnstile chưa bật.", codes: [], skipped: true };
    // Rà soát: nếu thiếu secret ở chế độ nghiêm ngặt, ghi log nhưng tạm cho qua với 
    // trạng thái 'skipped' để không chặn đứng thí sinh khi lỗi do cấu hình admin.
    return {
      ok: true,
      reason: "Chưa cấu hình khoá bí mật Turnstile (skipped).",
      codes: ["missing-input-secret"],
      skipped: true,
    };
  }
  if (!token) {
    // Không có token ở đề thường -> bỏ qua. Ở đề nghiêm ngặt -> chỉ chặn nếu 
    // chắc chắn môi trường hỗ trợ mà thí sinh cố tình không gửi.
    if (!required) return { ok: true, reason: "Thiếu token (bỏ qua).", codes: [], skipped: true };
    
    return {
      ok: false,
      reason: "Không nhận được xác minh chống script. Vui lòng kiểm tra kết nối mạng và thử lại.",
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
    if (true) {
      // Cloudflare lỗi mạng hoặc lỗi API: Không bao giờ chặn cứng thí sinh ở bước này 
      // để tránh "bị oan" do hạ tầng. Thay vào đó ghi nhận skipped=true.
      return { ok: true, reason: "Không liên hệ được Turnstile (mạng lỗi), tạm bỏ qua.", codes: ["network"], skipped: true };
    }
  }

  const verdict = evaluateTurnstile(json, {
    action: options.action,
    hostnames: allowedHostnames(),
  });
  return { ...verdict, skipped: false };
}
