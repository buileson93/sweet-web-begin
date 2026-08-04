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

/**
 * Kết luận từ phản hồi siteverify.
 * @param expectedAction hành động mong đợi (chống dùng lại token của trang khác)
 */
export function evaluateTurnstile(
  response: TurnstileVerifyResponse | null | undefined,
  expectedAction?: string,
): TurnstileVerdict {
  const codes = response?.["error-codes"] ?? [];
  if (!response || response.success !== true) {
    const detail = codes.map(describeTurnstileCode).join(", ");
    return {
      ok: false,
      reason: detail ? `Xác minh chống script thất bại (${detail}).` : "Xác minh chống script thất bại.",
      codes,
    };
  }
  if (expectedAction && response.action && response.action !== expectedAction) {
    return {
      ok: false,
      reason: `Token xác minh không đúng hành động (nhận "${response.action}").`,
      codes: ["action-mismatch"],
    };
  }
  return { ok: true, reason: "Xác minh chống script hợp lệ.", codes: [] };
}
