/**
 * Chấm điểm "liêm chính" của phiên thi từ các sự kiện hành vi.
 * Logic thuần tuý (không phụ thuộc Supabase) để test được dễ dàng.
 */

export const EXAM_EVENT_KINDS = [
  "tab_hidden",
  "window_blur",
  "copy",
  "paste",
  "contextmenu",
  "fullscreen_exit",
  "resize_suspect",
  "reconnect",
  "multi_tab",
] as const;

export type ExamEventKind = (typeof EXAM_EVENT_KINDS)[number];

export type ExamEventDetail = {
  /** Thời lượng ẩn tab (mili giây) — dùng cho kind = "tab_hidden". */
  hiddenMs?: number;
  /** Tài liệu vẫn đang hiển thị hay không — dùng cho kind = "window_blur". */
  documentVisible?: boolean;
  [key: string]: unknown;
};

/** Ngưỡng huỷ bài mặc định khi cuộc thi bật chế độ nghiêm ngặt. */
export const DISQUALIFY_THRESHOLD_DEFAULT = 6;
/** Rời màn hình thi từ mốc này trở lên là bị ghi nhận. */
export const TAB_HIDDEN_MIN_MS = 1_500;
/** Mất focus cửa sổ (mà trang vẫn hiển thị) kéo dài từ mốc này mới bị ghi nhận nhẹ. */
export const WINDOW_BLUR_MIN_MS = 4_000;
/** Số sự kiện tối đa ghi nhận cho một phiên thi (chống spam). */
export const MAX_EVENTS_PER_SESSION = 20;
/**
 * Hai loại sự kiện nặng nhất được MIỄN quota chống spam:
 * nếu tính chung, thí sinh chỉ cần bấm Ctrl+C 20 lần đầu giờ là "đốt" hết quota
 * rồi rời tab thoải mái mà không bị ghi nhận.
 */
export const QUOTA_EXEMPT_KINDS: readonly string[] = ["tab_hidden", "multi_tab"];
/** Trần riêng (rất rộng) cho các loại được miễn quota, chỉ để chặn lạm dụng. */
export const MAX_EXEMPT_EVENTS_PER_SESSION = 200;

/** Sự kiện này có bị tính vào quota 20 bản ghi/phiên hay không. */
export function isQuotaExempt(kind: string): boolean {
  return QUOTA_EXEMPT_KINDS.includes(kind);
}

export function isExamEventKind(value: string): value is ExamEventKind {
  return (EXAM_EVENT_KINDS as readonly string[]).includes(value);
}



/**
 * Trọng số phạt cho từng sự kiện.
 * Nguyên tắc: không phạt oan các hành vi bình thường trên điện thoại
 * (thông báo đẩy, cuộc gọi ngắn, xoay màn hình, bàn phím ảo bật lên).
 */
export function scoreEvent(kind: ExamEventKind | string, detail: ExamEventDetail = {}): number {
  switch (kind) {
    case "tab_hidden": {
      const ms = Number(detail.hiddenMs ?? 0);
      if (!Number.isFinite(ms) || ms < TAB_HIDDEN_MIN_MS) return 0; // chớp nhoáng: thông báo / xoay màn hình
      if (ms <= 15_000) return 2;
      return 4;
    }
    // Mất focus cửa sổ: nếu tab đã ẩn thì phạt; nếu trang vẫn hiển thị chỉ phạt nhẹ khi kéo dài.
    case "window_blur": {
      if (detail.documentVisible === false) return 2;
      const ms = Number(detail.blurredMs ?? 0);
      return Number.isFinite(ms) && ms >= WINDOW_BLUR_MIN_MS ? 1 : 0;
    }
    case "copy":
    case "paste":
      return 3;
    case "contextmenu":
      return 0; // chỉ chặn, không phạt
    case "fullscreen_exit":
      return 2;
    case "multi_tab":
      return 5;
    case "resize_suspect":
      return 1;
    case "reconnect":
      return 0;
    default:
      return 0;
  }
}

/**
 * Chỉ huỷ bài khi cuộc thi bật chế độ nghiêm ngặt VÀ điểm liêm chính chạm ngưỡng.
 * Ngoài ra chỉ ghi nhận để quản trị xem xét.
 */
export function shouldDisqualify(
  score: number,
  threshold: number = DISQUALIFY_THRESHOLD_DEFAULT,
  strictMode = false,
): boolean {
  if (!strictMode) return false;
  const limit =
    Number.isFinite(threshold) && threshold > 0 ? threshold : DISQUALIFY_THRESHOLD_DEFAULT;
  return score >= limit;
}

/** Số lần rời màn hình được tha thứ: máy tính 0, điện thoại 1 (có thể có cuộc gọi/thông báo). */
export function leaveAllowance(isMobile: boolean): number {
  return isMobile ? 1 : 0;
}

/** Đã vượt quá mức tha thứ => buộc thi lại từ đầu. */
export function shouldForceRestart(violations: number, isMobile: boolean): boolean {
  return violations > leaveAllowance(isMobile);
}

/** Nhận diện thiết bị di động (chỉ chạy phía máy khách). */
export function isMobileDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  const touch = (navigator.maxTouchPoints ?? 0) > 1;
  return /Android|iPhone|iPad|iPod|Mobile|Windows Phone/i.test(ua) || touch;
}
