/**
 * Ký gói đáp án bằng chính khoá liveness (ECDSA P-256, KHÔNG xuất được) của thiết bị đang thi.
 *
 * Vì sao: chuỗi băm cũ chỉ dùng SHA-256 công khai nên script tự tính lại được;
 * còn cờ `trusted` trong bằng chứng thao tác là do máy khách tự khai. Khi mỗi gói
 * phải kèm CHỮ KÝ tạo bởi khoá riêng nằm trong IndexedDB của trình duyệt đang thi
 * (không thể xuất, không thể tái tạo ngoài trang), thì script gọi API bằng
 * curl/Postman/headless không đi qua trang sẽ không tạo nổi chữ ký hợp lệ.
 *
 * Module này thuần tuý (chạy được cả hai phía) — chỉ dựng CHUỖI THÔNG ĐIỆP cần ký.
 */
import { canonicalAnswers } from "@/lib/exam/hashChain";

/** Lệch giờ tối đa giữa máy thí sinh và máy chủ cho một gói hợp lệ. */
export const SIGN_MAX_SKEW_MS = 60_000;

/**
 * Mốc bật chặn (fail-closed). Trước mốc này: thiếu/sai chữ ký chỉ GHI LOG,
 * bài làm vẫn được ghi bình thường để không phạt oan trong giai đoạn chuyển tiếp.
 */
export const SIGNATURE_ENFORCED_FROM = "2026-08-18T00:00:00.000Z";

/** Đã đến giai đoạn chặn thật hay chưa. */
export function signatureEnforced(now: Date | string = new Date()): boolean {
  const t = (typeof now === "string" ? new Date(now) : now).getTime();
  return Number.isFinite(t) && t >= new Date(SIGNATURE_ENFORCED_FROM).getTime();
}

/** Thông điệp cần ký cho một gói autosave. */
export function saveMessage(params: {
  sessionId: string;
  seq: number;
  chainPrev: string;
  delta: Record<string, unknown>;
  at: number;
}): string {
  const { sessionId, seq, chainPrev, delta, at } = params;
  return `exam-save:v1|${sessionId}|${seq}|${chainPrev}|${canonicalAnswers(delta)}|${at}`;
}

/** Thông điệp cần ký khi chấm ngay một câu. */
export function checkMessage(params: {
  sessionId: string;
  index: number;
  value: unknown;
  at: number;
}): string {
  const { sessionId, index, value, at } = params;
  return `exam-check:v1|${sessionId}|${index}|${JSON.stringify(value ?? null)}|${at}`;
}

/** Mốc thời gian của gói có nằm trong cửa sổ cho phép so với giờ máy chủ không. */
export function isFreshStamp(at: unknown, nowMs = Date.now(), skew = SIGN_MAX_SKEW_MS): boolean {
  const t = Number(at);
  if (!Number.isFinite(t) || t <= 0) return false;
  return Math.abs(nowMs - t) <= skew;
}
