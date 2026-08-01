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
      if (!Number.isFinite(ms) || ms < 3_000) return 0; // thông báo / xoay màn hình
      if (ms <= 15_000) return 2;
      return 4;
    }
    // Mất focus cửa sổ mà trang vẫn hiển thị (bàn phím ảo, thanh địa chỉ): không phạt.
    case "window_blur":
      return detail.documentVisible === false ? 2 : 0;
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
