/**
 * Ký gói đáp án bằng chính khoá liveness (ECDSA P-256, KHÔNG xuất được) của thiết bị đang thi.
 *
 * Vì sao: chuỗi băm cũ chỉ dùng SHA-256 công khai nên script tự tính lại được;
 * còn cờ `trusted` trong bằng chứng thao tác là do máy khách tự khai. Khi mỗi gói
 * phải kèm CHỮ KÝ tạo bởi khoá riêng nằm trong IndexedDB của trình duyệt đang thi
 * (không thể xuất, không thể tái tạo ngoài trang), thì script gọi API bằng
 * curl/Postman/headless không đi qua trang sẽ không tạo nổi chữ ký hợp lệ.
 *
 * Chữ ký bao trùm CẢ bằng chứng thao tác (proofs) — nếu không, script chỉ cần
 * bắt một gói hợp lệ rồi sửa phần `trusted` là qua cửa.
 *
 * Module này thuần tuý (chạy được cả hai phía) — chỉ dựng CHUỖI THÔNG ĐIỆP cần ký.
 */
import { canonicalAnswers } from "@/lib/exam/hashChain";

/** Lệch giờ tối đa giữa máy thí sinh và máy chủ cho một gói hợp lệ. */
export const SIGN_MAX_SKEW_MS = 60_000;

/**
 * Bằng chứng thao tác phải xảy ra không quá xa thời điểm gói được gửi.
 * Đặt rộng (5 phút) để không phạt oan khi mất mạng, gói bị dồn hàng đợi hoặc
 * thí sinh chọn đáp án rồi mới bật lại mạng.
 */
export const PROOF_MAX_LAG_MS = 300_000;

/**
 * Bắt buộc chữ ký / bằng chứng theo TỪNG ĐỀ THI, không theo ngày:
 * đề nào bật "chế độ nghiêm ngặt" thì fail-closed ngay từ hôm nay.
 */
export function signatureEnforced(strictMode: boolean | null | undefined): boolean {
  return Boolean(strictMode);
}

export type ProofStamp = {
  trusted?: boolean;
  via?: string | undefined;
  ageMs?: number | undefined;
  at?: number | undefined;
};

/** Chuỗi hoá bằng chứng thao tác một cách ổn định (thứ tự khoá không làm đổi kết quả). */
export function canonicalProofs(proofs?: Record<string, ProofStamp> | undefined): string {
  if (!proofs) return "-";
  return Object.keys(proofs)
    .sort()
    .map((key) => {
      const p = proofs[key] ?? {};
      return `${key}:${p.trusted ? 1 : 0}:${p.via ?? "none"}:${Number(p.at ?? 0)}`;
    })
    .join(",");
}

/** Thông điệp cần ký cho một gói autosave (bao gồm cả bằng chứng thao tác). */
export function saveMessage(params: {
  sessionId: string;
  seq: number;
  chainPrev: string;
  delta: Record<string, unknown>;
  proofs?: Record<string, ProofStamp> | undefined;
  at: number;
}): string {
  const { sessionId, seq, chainPrev, delta, proofs, at } = params;
  return `exam-save:v2|${sessionId}|${seq}|${chainPrev}|${canonicalAnswers(delta)}|${canonicalProofs(proofs)}|${at}`;
}

/** Thông điệp cần ký khi chấm ngay một câu (bao gồm cả bằng chứng thao tác của câu đó). */
export function checkMessage(params: {
  sessionId: string;
  index: number;
  value: unknown;
  proof?: ProofStamp | undefined;
  at: number;
}): string {
  const { sessionId, index, value, proof, at } = params;
  const proofs = proof ? { [String(index)]: proof } : undefined;
  return `exam-check:v2|${sessionId}|${index}|${JSON.stringify(value ?? null)}|${canonicalProofs(proofs)}|${at}`;
}

/** Mốc thời gian của gói có nằm trong cửa sổ cho phép so với giờ máy chủ không. */
export function isFreshStamp(at: unknown, nowMs = Date.now(), skew = SIGN_MAX_SKEW_MS): boolean {
  const t = Number(at);
  if (!Number.isFinite(t) || t <= 0) return false;
  return Math.abs(nowMs - t) <= skew;
}

/**
 * Những câu có bằng chứng thao tác quá cũ (hoặc thiếu mốc thời gian) so với gói gửi lên.
 * Dùng để hạ các câu đó xuống "không có bằng chứng" thay vì huỷ cả gói.
 */
export function staleProofKeys(
  proofs: Record<string, ProofStamp> | undefined,
  packetAt: unknown,
  maxLagMs = PROOF_MAX_LAG_MS,
): string[] {
  const sent = Number(packetAt);
  if (!proofs || !Number.isFinite(sent) || sent <= 0) return [];
  return Object.keys(proofs).filter((key) => {
    const at = Number(proofs[key]?.at ?? NaN);
    if (!Number.isFinite(at) || at <= 0) return true;
    return at > sent + SIGN_MAX_SKEW_MS || sent - at > maxLagMs;
  });
}
