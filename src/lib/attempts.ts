/**
 * Lớp thuần tuý xử lý lỗi giới hạn lượt thi trả về từ hàm Postgres
 * `start_exam_session_tx` (không phụ thuộc Supabase nên test được offline).
 */

export const MAX_ATTEMPTS_CODE = "MAX_ATTEMPTS_REACHED";

/** Kiểm tra lỗi từ DB có phải là "đã hết lượt thi" hay không. */
export function isMaxAttemptsError(error: unknown): boolean {
  if (!error) return false;
  if (typeof error === "string") return error.includes(MAX_ATTEMPTS_CODE);
  if (typeof error === "object") {
    const e = error as { message?: unknown; details?: unknown; hint?: unknown };
    return [e.message, e.details, e.hint].some(
      (v) => typeof v === "string" && v.includes(MAX_ATTEMPTS_CODE),
    );
  }
  return false;
}

/** Thông báo tiếng Việt khi vượt quá số lượt thi cho phép. */
export function maxAttemptsMessage(maxAttempts: number): string {
  return `Cuộc thi này chỉ cho phép tối đa ${maxAttempts} lượt thi.`;
}

/**
 * Chuyển lỗi của RPC thành thông báo tiếng Việt cho thí sinh.
 * Giữ nguyên hành vi cũ: hết lượt thi báo rõ giới hạn, lỗi khác giữ nguyên nội dung.
 */
export function mapStartExamError(error: unknown, maxAttempts: number): Error {
  if (isMaxAttemptsError(error)) return new Error(maxAttemptsMessage(maxAttempts));
  const message =
    typeof error === "object" && error && typeof (error as { message?: unknown }).message === "string"
      ? (error as { message: string }).message
      : "Không tạo được phiên thi. Vui lòng thử lại.";
  return new Error(message);
}
