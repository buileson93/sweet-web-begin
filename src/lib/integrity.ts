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
  "devtools_open",
  "liveness_failed",
  // Chống script: đáp án không kèm bằng chứng thao tác thật / môi trường tự động hoá.
  "untrusted_input",
  "automation_detected",
  "script_suspect",
  // Bẫy nâng cao: "Câu hỏi giả" hoặc "Phần tử mồi động" (Dynamic Honeypots).
  "honeypot_hit",
  // Captcha vô hình Cloudflare Turnstile kết luận rủi ro.
  "captcha_failed",
  // Cấp lại khoá chống giả mạo giữa giờ (trình duyệt xoá dữ liệu): chỉ ghi vết, không phạt.
  "liveness_rekey",
  // Tốc độ trả lời bất khả thi, hoặc nhanh bất thường đi kèm tín hiệu script.
  "speed_anomaly",
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
export const TAB_HIDDEN_MIN_MS = 800;
/** Mất focus cửa sổ (mà trang vẫn hiển thị) kéo dài từ mốc này mới bị ghi nhận nhẹ. */
export const WINDOW_BLUR_MIN_MS = 4_000;
/**
 * Quota chống spam tính theo TỪNG LOẠI sự kiện (không gộp chung).
 *
 * Vì sao: gộp chung một quota 20 bản ghi thì script chỉ cần bắn 20 sự kiện vô hại
 * đầu giờ (contextmenu, copy...) là "đốt" sạch quota, khiến mọi vi phạm nặng sau đó
 * không được ghi và chế độ nghiêm ngặt không bao giờ chạm ngưỡng huỷ bài.
 */
export const MAX_EVENTS_PER_KIND = 20;
/**
 * Các loại được MIỄN quota hoàn toàn: nhóm rời màn hình nặng nhất và toàn bộ
 * nhóm chống-script (những loại này chính là bằng chứng gian lận, không được phép bị chặn).
 */
export const QUOTA_EXEMPT_KINDS: readonly string[] = [
  "tab_hidden",
  "multi_tab",
  "devtools_open",
  "liveness_failed",
  "untrusted_input",
  "automation_detected",
  "script_suspect",
  "captcha_failed",
  "honeypot_hit",
];
/** Trần riêng (rất rộng) cho các loại được miễn quota, chỉ để chặn lạm dụng dung lượng. */
export const MAX_EXEMPT_EVENTS_PER_SESSION = 200;

/** Sự kiện này có được miễn quota theo loại hay không. */
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
  // Cấp lại khoá là tình huống bình thường của người thi thật (trình duyệt xoá IndexedDB):
  // chỉ lưu vết để rà soát, tuyệt đối không cộng điểm phạt.
  if (kind === "liveness_rekey") return 0;
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
    // Chỉ phạt khi bẫy `debugger` (hoặc phím tắt Inspect) xác nhận DevTools đang mở.
    // Suy đoán theo kích thước cửa sổ (`size_persist`) và mồi console đơn lẻ
    // (`console_bait`) đều dễ oan do sidebar/tiện ích mở rộng -> chỉ ghi log.
    case "devtools_open": {
      const via = String((detail as { via?: string }).via ?? "");
      // Các client cũ từng gửi `dw`/`dh` cùng console_bait. Dù `via` bị thiếu hoặc
      // sai, tuyệt đối không phạt sự kiện có số đo cửa sổ vì đó không phải bằng
      // chứng DevTools (thanh trình duyệt/sidebar cũng tạo khoảng trống tương tự).
      const hasWindowGap = "dw" in detail || "dh" in detail;
      const soft =
        hasWindowGap || via === "size_persist" || via === "size" || via === "console_bait";
      return soft ? 0 : 4;
    }

    // Không ký lại được thử thách liveness: dấu hiệu đổi thiết bị/thay người giữa chừng
    // hoặc gọi API bằng script (không có khoá riêng trong trình duyệt đang thi).
    case "liveness_failed":
      return Number((detail as { reason?: string }).reason === "stale" ? 1 : 3);
    // Đáp án gửi lên mà KHÔNG có thao tác vật lý thật kèm theo: dấu hiệu gọi API bằng script.
    // Đáp án đó đã bị máy chủ từ chối ghi, đây chỉ là phần ghi nhận vi phạm.
    case "untrusted_input":
      return 4;
    // Trình duyệt đang bị điều khiển tự động (webdriver / headless / Selenium / Playwright).
    case "automation_detected":
      return 4; // Giảm từ 6 xuống 4 để tránh huỷ bài ngay lập tức khi chỉ có 1 tín hiệu nghi ngờ
    // Nhịp trả lời đều như máy hoặc gói tin thiếu bằng chứng: cảnh báo mức vừa.
    case "script_suspect": {
      const reason = String((detail as { reason?: string }).reason ?? "");
      // RÀ SOÁT KỸ THUẬT: autosave_rate:too_fast có thể do mạng, nhưng nếu đi kèm tốc độ cao (1.2s/câu) 
      // và điểm tuyệt đối thì cần đối soát chữ ký payload & bằng chứng thao tác (isTrusted).
      // Bản thân tốc độ 1.2s/câu KHÔNG PHẢI là bằng chứng gian lận nếu người thi thuộc đề.
      // Việc chặn script dựa trên: Chữ ký số P-256, Bẫy Honeypot, và cờ isTrusted từ trình duyệt.
      if (reason.startsWith("autosave_rate:")) return 0;
      // Bằng chứng thao tác quá cũ: thí sinh chọn đáp án rồi mất mạng/gói bị dồn hàng đợi.
      // Bằng chứng đã bị hạ cấp (đáp án không được ghi nếu là câu mới) nên chỉ ghi log.
      if (reason === "stale_proof" || reason === "stale_proof_check") return 0;
      return 3;
    }


    // Bấm trúng thẻ mồi ẩn: chỉ script quét DOM mới làm được -> phạt nặng nhất.
    case "honeypot_hit":
      return 10; // Giữ nguyên trọng số cao nhất vì đây là bằng chứng gian lận tuyệt đối
    // Captcha vô hình Cloudflare kết luận rủi ro: coi như dấu hiệu script rõ ràng,
    // phạt nặng (đủ vượt ngưỡng ở chế độ nghiêm ngặt) và luôn ghi log chi tiết.
    case "captcha_failed":
      return 8; // Giảm từ 10 xuống 8 để kết hợp với các vi phạm khác mới huỷ bài
    // Tốc độ bất thường: mức phạt do `auditSpeed` tính sẵn (0 = chỉ ghi log).
    case "speed_anomaly": {
      const w = Number((detail as { weight?: number }).weight ?? 0);
      return Number.isFinite(w) ? Math.max(0, Math.min(10, Math.round(w))) : 0;
    }
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

