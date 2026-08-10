/**
 * Đánh giá kết quả xác minh Cloudflare Turnstile (thuần tuý, dễ kiểm thử).
 *
 * Turnstile là "captcha vô hình": SDK phía trình duyệt tự phân tích chuyển động
 * chuột, sự kiện DOM, mạng và hạ tầng rồi cấp một token dùng một lần. Máy chủ
 * đổi token đó lấy kết quả tại endpoint siteverify.
 */

export type TurnstileVerifyResponse = {
  success?: boolean;
  action?: string;
  hostname?: string;
  challenge_ts?: string;
  "error-codes"?: string[];
};

export type TurnstileVerdict = {
  /** Cho phép đi tiếp hay không. */
  ok: boolean;
  /** Lý do tiếng Việt để ghi log/hiển thị. */
  reason: string;
  /** Mã lỗi thô của Cloudflare (nếu có). */
  codes: string[];
};

/** Diễn giải mã lỗi Turnstile sang tiếng Việt cho dễ rà soát log. */
export function describeTurnstileCode(code: string): string {
  switch (code) {
    case "missing-input-response":
      return "thiếu token xác minh";
    case "invalid-input-response":
      return "token không hợp lệ hoặc đã hết hạn";
    case "timeout-or-duplicate":
      return "token đã dùng rồi hoặc quá hạn";
    case "invalid-input-secret":
    case "missing-input-secret":
      return "khoá bí mật máy chủ chưa đúng";
    case "bad-request":
      return "yêu cầu xác minh sai định dạng";
    case "internal-error":
      return "Cloudflare gặp lỗi tạm thời";
    default:
      return code;
  }
}

export type TurnstileExpect = {
  /** Hành động mong đợi (chống dùng lại token của trang khác). */
  action?: string | undefined;
  /** Danh sách tên miền được phép (chống dùng token lấy từ site khác). */
  hostnames?: string[] | undefined;
  /** Token quá cũ thì từ chối (mặc định 5 phút). */
  maxAgeMs?: number | undefined;
  /** Mốc "bây giờ" (ms) — phục vụ kiểm thử. */
  nowMs?: number | undefined;
};

const DEFAULT_MAX_AGE_MS = 5 * 60_000;

/**
 * Kết luận từ phản hồi siteverify.
 * @param expect hành động / tên miền / tuổi token mong đợi (hoặc chỉ chuỗi action)
 */
export function evaluateTurnstile(
  response: TurnstileVerifyResponse | null | undefined,
  expect?: string | TurnstileExpect,
): TurnstileVerdict {
  const opts: TurnstileExpect = typeof expect === "string" ? { action: expect } : (expect ?? {});
  const codes = response?.["error-codes"] ?? [];
  if (!response || response.success !== true) {
    const detail = codes.map(describeTurnstileCode).join(", ");
    return {
      ok: false,
      reason: detail ? `đang bị lỗi xác định nhầm người thi \"thông báo Thiết bị này vừa được L. T. Á. Kiều sử dụng để dự thi. Để chống thi hộ, vui lòng chờ thêm 12 phút 19 giây rồi thử lại, hoặc dùng thiết bị khác.\" tìm nguyên nhân và đưa ra kế hoạch khắc phục khogon sửa UI text hay tzclock gì hết (${detail})` : "đang bị lỗi xác định nhầm người thi \"thông báo Thiết bị này vừa được L. T. Á. Kiều sử dụng để dự thi. Để chống thi hộ, vui lòng chờ thêm 12 phút 19 giây rồi thử lại, hoặc dùng thiết bị khác.\" tìm nguyên nhân và đưa ra kế hoạch khắc phục khogon sửa UI text hay tzclock gì hết",
      codes,
    };
  }
  if (opts.action && response.action !== opts.action) {
    return {
      ok: false,
      reason: `Token xác minh không đúng hành động (nhận "${response.action ?? "trống"}").`,
      codes: ["action-mismatch"],
    };
  }
  const allowed = opts.hostnames?.filter(Boolean) ?? [];
  if (allowed.length > 0) {
    const host = (response.hostname ?? "").toLowerCase();
    const okHost = allowed.some((h) => {
      const want = h.toLowerCase().trim();
      return host === want || host.endsWith("." + want);
    });
    if (!okHost) {
      return {
        ok: false,
        reason: `Token xác minh phát hành từ tên miền lạ (nhận "${response.hostname ?? "trống"}").`,
        codes: ["hostname-mismatch"],
      };
    }
  }
  const maxAge = opts.maxAgeMs ?? DEFAULT_MAX_AGE_MS;
  if (response.challenge_ts) {
    const issued = Date.parse(response.challenge_ts);
    const now = opts.nowMs ?? Date.now();
    if (Number.isFinite(issued) && now - issued > maxAge) {
      return {
        ok: false,
        reason: "Token xác minh đã quá hạn, vui lòng thử lại.",
        codes: ["token-expired"],
      };
    }
  }
  return { ok: true, reason: "Xác minh chống script hợp lệ.", codes: [] };
}

