/**
 * Luật "tốc độ bất thường": chỉ phạt khi tốc độ trả lời KHÔNG THỂ có ở người thật,
 * hoặc khi tốc độ nhanh bất thường ĐI KÈM tín hiệu script (mở console, gọi API thô,
 * lưu bài dồn dập, đáp án thiếu bằng chứng thao tác).
 *
 * Logic thuần tuý để kiểm thử được, không phụ thuộc Supabase.
 */

/** Tín hiệu nghi vấn script đã được ghi nhận trong phiên (kể cả loại trọng số 0). */
export type ScriptSignal =
  | "console_bait"
  | "autosave_rate"
  | "unsigned"
  | "no_proof"
  | "robotic_timing"
  | "untrusted_input"
  | "stale_proof";

export type SpeedAuditInput = {
  /** Số câu đã trả lời. */
  answered: number;
  /** Số câu đúng. */
  correct: number;
  /** Tổng thời gian làm bài (giây). */
  seconds: number;
  /** Tín hiệu script đã ghi nhận trong phiên. */
  signals: readonly ScriptSignal[];
};

export type SpeedAuditResult = {
  /** Điểm liêm chính bị cộng thêm (0 = không phạt). */
  weight: number;
  /** Mã lý do để lưu vào nhật ký sự kiện. */
  reason: string;
  /** Số giây trung bình mỗi câu. */
  secPerQuestion: number;
  /** Tỉ lệ đúng 0..1. */
  accuracy: number;
};

/** Dưới mốc này thì con người không kịp đọc đề — coi là bất khả thi. */
export const IMPOSSIBLE_SEC_PER_QUESTION = 2;
/** Nhanh bất thường: chỉ phạt khi có thêm tín hiệu script hoặc độ chính xác gần tuyệt đối. */
export const FAST_SEC_PER_QUESTION = 4;
/** Số câu tối thiểu để luật tốc độ có ý nghĩa thống kê. */
export const MIN_ANSWERS_FOR_SPEED = 8;
/** Độ chính xác coi là "gần tuyệt đối". */
export const NEAR_PERFECT_ACCURACY = 0.9;

const NONE: Omit<SpeedAuditResult, "secPerQuestion" | "accuracy"> = { weight: 0, reason: "" };

/**
 * Chấm mức phạt cho tốc độ làm bài.
 * Nguyên tắc: thi nhanh THẬT (ít câu, làm quen đề) không bị phạt.
 */
export function auditSpeed(input: SpeedAuditInput): SpeedAuditResult {
  const answered = Math.max(0, Math.round(input.answered || 0));
  const correct = Math.max(0, Math.round(input.correct || 0));
  const seconds = Math.max(0, Math.round(input.seconds || 0));
  const accuracy = answered > 0 ? Math.min(1, correct / answered) : 0;
  const secPerQuestion = answered > 0 ? seconds / answered : Number.POSITIVE_INFINITY;
  const base = { secPerQuestion, accuracy };

  if (answered < MIN_ANSWERS_FOR_SPEED) return { ...NONE, ...base };

  const hasSignal = (input.signals ?? []).length > 0;

  // QUAN TRỌNG: tốc độ KHÔNG bao giờ bị trừ điểm liêm chính — nhiều thí sinh
  // thuộc đề và làm rất nhanh một cách hợp lệ. Ở đây chỉ GẮN NHÃN để quản trị
  // rà soát; việc chống dò đáp án được xử lý ở gốc (revealGuard + khoá chấm-ngay).
  if (secPerQuestion < IMPOSSIBLE_SEC_PER_QUESTION) {
    return { weight: 0, reason: "very_fast", ...base };
  }

  if (secPerQuestion < FAST_SEC_PER_QUESTION) {
    return {
      weight: 0,
      reason: hasSignal
        ? "fast_with_script_signal"
        : accuracy >= NEAR_PERFECT_ACCURACY
          ? "fast_perfect"
          : "fast_only",
      ...base,
    };
  }


  return { ...NONE, ...base };
}

/** Quy đổi nhật ký sự kiện của phiên thành danh sách tín hiệu script. */
export function collectScriptSignals(
  events: readonly { kind: string; detail?: unknown }[],
): ScriptSignal[] {
  const out = new Set<ScriptSignal>();
  for (const ev of events ?? []) {
    const reason = String(
      (ev.detail as { reason?: string; via?: string } | undefined)?.reason ??
        (ev.detail as { via?: string } | undefined)?.via ??
        "",
    );
    if (ev.kind === "devtools_open") out.add("console_bait");
    else if (ev.kind === "untrusted_input") out.add("untrusted_input");
    else if (ev.kind === "script_suspect") {
      if (reason.startsWith("autosave_rate")) out.add("autosave_rate");
      else if (reason.startsWith("unsigned")) out.add("unsigned");
      else if (reason.startsWith("no_proof")) out.add("no_proof");
      else if (reason.startsWith("stale_proof")) out.add("stale_proof");
      else if (reason === "robotic_timing") out.add("robotic_timing");
      else out.add("unsigned");
    }
  }
  return [...out];
}