/**
 * Không tha lần nào: rời khỏi màn hình thi một lần là buộc làm lại từ đầu
 * (mức phạt/huỷ bài cuối cùng vẫn do cấu hình cuộc thi trong trang quản trị quyết định).
 */
export function leaveAllowance(_isMobile: boolean): number {
  return 0;
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

/*
 * Ghi chú: KHÔNG dùng luật tốc độ (giây/câu) để phạt hay huỷ bài — thi nhanh thật
 * (ví dụ 15-20 giây cho 2 câu) là bình thường và từng gây phạt oan.
 * Việc chống gửi đáp án bằng script được xử lý bằng biện pháp kỹ thuật ở
 * `src/lib/exam/answerIntake.ts`: máy chủ chỉ chấm đáp án đã lưu qua tiến trình
 * làm bài, và mỗi request chỉ ghi thêm số câu MỚI có hạn.
 */




/** Nhãn ngắn gọn cho từng loại sự kiện (hiển thị trong trang quản trị). */
export const EXAM_EVENT_LABEL: Record<string, string> = {
  tab_hidden: "Rời màn hình thi",
  window_blur: "Chuyển cửa sổ",
  copy: "Sao chép",
  paste: "Dán",
  contextmenu: "Chuột phải",
  fullscreen_exit: "Thoát toàn màn hình",
  resize_suspect: "Đổi kích thước bất thường",
  reconnect: "Kết nối lại",
  multi_tab: "Mở nhiều tab",
  devtools_open: "Mở công cụ nhà phát triển",
  liveness_failed: "Không xác thực được phiên (liveness)",
  untrusted_input: "Đáp án không có thao tác thật",
  automation_detected: "Trình duyệt tự động hoá",
  script_suspect: "Nghi vấn dùng script",
  honeypot_hit: "Kích hoạt bẫy Script (Honeypot)",
  captcha_failed: "Captcha vô hình không qua (Turnstile)",
  speed_anomaly: "Tốc độ trả lời bất thường",
};


/**
 * Diễn giải RÕ nguyên nhân một sự kiện liêm chính để sau này dễ rà soát:
 * ghi kèm ngữ cảnh (thời lượng, câu số, tín hiệu phát hiện, nguồn phát hiện).
 */
export function describeExamEvent(kind: string, detail: ExamEventDetail = {}): string {
  const label = EXAM_EVENT_LABEL[kind] ?? kind;
  const parts: string[] = [];
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);

  const hidden = num(detail.hiddenMs);
  if (hidden !== null) parts.push(`ẩn ${Math.round(hidden / 1000)} giây`);
  const blurred = num(detail["blurredMs"]);
  if (blurred !== null) parts.push(`mất focus ${Math.round(blurred / 1000)} giây`);
  if (detail.documentVisible === false) parts.push("trang không hiển thị");

  const qIndex = num(detail["questionIndex"]);
  if (qIndex !== null) parts.push(`câu ${qIndex + 1}`);
  const count = num(detail["count"]);
  if (count !== null) parts.push(`${count} đáp án`);
  const cv = num(detail["cv"]);
  if (cv !== null) parts.push(`độ lệch nhịp ${(cv * 100).toFixed(1)}%`);

  // Không hiển thị `dw`/`dh` từ client cũ như một cáo buộc DevTools. Kích thước
  // cửa sổ không phải bằng chứng và không còn được dùng để chấm điểm.
  if (kind === "devtools_open" && ("dw" in detail || "dh" in detail)) {
    parts.push("tín hiệu kích thước cũ — không tính điểm");
  }

  const signals = detail["signals"];
  if (Array.isArray(signals) && signals.length) parts.push(`dấu hiệu: ${signals.join(", ")}`);
  if (typeof detail.reason === "string" && detail.reason) parts.push(detail.reason);
  const source = detail["source"];
  if (typeof source === "string" && source) parts.push(`nguồn: ${source}`);
  const token = detail["token"];
  if (typeof token === "string" && token) parts.push(`token ${token}`);

  return parts.length ? `${label} — ${parts.join("; ")}` : label;
}
